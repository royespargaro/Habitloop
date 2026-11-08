import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { AppData } from '../types';
import { isValidAppData } from './appStore';
import { db } from './firebase';

export const subscribeToFirestore = (uid: string, callback: (data: AppData | null) => void, onError: (error: Error) => void = error => console.error('InPursuit cloud sync failed:', error)) => onSnapshot(
  doc(db, 'users', uid),
  snapshot => {
    if (!snapshot.exists()) { callback(null); return; }
    const remote: unknown = snapshot.data();
    if (isValidAppData(remote)) callback(remote);
    else onError(new Error('The cloud backup has an unsupported or invalid data format. Your local data was left untouched.'));
  },
  onError,
);
export const syncToFirestore = async (uid: string, data: AppData): Promise<void> => { await setDoc(doc(db, 'users', uid), data); };
