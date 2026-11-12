import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getAuthErrorCode, getReadableAuthError } from '../utils/authErrors';
import type { AppData, SyncStatus, WorkspaceSummary } from '../types';
import { auth } from '../services/firebase';
import {
  consumeLoadWarning,
  createDefaultData,
  hasMeaningfulWorkspaceData,
  loadAccountData,
  loadData,
  loadSyncMeta,
  mergeWorkspaceData,
  sanitizeAppData,
  saveAccountData,
  saveData as saveLocalWorkspace,
  saveSyncMeta,
  summarizeWorkspace,
} from '../services/appStore';
import * as sync from '../services/syncService';

export interface ConflictState {
  localSummary: WorkspaceSummary;
  cloudSummary: WorkspaceSummary;
}

type HabitContextValue = {
  data: AppData;
  updateData: (updater: (current: AppData) => AppData) => void;
  saveData: (next: AppData) => void;
  user: User | null;
  authReady: boolean;
  syncStatus: SyncStatus;
  syncError: string;
  lastSyncedAt: string | null;
  pendingSync: boolean;
  conflict: ConflictState | null;
  resolveConflict: (strategy: 'keep-cloud' | 'use-local' | 'merge') => Promise<void>;
  retrySync: () => Promise<void>;
  signIn: () => Promise<unknown>;
  signOut: () => Promise<void>;
  storageNotice: string;
  authNotice: string;
};

export const HabitContext = createContext<HabitContextValue | undefined>(undefined);

const SYNC_DEBOUNCE_MS = 350;

function formatFriendlySyncError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (typeof parsed.error === 'string') {
      if (parsed.error.toLowerCase().includes('permission') || parsed.error.toLowerCase().includes('insufficient')) {
        return 'Cloud sync was rejected by Firestore permissions. Your changes are safe locally.';
      }
      return parsed.error;
    }
  } catch {
    // Plain error string
  }
  return raw || 'Cloud synchronization failed. Your changes remain saved on this device.';
}

export const HabitProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<AppData>(() => loadData());
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [syncError, setSyncError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState(false);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [storageError, setStorageError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [recoveryWarning] = useState(() => consumeLoadWarning());

  const dataRef = useRef<AppData>(data);
  dataRef.current = data;

  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const lastSyncedAtRef = useRef<string | null>(lastSyncedAt);
  lastSyncedAtRef.current = lastSyncedAt;

  const syncStatusRef = useRef<SyncStatus>(syncStatus);
  syncStatusRef.current = syncStatus;

  const sessionGenRef = useRef(0);
  const writeSeqRef = useRef(0);
  const syncTimerRef = useRef<number | null>(null);
  const inFlightSyncRef = useRef<Promise<void> | null>(null);
  const pendingGuestConflictRef = useRef<{ guestData: AppData; cloudData: AppData } | null>(null);

  const clearDebounce = () => {
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  };

  const persistLocalScoped = useCallback((uid: string | null, next: AppData, isPending: boolean, syncedAt: string | null) => {
    try {
      if (uid) {
        saveAccountData(uid, next);
        saveSyncMeta(uid, { pendingSync: isPending, lastSyncedAt: syncedAt });
      } else {
        saveLocalWorkspace(next);
      }
      setStorageError('');
    } catch (error) {
      console.error('Could not save InPursuit data locally', error);
      setStorageError('Changes are visible but could not be saved on this device. Export a backup or free local storage.');
    }
  }, []);

  const flushCloudWrite = useCallback(async (uid: string, sessionGen: number, expectedSeq?: number) => {
    if (sessionGen !== sessionGenRef.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSyncStatus('offline');
      setPendingSync(true);
      setSyncError('');
      return;
    }

    const runSync = async () => {
      const snapshotData = dataRef.current;
      const targetSeq = expectedSeq ?? writeSeqRef.current;
      setSyncStatus('syncing');
      setSyncError('');

      try {
        await sync.syncToFirestore(uid, snapshotData);
        if (sessionGen !== sessionGenRef.current) return;

        if (writeSeqRef.current === targetSeq) {
          const syncedTime = new Date().toISOString();
          saveSyncMeta(uid, { pendingSync: false, lastSyncedAt: syncedTime });
          setPendingSync(false);
          setLastSyncedAt(syncedTime);
          setSyncStatus('synced');
          setSyncError('');
        } else {
          // Another edit happened while this write was in flight; schedule follow-up flush.
          void flushCloudWrite(uid, sessionGen, writeSeqRef.current);
        }
      } catch (error) {
        if (sessionGen !== sessionGenRef.current) return;
        const offline = sync.isOfflineError(error);
        saveSyncMeta(uid, { pendingSync: true, lastSyncedAt: lastSyncedAtRef.current });
        setPendingSync(true);
        if (offline) {
          setSyncStatus('offline');
          setSyncError('');
        } else {
          setSyncStatus('error');
          setSyncError(formatFriendlySyncError(error));
        }
      }
    };

    const previous = inFlightSyncRef.current;
    const nextPromise = (previous ? previous.catch(() => {}) : Promise.resolve()).then(runSync);
    inFlightSyncRef.current = nextPromise;
    await nextPromise;
  }, []);

  const scheduleCloudSync = useCallback((uid: string, seq: number) => {
    clearDebounce();
    const sessionGen = sessionGenRef.current;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSyncStatus('offline');
      return;
    }
    setSyncStatus('syncing');
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      void flushCloudWrite(uid, sessionGen, seq);
    }, SYNC_DEBOUNCE_MS);
  }, [flushCloudWrite]);

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | undefined;

    void getRedirectResult(auth).catch(error => {
      setAuthNotice(getReadableAuthError(error));
    });

    const unsubscribeAuth = onAuthStateChanged(auth, currentUser => {
      clearDebounce();
      sessionGenRef.current += 1;
      const sessionGen = sessionGenRef.current;
      const previousUser = userRef.current;

      unsubscribeFirestore?.();
      unsubscribeFirestore = undefined;
      pendingGuestConflictRef.current = null;
      setConflict(null);
      setSyncError('');

      // Capture guest data ONLY if transitioning directly from anonymous local workspace to signed-in account
      const candidateGuestData = !previousUser && currentUser && hasMeaningfulWorkspaceData(dataRef.current)
        ? dataRef.current
        : null;

      userRef.current = currentUser;
      setUser(currentUser);
      setAuthReady(true);

      if (!currentUser) {
        const local = loadData();
        dataRef.current = local;
        setData(local);
        setPendingSync(false);
        setLastSyncedAt(null);
        setSyncStatus('local');
        return;
      }

      const uid = currentUser.uid;
      const cachedAccount = loadAccountData(uid);
      const meta = loadSyncMeta(uid);

      // Immediately isolate UI from any prior account or guest workspace while hydrating
      const initialAccountState = cachedAccount ?? createDefaultData();
      dataRef.current = initialAccountState;
      setData(initialAccountState);
      setPendingSync(meta.pendingSync);
      setLastSyncedAt(meta.lastSyncedAt);
      setSyncStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'hydrating');

      let initialHydrationDone = false;

      unsubscribeFirestore = sync.subscribeToFirestore(
        uid,
        event => {
          if (sessionGen !== sessionGenRef.current) return;

          // If user signed in from a guest session with unsaved local data and cloud already has data, ask user instead of overwriting
          if (!initialHydrationDone && candidateGuestData && !cachedAccount && event.data && !event.fromCache) {
            initialHydrationDone = true;
            pendingGuestConflictRef.current = { guestData: candidateGuestData, cloudData: event.data };
            dataRef.current = event.data;
            setData(event.data);
            persistLocalScoped(uid, event.data, false, event.data.updatedAt ?? new Date().toISOString());
            setConflict({
              localSummary: summarizeWorkspace(candidateGuestData),
              cloudSummary: summarizeWorkspace(event.data),
            });
            setSyncStatus('conflict');
            return;
          }

          if (pendingGuestConflictRef.current) return;

          if (event.data) {
            const currentMeta = loadSyncMeta(uid);
            const localTs = Date.parse(dataRef.current.updatedAt ?? '');
            const remoteTs = Date.parse(event.data.updatedAt ?? '');
            const shouldKeepLocalPending =
              currentMeta.pendingSync &&
              Number.isFinite(localTs) &&
              (!Number.isFinite(remoteTs) || localTs >= remoteTs);

            if (shouldKeepLocalPending) {
              initialHydrationDone = true;
              if (!event.fromCache) {
                void flushCloudWrite(uid, sessionGen);
              }
              return;
            }

            initialHydrationDone = true;
            dataRef.current = event.data;
            setData(event.data);
            const syncedAt = event.data.updatedAt ?? currentMeta.lastSyncedAt ?? new Date().toISOString();
            persistLocalScoped(uid, event.data, false, syncedAt);
            setPendingSync(false);
            setLastSyncedAt(syncedAt);
            setSyncStatus(event.fromCache && typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'synced');
            setSyncError('');
          } else if (!event.fromCache) {
            // Cloud document does not exist yet for this account
            initialHydrationDone = true;
            const seedData = cachedAccount ?? candidateGuestData ?? createDefaultData();
            const stamped = sanitizeAppData({ ...seedData, updatedAt: new Date().toISOString() });
            dataRef.current = stamped;
            setData(stamped);
            persistLocalScoped(uid, stamped, true, null);
            setPendingSync(true);
            void flushCloudWrite(uid, sessionGen);
          }
        },
        (error, offline) => {
          if (sessionGen !== sessionGenRef.current) return;
          if (offline) {
            setSyncStatus('offline');
            setSyncError('');
          } else {
            setSyncStatus('error');
            setSyncError(formatFriendlySyncError(error));
          }
        },
      );
    });

    return () => {
      clearDebounce();
      unsubscribeAuth();
      unsubscribeFirestore?.();
    };
  }, [flushCloudWrite, persistLocalScoped]);

  // Auto-sync when connectivity returns
  useEffect(() => {
    const handleOnline = () => {
      const currentUser = userRef.current;
      if (!currentUser) return;
      const meta = loadSyncMeta(currentUser.uid);
      if (meta.pendingSync || syncStatusRef.current === 'offline' || syncStatusRef.current === 'error') {
        void flushCloudWrite(currentUser.uid, sessionGenRef.current);
      }
    };

    const handleOffline = () => {
      if (userRef.current) {
        setSyncStatus('offline');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushCloudWrite]);

  const applyDataChange = useCallback(
    (updater: (current: AppData) => AppData) => {
      const next = sanitizeAppData({
        ...updater(dataRef.current),
        updatedAt: new Date().toISOString(),
      });
      dataRef.current = next;
      setData(next);

      const currentUser = userRef.current;
      if (!currentUser) {
        persistLocalScoped(null, next, false, null);
        setSyncStatus('local');
        return;
      }

      writeSeqRef.current += 1;
      const seq = writeSeqRef.current;
      setPendingSync(true);
      persistLocalScoped(currentUser.uid, next, true, lastSyncedAtRef.current);
      scheduleCloudSync(currentUser.uid, seq);
    },
    [persistLocalScoped, scheduleCloudSync],
  );

  const saveData = useCallback((next: AppData) => {
    applyDataChange(() => next);
  }, [applyDataChange]);

  const resolveConflict = useCallback(async (strategy: 'keep-cloud' | 'use-local' | 'merge') => {
    const currentUser = userRef.current;
    const pending = pendingGuestConflictRef.current;
    if (!currentUser || !pending) return;

    pendingGuestConflictRef.current = null;
    setConflict(null);

    if (strategy === 'keep-cloud') {
      dataRef.current = pending.cloudData;
      setData(pending.cloudData);
      const syncedAt = pending.cloudData.updatedAt ?? new Date().toISOString();
      persistLocalScoped(currentUser.uid, pending.cloudData, false, syncedAt);
      setPendingSync(false);
      setLastSyncedAt(syncedAt);
      setSyncStatus('synced');
      return;
    }

    const chosen = strategy === 'merge'
      ? mergeWorkspaceData(pending.cloudData, pending.guestData)
      : sanitizeAppData({ ...pending.guestData, updatedAt: new Date().toISOString() });

    writeSeqRef.current += 1;
    dataRef.current = chosen;
    setData(chosen);
    setPendingSync(true);
    persistLocalScoped(currentUser.uid, chosen, true, lastSyncedAtRef.current);
    await flushCloudWrite(currentUser.uid, sessionGenRef.current, writeSeqRef.current);
  }, [flushCloudWrite, persistLocalScoped]);

  const retrySync = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    await flushCloudWrite(currentUser.uid, sessionGenRef.current, writeSeqRef.current);
  }, [flushCloudWrite]);

  const signIn = async () => {
    setAuthNotice('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      return await signInWithPopup(auth, provider);
    } catch (error) {
      const code = getAuthErrorCode(error);
      let isTopLevel = false;
      try {
        isTopLevel = typeof window !== 'undefined' && window.self === window.top;
      } catch {
        isTopLevel = false;
      }
      const isMobile =
        typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

      if (
        isTopLevel &&
        isMobile &&
        (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment')
      ) {
        await signInWithRedirect(auth, provider);
        return null;
      }
      throw error;
    }
  };
  const signOut = () => firebaseSignOut(auth);
  const storageNotice = [recoveryWarning, storageError].filter(Boolean).join(' ');

  return (
    <HabitContext.Provider
      value={{
        data,
        updateData: applyDataChange,
        saveData,
        user,
        authReady,
        syncStatus,
        syncError,
        lastSyncedAt,
        pendingSync,
        conflict,
        resolveConflict,
        retrySync,
        signIn,
        signOut,
        storageNotice,
        authNotice,
      }}
    >
      {children}
    </HabitContext.Provider>
  );
};

export const useHabits = () => {
  const context = useContext(HabitContext);
  if (!context) throw new Error('useHabits must be used within HabitProvider');
  return context;
};
