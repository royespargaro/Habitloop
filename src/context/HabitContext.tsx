
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { AppData } from '../types';
import { loadData, saveData as appStoreSave } from '../services/appStore';
import * as sync from '../services/syncService';

export interface Habit { id: string; name: string; }

export const HabitContext = createContext<{
    data: AppData;
    setData: React.Dispatch<React.SetStateAction<AppData>>;
    saveData: (data: AppData) => void;
    user: User | null;
    signIn: () => void;
    signOut: () => void;
} | undefined>(undefined);

export const HabitProvider = ({ children }: { children: React.ReactNode }) => {
    const [data, setData] = useState<AppData>(loadData());
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        let unsubscribeFirestore: () => void;
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (unsubscribeFirestore) unsubscribeFirestore();

            if (currentUser) {
                unsubscribeFirestore = sync.subscribeToFirestore(currentUser.uid, (remoteData) => {
                    setData(remoteData);
                    appStoreSave(remoteData);
                });
            } else {
                setData(loadData());
            }
        });
        return () => {
            unsubscribeAuth();
            if (unsubscribeFirestore) unsubscribeFirestore();
        };
    }, []);

    const saveData = (newData: AppData) => {
        setData(newData);
        appStoreSave(newData);
        if (user) sync.syncToFirestore(user.uid, newData);
    };

    const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
    const signOut = () => firebaseSignOut(auth);

    return (
        <HabitContext.Provider value={{ data, setData, saveData, user, signIn, signOut }}>
            {children}
        </HabitContext.Provider>
    );
};

export const useHabits = () => {
    const context = useContext(HabitContext);
    if (!context) throw new Error('useHabits must be used within HabitProvider');
    return context;
};
