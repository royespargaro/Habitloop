import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import type { AppData } from '../types';
import { auth } from '../services/firebase';
import { loadData, saveData as appStoreSave } from '../services/appStore';
import * as sync from '../services/syncService';

type HabitContextValue = { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; saveData: (data: AppData) => void; user: User | null; signIn: () => Promise<unknown>; signOut: () => Promise<void> };
export const HabitContext = createContext<HabitContextValue | undefined>(undefined);
export const HabitProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<AppData>(loadData);
  const [user, setUser] = useState<User | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser); unsubscribeFirestore?.(); unsubscribeFirestore = undefined;
      if (!currentUser) { const local = loadData(); dataRef.current = local; setData(local); return; }
      unsubscribeFirestore = sync.subscribeToFirestore(currentUser.uid, remote => {
        if (remote) {
          const localTimestamp = Date.parse(dataRef.current.updatedAt ?? '');
          const remoteTimestamp = Date.parse(remote.updatedAt ?? '');
          const localIsNewer = Number.isFinite(localTimestamp) && (!Number.isFinite(remoteTimestamp) || localTimestamp > remoteTimestamp);
          const neitherHasTimestamp = !Number.isFinite(localTimestamp) && !Number.isFinite(remoteTimestamp);

          if (localIsNewer || neitherHasTimestamp) {
            const localCopy = { ...dataRef.current, updatedAt: new Date().toISOString() };
            dataRef.current = localCopy;
            setData(localCopy);
            appStoreSave(localCopy);
            void sync.syncToFirestore(currentUser.uid, localCopy).catch(error => console.error('Could not upload the newer local InPursuit data:', error));
            return;
          }

          dataRef.current = remote;
          setData(remote);
          appStoreSave(remote);
        } else {
          const localCopy = { ...dataRef.current, updatedAt: new Date().toISOString() };
          dataRef.current = localCopy;
          setData(localCopy);
          appStoreSave(localCopy);
          void sync.syncToFirestore(currentUser.uid, localCopy).catch(error => console.error('Could not create the initial InPursuit cloud backup:', error));
        }
      }, error => console.error(error));
    });
    return () => { unsubscribeAuth(); unsubscribeFirestore?.(); };
  }, []);
  const saveData = (newData: AppData) => {
    const next = { ...newData, updatedAt: new Date().toISOString() };
    dataRef.current = next;
    setData(next);
    appStoreSave(next);
    if (user) void sync.syncToFirestore(user.uid, next).catch(error => console.error('InPursuit saved locally, but cloud sync failed:', error));
  };
  const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
  const signOut = () => firebaseSignOut(auth);
  return <HabitContext.Provider value={{ data, setData, saveData, user, signIn, signOut }}>{children}</HabitContext.Provider>;
};
export const useHabits = () => { const context = useContext(HabitContext); if (!context) throw new Error('useHabits must be used within HabitProvider'); return context; };
