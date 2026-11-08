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
        if (remote) { dataRef.current = remote; setData(remote); appStoreSave(remote); }
        else void sync.syncToFirestore(currentUser.uid, dataRef.current).catch(error => console.error('Could not create the initial InPursuit cloud backup:', error));
      }, error => console.error(error));
    });
    return () => { unsubscribeAuth(); unsubscribeFirestore?.(); };
  }, []);
  const saveData = (next: AppData) => {
    dataRef.current = next; setData(next); appStoreSave(next);
    if (user) void sync.syncToFirestore(user.uid, next).catch(error => console.error('InPursuit saved locally, but cloud sync failed:', error));
  };
  const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
  const signOut = () => firebaseSignOut(auth);
  return <HabitContext.Provider value={{ data, setData, saveData, user, signIn, signOut }}>{children}</HabitContext.Provider>;
};
export const useHabits = () => { const context = useContext(HabitContext); if (!context) throw new Error('useHabits must be used within HabitProvider'); return context; };
