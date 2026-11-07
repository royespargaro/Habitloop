import type { AppData, Habit, HabitLog } from '../types';

const STORAGE_KEY = 'habitloop.execution.v2';
const LEGACY_KEY = 'habitmatrix.v1';

const id = () => globalThis.crypto?.randomUUID?.() ?? `hl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const today = () => new Date().toISOString().slice(0, 10);

export const createId = id;

export function createDefaultData(): AppData {
  const now = new Date().toISOString();
  const starterHabits: Habit[] = [
    'Wake up on time',
    'Prayer / spiritual practice',
    'Move my body',
    'Deep work',
    'Read / learn',
    'Sleep on time',
  ].map(name => ({ id: id(), name, frequency: 'daily', active: true, createdAt: now }));
  return {
    schemaVersion: 2,
    goals: [],
    projects: [],
    tasks: [],
    habits: starterHabits,
    habitLogs: [],
    dailyPlans: [],
    dailyReviews: [],
  };
}

function migrateLegacy(): Partial<AppData> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const habits: Habit[] = Array.isArray(parsed.habits)
      ? parsed.habits.filter((h: any) => h && typeof h.name === 'string').map((h: any) => ({
          id: String(h.id || id()),
          name: h.name,
          frequency: 'daily' as const,
          active: true,
          createdAt: new Date().toISOString(),
        }))
      : [];
    const logs: HabitLog[] = [];
    if (parsed.checks && typeof parsed.checks === 'object') {
      for (const [habitId, months] of Object.entries(parsed.checks as Record<string, any>)) {
        if (!months || typeof months !== 'object') continue;
        for (const [monthKey, days] of Object.entries(months as Record<string, unknown>)) {
          if (!Array.isArray(days)) continue;
          const match = /^(\d{4})-(\d{1,2})$/.exec(monthKey);
          if (!match) continue;
          for (const day of days) {
            const n = Number(day);
            if (Number.isInteger(n) && n >= 1 && n <= 31) {
              const date = `${match[1]}-${match[2].padStart(2, '0')}-${String(n).padStart(2, '0')}`;
              logs.push({ id: id(), habitId: String(habitId), date, status: 'done' });
            }
          }
        }
      }
    }
    return { habits: habits.length ? habits : undefined, habitLogs: logs };
  } catch {
    return {};
  }
}

function isValidData(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false;
  const data = value as AppData;
  return data.schemaVersion === 2 &&
    Array.isArray(data.goals) &&
    Array.isArray(data.projects) &&
    Array.isArray(data.tasks) &&
    Array.isArray(data.habits) &&
    Array.isArray(data.habitLogs) &&
    Array.isArray(data.dailyPlans) &&
    Array.isArray(data.dailyReviews);
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidData(parsed)) return parsed;
    }
  } catch {
    // A malformed local copy should not prevent the app from opening.
  }
  const defaults = createDefaultData();
  const legacy = migrateLegacy();
  return { ...defaults, ...legacy };
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportData(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `habitloop-backup-${today()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importData(file: File): Promise<AppData> {
  const parsed: unknown = JSON.parse(await file.text());
  if (!isValidData(parsed)) throw new Error('This file is not a valid Habitloop backup.');
  return parsed;
}
