
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { HabitData } from '../context/HabitContext';

export const subscribeToFirestore = (uid: string, callback: (data: HabitData) => void) => {
    return onSnapshot(doc(db, 'users', uid), (doc) => {
        if (doc.exists()) {
            callback(doc.data() as HabitData);
        }
    });
};

export const syncToFirestore = async (uid: string, data: HabitData) => {
    await setDoc(doc(db, 'users', uid), data);
};
