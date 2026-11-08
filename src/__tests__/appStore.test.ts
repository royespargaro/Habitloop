import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeLoadWarning, importData, loadData } from '../services/appStore';

const STORAGE_KEY = 'habitloop.execution.v2';
const LEGACY_KEY = 'habitmatrix.v1';
const validV3 = {
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

beforeEach(() => {
  consumeLoadWarning();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('app store schema migration', () => {
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
    vi.mocked(localStorage.getItem).mockImplementation(key => key === STORAGE_KEY ? JSON.stringify(legacyData) : null);

    const data = loadData();

    expect(data.schemaVersion).toBe(3);
    expect(data.lifeAreas.map(area => area.name)).toEqual(['Career', 'Business', 'Education', 'Wealth', 'Health']);
    expect(data.goals[0]).toMatchObject({ id: 'goal-1', title: 'Finish degree applications', lifeAreaId: null });
  });

  it('falls back to defaults when a nested v3 record is malformed', () => {
    const invalidData = { ...validV3, goals: [{ id: 'goal-without-required-fields' }] };
    vi.mocked(localStorage.getItem).mockImplementation(key => key === STORAGE_KEY ? JSON.stringify(invalidData) : null);

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
    vi.mocked(localStorage.getItem).mockImplementation(key => key === STORAGE_KEY ? raw : null);

    const data = loadData();

    expect(data.schemaVersion).toBe(3);
    expect(localStorage.setItem).toHaveBeenCalledWith(`${STORAGE_KEY}.recovery`, raw);
    expect(consumeLoadWarning()).toContain('recovery copy was preserved');
  });

  it('keeps starter habits when the legacy record contains no valid habits', () => {
    vi.mocked(localStorage.getItem).mockImplementation(key => key === LEGACY_KEY ? JSON.stringify({ habits: null, checks: {} }) : null);

    const data = loadData();

    expect(data.habits).toHaveLength(6);
    expect(data.habitLogs).toEqual([]);
  });

  it('ignores impossible calendar days during legacy migration', () => {
    const legacyData = {
      habits: [{ id: 'h1', name: 'Read' }],
      checks: { h1: { '2026-2': [28, 31] } },
    };
    vi.mocked(localStorage.getItem).mockImplementation(key => key === LEGACY_KEY ? JSON.stringify(legacyData) : null);

    const data = loadData();

    expect(data.habitLogs.map(log => log.date)).toEqual(['2026-02-28']);
  });
});
