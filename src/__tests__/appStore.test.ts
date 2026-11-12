import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildBackupEnvelope,
  consumeLoadWarning,
  createDefaultData,
  importData,
  inspectBackupText,
  loadAccountData,
  loadData,
  mergeWorkspaceData,
  sanitizeAppData,
  saveAccountData,
  saveData,
} from '../services/appStore';
import type { AppData } from '../types';

const STORAGE_KEY = 'habitloop.execution.v2';
const LEGACY_KEY = 'habitmatrix.v1';
const validV3: AppData = {
  schemaVersion: 3,
  lifeAreas: [],
  goals: [],
  projects: [],
  tasks: [],
  habits: [],
  habitLogs: [],
  dailyPlans: [],
  dailyReviews: [],
};

let store: Record<string, string> = {};

beforeEach(() => {
  store = {};
  consumeLoadWarning();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('app store schema migration & backup integrity', () => {
  it('upgrades v2 data while preserving goals and adding life areas', () => {
    const legacyData = {
      schemaVersion: 2,
      goals: [{
        id: 'goal-1',
        title: 'Finish degree applications',
        outcome: 'Submit the required applications',
        targetDate: '2027-01-15',
        status: 'active',
        createdAt: '2026-11-08T00:00:00.000Z',
      }],
      projects: [],
      tasks: [],
      habits: [],
      habitLogs: [],
      dailyPlans: [],
      dailyReviews: [],
    };
    store[STORAGE_KEY] = JSON.stringify(legacyData);

    const data = loadData();

    expect(data.schemaVersion).toBe(3);
    expect(data.lifeAreas.map(area => area.name)).toEqual(['Career', 'Business', 'Education', 'Wealth', 'Health']);
    expect(data.goals[0]).toMatchObject({ id: 'goal-1', title: 'Finish degree applications', lifeAreaId: null });
  });

  it('falls back to defaults when a nested v3 record is malformed', () => {
    const invalidData = { ...validV3, goals: [{ id: 'goal-without-required-fields' }] };
    store[STORAGE_KEY] = JSON.stringify(invalidData);

    const data = loadData();

    expect(data.goals).toEqual([]);
    expect(data.lifeAreas).toHaveLength(5);
  });

  it('rejects imported backups containing malformed task records', async () => {
    const invalidData = { ...validV3, tasks: [{ id: 'task-without-required-fields' }] };
    const file = { text: async () => JSON.stringify(invalidData) } as File;

    await expect(importData(file)).rejects.toThrow('valid InPursuit backup');
  });

  it('rejects malformed JSON backup files with a parse error', async () => {
    const file = { text: async () => '{not json' } as File;

    await expect(importData(file)).rejects.toThrow('This backup is not valid JSON.');
  });

  it('preserves invalid or newer-schema data before falling back', () => {
    const futureData = { ...validV3, schemaVersion: 4 };
    const raw = JSON.stringify(futureData);
    store[STORAGE_KEY] = raw;

    const data = loadData();

    expect(data.schemaVersion).toBe(3);
    expect(localStorage.setItem).toHaveBeenCalledWith(`${STORAGE_KEY}.recovery`, raw);
    expect(consumeLoadWarning()).toContain('recovery copy was preserved');
  });

  it('keeps starter habits when the legacy record contains no valid habits', () => {
    store[LEGACY_KEY] = JSON.stringify({ habits: null, checks: {} });

    const data = loadData();

    expect(data.habits).toHaveLength(6);
    expect(data.habitLogs).toEqual([]);
  });

  it('ignores impossible calendar days during legacy migration', () => {
    const legacyData = {
      habits: [{ id: 'h1', name: 'Read' }],
      checks: { h1: { '2026-2': [28, 31] } },
    };
    store[LEGACY_KEY] = JSON.stringify(legacyData);

    const data = loadData();

    expect(data.habitLogs.map(log => log.date)).toEqual(['2026-02-28']);
  });

  it('builds and validates versioned backup envelopes with summary metadata', () => {
    const sample = createDefaultData();
    sample.goals.push({
      id: 'g1',
      lifeAreaId: sample.lifeAreas[0].id,
      title: 'Publish research',
      outcome: 'Submit final paper',
      targetDate: '2027-03-01',
      status: 'active',
      createdAt: '2026-11-10T00:00:00.000Z',
    });

    const envelope = buildBackupEnvelope(sample);
    expect(envelope.format).toBe('inpursuit-backup');
    expect(envelope.backupVersion).toBe(1);

    const inspected = inspectBackupText(JSON.stringify(envelope));
    expect(inspected.backupVersion).toBe(1);
    expect(inspected.summary.goals).toBe(1);
    expect(inspected.data.goals[0].title).toBe('Publish research');
  });

  it('rejects backups from newer incompatible backupVersion or schemaVersion', () => {
    const newerBackup = {
      format: 'inpursuit-backup',
      backupVersion: 9,
      exportedAt: '2026-11-12T00:00:00.000Z',
      data: validV3,
    };
    expect(() => inspectBackupText(JSON.stringify(newerBackup))).toThrow('newer than this version');

    const newerSchema = {
      format: 'inpursuit-backup',
      backupVersion: 1,
      exportedAt: '2026-11-12T00:00:00.000Z',
      data: { ...validV3, schemaVersion: 8 },
    };
    expect(() => inspectBackupText(JSON.stringify(newerSchema))).toThrow('workspace schema v8');
  });

  it('sanitizes orphaned references and duplicate logs/plans cleanly', () => {
    const dirty: AppData = {
      schemaVersion: 3,
      lifeAreas: [{ id: 'a1', name: 'Health', description: '', createdAt: '' }],
      goals: [
        { id: 'g1', lifeAreaId: 'missing-area', title: 'Run 10k', outcome: '', targetDate: '', status: 'active', createdAt: '' },
        { id: 'g1', lifeAreaId: 'a1', title: 'Duplicate ID', outcome: '', targetDate: '', status: 'active', createdAt: '' },
      ],
      projects: [
        { id: 'p1', goalId: 'missing-goal', title: 'Prep', description: '', dueDate: '', status: 'active', createdAt: '' },
      ],
      tasks: [
        { id: 't1', projectId: 'missing-project', title: 'Buy shoes', dueDate: '2026-11-12', priority: 'high', status: 'todo', createdAt: '', completedAt: null },
      ],
      habits: [
        { id: 'h1', name: 'Stretch', frequency: 'daily', active: true, createdAt: '' },
      ],
      habitLogs: [
        { id: 'l1', habitId: 'h1', date: '2026-11-12', status: 'done' },
        { id: 'l2', habitId: 'h1', date: '2026-11-12', status: 'skipped' },
        { id: 'l3', habitId: 'deleted-habit', date: '2026-11-12', status: 'done' },
      ],
      dailyPlans: [
        { date: '2026-11-12', priorityTaskIds: ['t1', 'missing-task', 't1'] },
      ],
      dailyReviews: [
        { date: '2026-11-12', wins: '', blockers: '', notes: '', energy: 9 },
        { date: '2026-11-12', wins: 'Stretched', blockers: '', notes: 'Keep going', energy: 4 },
      ],
    };

    const clean = sanitizeAppData(dirty);
    expect(clean.goals).toHaveLength(1);
    expect(clean.goals[0].lifeAreaId).toBeNull();
    expect(clean.projects[0].goalId).toBeNull();
    expect(clean.tasks[0].projectId).toBeNull();
    expect(clean.habitLogs).toHaveLength(1);
    expect(clean.habitLogs[0].status).toBe('done');
    expect(clean.dailyPlans[0].priorityTaskIds).toEqual(['t1']);
    expect(clean.dailyReviews).toHaveLength(1);
    expect(clean.dailyReviews[0].wins).toBe('Stretched');
  });

  it('isolates account-scoped storage per UID and separates it from guest storage', () => {
    const guest = createDefaultData();
    saveData(guest);

    const userA = { ...validV3, goals: [{ id: 'ga', lifeAreaId: null, title: 'User A Goal', outcome: '', targetDate: '', status: 'active' as const, createdAt: '' }] };
    const userB = { ...validV3, goals: [{ id: 'gb', lifeAreaId: null, title: 'User B Goal', outcome: '', targetDate: '', status: 'active' as const, createdAt: '' }] };

    saveAccountData('uid-a', userA);
    saveAccountData('uid-b', userB);

    expect(loadAccountData('uid-a')?.goals[0].title).toBe('User A Goal');
    expect(loadAccountData('uid-b')?.goals[0].title).toBe('User B Goal');
    expect(loadData().goals).toEqual([]);
  });

  it('merges local guest workspace and cloud workspace without duplicating matching entities', () => {
    const cloud: AppData = {
      ...validV3,
      lifeAreas: [{ id: 'ca1', name: 'Health', description: '', createdAt: '' }],
      goals: [{ id: 'cg1', lifeAreaId: 'ca1', title: 'Run 5k', outcome: '', targetDate: '', status: 'active', createdAt: '' }],
      habits: [{ id: 'ch1', name: 'Deep work', frequency: 'daily', active: true, createdAt: '' }],
    };
    const local: AppData = {
      ...validV3,
      lifeAreas: [
        { id: 'la1', name: 'Health', description: '', createdAt: '' },
        { id: 'la2', name: 'Wealth', description: '', createdAt: '' },
      ],
      goals: [
        { id: 'lg1', lifeAreaId: 'la1', title: 'run 5k', outcome: '', targetDate: '', status: 'active', createdAt: '' },
        { id: 'lg2', lifeAreaId: 'la2', title: 'Save emergency fund', outcome: '6 months runway', targetDate: '', status: 'active', createdAt: '' },
      ],
      projects: [{ id: 'lp1', goalId: 'lg2', title: 'Automate savings', description: '', dueDate: '', status: 'active', createdAt: '' }],
      habits: [{ id: 'lh1', name: 'Deep work', frequency: 'daily', active: true, createdAt: '' }],
    };

    const merged = mergeWorkspaceData(cloud, local);
    expect(merged.lifeAreas.map(a => a.name)).toEqual(['Health', 'Wealth']);
    expect(merged.goals.map(g => g.title)).toEqual(['Run 5k', 'Save emergency fund']);
    expect(merged.projects).toHaveLength(1);
    expect(merged.projects[0].goalId).toBe('lg2');
    expect(merged.habits).toHaveLength(1);
  });
});
