import { doc, getDocFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import type { AppData } from '../types';
import { isValidAppData, normalizeRemoteOrNull, sanitizeAppData } from './appStore';
import { auth, db } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface RemoteSnapshotEvent {
  data: AppData | null;
  fromCache: boolean;
  hasPendingWrites: boolean;
}

export function isOfflineError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : '';
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    code === 'unavailable' ||
    message.includes('client is offline') ||
    message.includes('network') ||
    message.includes('unavailable') ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  );
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): Error {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return new Error(JSON.stringify(errInfo));
}

export function prepareFirestorePayload(data: AppData): AppData {
  const sanitized = sanitizeAppData(data);
  const updatedAt = (sanitized.updatedAt || new Date().toISOString()).slice(0, 40);
  return {
    schemaVersion: 3,
    lifeAreas: sanitized.lifeAreas,
    goals: sanitized.goals,
    projects: sanitized.projects,
    tasks: sanitized.tasks,
    habits: sanitized.habits,
    habitLogs: sanitized.habitLogs,
    dailyPlans: sanitized.dailyPlans,
    dailyReviews: sanitized.dailyReviews,
    updatedAt,
  };
}

export const subscribeToFirestore = (
  uid: string,
  callback: (event: RemoteSnapshotEvent) => void,
  onError: (error: Error, offline: boolean) => void = error => console.error('InPursuit cloud sync failed:', error),
) => {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    { includeMetadataChanges: true },
    snapshot => {
      const fromCache = snapshot.metadata.fromCache;
      const hasPendingWrites = snapshot.metadata.hasPendingWrites;
      if (!snapshot.exists()) {
        callback({ data: null, fromCache, hasPendingWrites });
        return;
      }
      const raw: unknown = snapshot.data();
      const normalized = normalizeRemoteOrNull(raw);
      if (normalized) {
        callback({ data: normalized, fromCache, hasPendingWrites });
      } else {
        onError(new Error('The cloud backup has an unsupported or invalid data format. Your local data was left untouched.'), false);
      }
    },
    error => {
      const offline = isOfflineError(error);
      const wrapped = handleFirestoreError(error, OperationType.GET, path);
      onError(wrapped, offline);
    },
  );
};

export const fetchFirestoreOnce = async (uid: string): Promise<AppData | null> => {
  const path = `users/${uid}`;
  try {
    const snapshot = await getDocFromServer(doc(db, 'users', uid));
    if (!snapshot.exists()) return null;
    const normalized = normalizeRemoteOrNull(snapshot.data());
    if (!normalized) {
      throw new Error('The cloud backup has an unsupported or invalid data format.');
    }
    return normalized;
  } catch (error) {
    throw handleFirestoreError(error, OperationType.GET, path);
  }
};

export const syncToFirestore = async (uid: string, data: AppData): Promise<void> => {
  const path = `users/${uid}`;
  const payload = prepareFirestorePayload(data);
  if (!isValidAppData(payload)) {
    throw new Error('Cannot sync invalid workspace data.');
  }
  try {
    await setDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    throw handleFirestoreError(error, OperationType.WRITE, path);
  }
};
