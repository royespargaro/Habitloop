import type { AppData, Habit, HabitLog } from '../types';

// Preserve the existing key so current data survives the InPursuit rebrand.
const STORAGE_KEY = 'habitloop.execution.v2';
const LEGACY_KEY = 'habitmatrix.v1';

const id = () => globalThis.crypto?.randomUUID?.() ?? `hl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

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

export function migrateLegacyData(value: unknown): Partial<AppData> {
  if (!value || typeof value !== 'object') return {};
  const parsed = value as Record<string, unknown>, now = new Date().toISOString();
  const habits: Habit[] = Array.isArray(parsed.habits) ? parsed.habits.filter((h): h is Record<string, unknown> => !!h && typeof h === 'object' && typeof (h as Record<string, unknown>).name === 'string').map(h => ({ id: String(h.id || id()), name: String(h.name), frequency: 'daily' as const, active: true, createdAt: typeof h.createdAt === 'string' ? h.createdAt : now })) : [];
  const logs: HabitLog[] = [], monthPattern = /^(\d{4})-(\d{1,2})$/;
  const addMonth = (key: string, grouped: unknown) => {
    const m = monthPattern.exec(key);
    if (!m || !grouped || typeof grouped !== 'object') return;
    const year = Number(m[1]), month = Number(m[2]);
    if (month < 1 || month > 12) return;
    for (const [habitId, values] of Object.entries(grouped as Record<string, unknown>)) {
      const entries: Array<[string, unknown]> = Array.isArray(values) ? values.map(d => [String(d), 'done']) : values && typeof values === 'object' ? Object.entries(values as Record<string, unknown>) : [];
      for (const [dayKey, raw] of entries) {
        const day = Number(dayKey), date = new Date(Date.UTC(year, month - 1, day));
        if (!Number.isInteger(day) || day < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) continue;
        const status = raw === 'skipped' ? 'skipped' : (raw === 'done' || raw === true || raw === 1 ? 'done' : null);
        if (status) logs.push({ id: id(), habitId: String(habitId), date: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`, status });
      }
    }
  };
  if (parsed.checks && typeof parsed.checks === 'object') for (const [key, nested] of Object.entries(parsed.checks as Record<string, unknown>)) {
    if (monthPattern.test(key)) addMonth(key, nested);
    else if (nested && typeof nested === 'object') for (const [monthKey, days] of Object.entries(nested as Record<string, unknown>)) if (monthPattern.test(monthKey)) addMonth(monthKey, { [key]: days });
  }
  return { habits: habits.length ? habits : undefined, habitLogs: [...new Map(logs.map(log => [`${log.habitId}:${log.date}`, log])).values()] };
}
function migrateLegacy(): Partial<AppData> {
  try { const raw = localStorage.getItem(LEGACY_KEY); return raw ? migrateLegacyData(JSON.parse(raw)) : {}; } catch { return {}; }
}
export function isValidAppData(value: unknown): value is AppData {
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
      if (isValidAppData(parsed)) return parsed;
    }
  } catch {
    // A malformed local copy should not prevent the app from opening.
  }
  const defaults = createDefaultData();
  const legacy = migrateLegacy();
  const migrated = { ...defaults, ...legacy };
  saveData(migrated);
  return migrated;
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportData(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `inpursuit-backup-${today()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importData(file: File): Promise<AppData> {
  const parsed: unknown = JSON.parse(await file.text());
  if (!isValidAppData(parsed)) throw new Error('This file is not a valid InPursuit backup.');
  return parsed;
}
