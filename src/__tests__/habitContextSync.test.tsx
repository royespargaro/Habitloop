// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';
import type { AppData } from '../types';
import { createDefaultData } from '../services/appStore';

let authCallback: ((user: User | null) => void) | null = null;
let firestoreListeners = new Map<string, {
  onNext: (event: { data: AppData | null; fromCache: boolean; hasPendingWrites: boolean }) => void;
  onError: (err: Error, offline: boolean) => void;
}>();

const mockSignInWithPopup = vi.fn();
const mockSignInWithRedirect = vi.fn();
const mockGetRedirectResult = vi.fn().mockResolvedValue(null);
const mockFirebaseSignOut = vi.fn();
const mockSyncToFirestore = vi.fn();

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    setCustomParameters = vi.fn();
  },
  getRedirectResult: (...args: unknown[]) => mockGetRedirectResult(...args),
  onAuthStateChanged: vi.fn((_auth, cb: (user: User | null) => void) => {
    authCallback = cb;
    return () => {
      authCallback = null;
    };
  }),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signInWithRedirect: (...args: unknown[]) => mockSignInWithRedirect(...args),
  signOut: (...args: unknown[]) => mockFirebaseSignOut(...args),
}));

vi.mock('../services/firebase', () => ({
  auth: { currentUser: null },
  db: {},
}));

vi.mock('../services/syncService', () => ({
  subscribeToFirestore: vi.fn((uid: string, onNext, onError) => {
    firestoreListeners.set(uid, { onNext, onError });
    return () => {
      firestoreListeners.delete(uid);
    };
  }),
  syncToFirestore: (...args: unknown[]) => mockSyncToFirestore(...args),
  isOfflineError: (err: unknown) => err instanceof Error && err.message.includes('offline'),
}));

import { HabitProvider, useHabits } from '../context/HabitContext';

function Harness() {
  const ctx = useHabits();
  return (
    <div>
      <span data-testid="auth-ready">{String(ctx.authReady)}</span>
      <span data-testid="user-uid">{ctx.user?.uid ?? 'guest'}</span>
      <span data-testid="sync-status">{ctx.syncStatus}</span>
      <span data-testid="pending-sync">{String(ctx.pendingSync)}</span>
      <span data-testid="goal-titles">{ctx.data.goals.map(g => g.title).join(',')}</span>
      <span data-testid="conflict-present">{String(Boolean(ctx.conflict))}</span>
      <button
        type="button"
        data-testid="add-goal"
        onClick={() =>
          ctx.updateData(current => ({
            ...current,
            goals: [
              ...current.goals,
              {
                id: `g-${current.goals.length + 1}`,
                lifeAreaId: null,
                title: `Goal ${current.goals.length + 1}`,
                outcome: '',
                targetDate: '',
                status: 'active',
                createdAt: '2026-11-12T00:00:00.000Z',
              },
            ],
          }))
        }
      >
        Add goal
      </button>
      <button type="button" data-testid="retry-sync" onClick={() => void ctx.retrySync()}>
        Retry
      </button>
      <button type="button" data-testid="merge-conflict" onClick={() => void ctx.resolveConflict('merge')}>
        Merge
      </button>
    </div>
  );
}

const makeUser = (uid: string) => ({ uid, email: `${uid}@example.com`, displayName: uid } as User);

describe('HabitContext synchronization & account isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    authCallback = null;
    firestoreListeners = new Map();
    mockSyncToFirestore.mockReset();
    mockSyncToFirestore.mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('operates locally for guests without attempting Firestore sync', async () => {
    render(
      <HabitProvider>
        <Harness />
      </HabitProvider>,
    );

    act(() => authCallback?.(null));

    expect(screen.getByTestId('auth-ready').textContent).toBe('true');
    expect(screen.getByTestId('sync-status').textContent).toBe('local');

    act(() => screen.getByTestId('add-goal').click());

    expect(screen.getByTestId('goal-titles').textContent).toBe('Goal 1');
    expect(screen.getByTestId('sync-status').textContent).toBe('local');
    expect(mockSyncToFirestore).not.toHaveBeenCalled();
  });

  it('hydrates remote data, tracks honest synced/error states, and recovers via retrySync', async () => {
    render(
      <HabitProvider>
        <Harness />
      </HabitProvider>,
    );

    act(() => authCallback?.(makeUser('user-1')));
    expect(screen.getByTestId('sync-status').textContent).toBe('hydrating');

    const cloudDoc = createDefaultData();
    cloudDoc.goals.push({
      id: 'cg1',
      lifeAreaId: null,
      title: 'Cloud Goal',
      outcome: '',
      targetDate: '',
      status: 'active',
      createdAt: '2026-11-12T00:00:00.000Z',
    });

    act(() => {
      firestoreListeners.get('user-1')?.onNext({ data: cloudDoc, fromCache: false, hasPendingWrites: false });
    });

    expect(screen.getByTestId('goal-titles').textContent).toBe('Cloud Goal');
    expect(screen.getByTestId('sync-status').textContent).toBe('synced');

    // Make Firestore fail on next write — must NOT claim synced
    mockSyncToFirestore.mockRejectedValueOnce(new Error('permission-denied'));

    act(() => screen.getByTestId('add-goal').click());
    expect(screen.getByTestId('sync-status').textContent).toBe('syncing');

    await waitFor(() => expect(screen.getByTestId('sync-status').textContent).toBe('error'));
    expect(screen.getByTestId('pending-sync').textContent).toBe('true');

    // Retry succeeds -> transitions to synced
    mockSyncToFirestore.mockResolvedValueOnce(undefined);
    act(() => screen.getByTestId('retry-sync').click());

    await waitFor(() => expect(screen.getByTestId('sync-status').textContent).toBe('synced'));
    expect(screen.getByTestId('pending-sync').textContent).toBe('false');
  });

  it('queues edits while offline and auto-flushes when online event fires', async () => {
    render(
      <HabitProvider>
        <Harness />
      </HabitProvider>,
    );

    act(() => authCallback?.(makeUser('user-offline')));
    act(() => {
      firestoreListeners.get('user-offline')?.onNext({ data: createDefaultData(), fromCache: false, hasPendingWrites: false });
    });

    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    act(() => screen.getByTestId('add-goal').click());

    expect(screen.getByTestId('sync-status').textContent).toBe('offline');
    expect(mockSyncToFirestore).not.toHaveBeenCalled();

    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(mockSyncToFirestore).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('sync-status').textContent).toBe('synced'));
  });

  it('isolates accounts cleanly on user switch without cross-account leakage', async () => {
    render(
      <HabitProvider>
        <Harness />
      </HabitProvider>,
    );

    // User A signs in and receives private goal
    act(() => authCallback?.(makeUser('user-a')));
    const userAData = createDefaultData();
    userAData.goals.push({
      id: 'ga1',
      lifeAreaId: null,
      title: 'Secret A',
      outcome: '',
      targetDate: '',
      status: 'active',
      createdAt: '2026-11-12T00:00:00.000Z',
    });
    act(() => {
      firestoreListeners.get('user-a')?.onNext({ data: userAData, fromCache: false, hasPendingWrites: false });
    });
    expect(screen.getByTestId('goal-titles').textContent).toBe('Secret A');

    // User A signs out -> reverts cleanly to guest workspace (not User A's secret)
    act(() => authCallback?.(null));
    expect(screen.getByTestId('goal-titles').textContent).toBe('');

    // User B signs in -> receives User B doc, never User A's data
    act(() => authCallback?.(makeUser('user-b')));
    expect(screen.getByTestId('goal-titles').textContent).toBe('');
    expect(mockSyncToFirestore).not.toHaveBeenCalled();
  });

  it('prompts conflict instead of overwriting when guest has local work and cloud already has data', async () => {
    render(
      <HabitProvider>
        <Harness />
      </HabitProvider>,
    );

    // Create meaningful work in guest mode
    act(() => authCallback?.(null));
    act(() => screen.getByTestId('add-goal').click());
    expect(screen.getByTestId('goal-titles').textContent).toBe('Goal 1');

    // Sign into account that already has cloud data
    act(() => authCallback?.(makeUser('user-merge')));
    const cloudDoc = createDefaultData();
    cloudDoc.goals.push({
      id: 'cloud-1',
      lifeAreaId: null,
      title: 'Cloud Goal',
      outcome: '',
      targetDate: '',
      status: 'active',
      createdAt: '2026-11-12T00:00:00.000Z',
    });
    act(() => {
      firestoreListeners.get('user-merge')?.onNext({ data: cloudDoc, fromCache: false, hasPendingWrites: false });
    });

    expect(screen.getByTestId('conflict-present').textContent).toBe('true');
    expect(screen.getByTestId('sync-status').textContent).toBe('conflict');

    act(() => screen.getByTestId('merge-conflict').click());

    await waitFor(() => expect(mockSyncToFirestore).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('conflict-present').textContent).toBe('false');
    expect(screen.getByTestId('goal-titles').textContent).toContain('Cloud Goal');
    expect(screen.getByTestId('goal-titles').textContent).toContain('Goal 1');
  });
});
