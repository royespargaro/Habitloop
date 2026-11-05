
import { doc, getDoc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { db } from './firebase';
import { HabitData } from '../context/HabitContext';

export const syncToFirestore = async (userId: string, data: HabitData) => {
    if (!userId) return;
    try {
        await setDoc(doc(db, 'users', userId), { habits: data.habits, checks: data.checks, nid: data.nid });
    } catch (e) {
        console.error('Firestore sync error:', e);
    }
};

export const subscribeToFirestore = (userId: string, callback: (data: HabitData) => void) => {
    if (!userId) return () => {};
    return onSnapshot(doc(db, 'users', userId), (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.data() as HabitData);
        }
    });
};
