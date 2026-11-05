
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import * as storage from '../services/storage';
import * as sync from '../services/syncService';

export interface Habit { id: string; name: string; }
export interface HabitData { habits: Habit[]; checks: Record<string, Record<string, number[]>>; nid: number; }

const HabitContext = createContext<{
    data: HabitData;
    setData: React.Dispatch<React.SetStateAction<HabitData>>;
    saveData: (data: HabitData) => void;
    user: User | null;
    signIn: () => void;
} | undefined>(undefined);

export const HabitProvider = ({ children }: { children: React.ReactNode }) => {
    const [data, setData] = useState<HabitData>(storage.defaults());
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Sync from firestore
                return sync.subscribeToFirestore(currentUser.uid, (remoteData) => {
                    setData(remoteData);
                    storage.save(remoteData);
                });
            } else {
                setData(storage.load());
            }
        });
        return () => unsubscribe();
    }, []);

    const saveData = (newData: HabitData) => {
        setData(newData);
        storage.save(newData);
        if (user) sync.syncToFirestore(user.uid, newData);
    };

    const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());

    return (
        <HabitContext.Provider value={{ data, setData, saveData, user, signIn }}>
            {children}
        </HabitContext.Provider>
    );
};

export const useHabits = () => {
    const context = useContext(HabitContext);
    if (!context) throw new Error('useHabits must be used within HabitProvider');
    return context;
};
