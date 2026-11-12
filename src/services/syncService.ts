import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { AppData } from '../types';
import { isValidAppData } from './appStore';
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

export const subscribeToFirestore = (
  uid: string,
  callback: (data: AppData | null) => void,
  onError: (error: Error) => void = error => console.error('InPursuit cloud sync failed:', error),
) => {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    snapshot => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const remote: unknown = snapshot.data();
      if (isValidAppData(remote)) callback(remote);
      else onError(new Error('The cloud backup has an unsupported or invalid data format. Your local data was left untouched.'));
    },
    error => {
      const wrapped = handleFirestoreError(error, OperationType.GET, path);
      onError(wrapped);
    },
  );
};

export const syncToFirestore = async (uid: string, data: AppData): Promise<void> => {
  const path = `users/${uid}`;
  try {
    await setDoc(doc(db, 'users', uid), data);
  } catch (error) {
    throw handleFirestoreError(error, OperationType.WRITE, path);
  }
};
