import type { AppData, Habit, HabitLog, LifeArea, Priority, Status, TaskStatus } from '../types';

const STORAGE_KEY = 'habitloop.execution.v2';
const LEGACY_KEY = 'habitmatrix.v1';
const RECOVERY_KEY = `${STORAGE_KEY}.recovery`;
let recoveryNotice = '';

const id = () => globalThis.crypto?.randomUUID?.() ?? `hl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const today = () => new Date().toISOString().slice(0, 10);

export const createId = id;

export function consumeLoadWarning(): string {
  const notice = recoveryNotice;
  recoveryNotice = '';
  return notice;
}

function createDefaultLifeAreas(): LifeArea[] {
  const now = new Date().toISOString();
  return [
    { name: 'Career', description: 'Professional growth and meaningful work.' },
    { name: 'Business', description: 'Build and operate durable ventures.' },
    { name: 'Education', description: 'Learning, research, and academic milestones.' },
    { name: 'Wealth', description: 'Financial resilience and long-term assets.' },
    { name: 'Health', description: 'Physical and mental wellbeing.' },
  ].map(area => ({ id: id(), ...area, createdAt: now }));
}

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
    schemaVersion: 3,
    lifeAreas: createDefaultLifeAreas(),
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
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const createdAt = new Date().toISOString();
    const habits: Habit[] = Array.isArray(parsed.habits)
      ? parsed.habits.filter((habit): habit is Record<string, unknown> => isRecord(habit) && isString(habit.name) && habit.name.trim().length > 0).map(habit => ({
          id: isString(habit.id) && habit.id ? habit.id : id(),
          name: (habit.name as string).trim(),
          frequency: 'daily' as const,
          active: true,
          createdAt,
        }))
      : [];
    const logs: HabitLog[] = [];
    if (isRecord(parsed.checks)) {
      for (const [habitId, months] of Object.entries(parsed.checks)) {
        if (!isRecord(months)) continue;
        for (const [monthKey, days] of Object.entries(months)) {
          if (!Array.isArray(days)) continue;
          const match = /^(\d{4})-(\d{1,2})$/.exec(monthKey);
          if (!match) continue;
          const month = Number(match[2]);
          if (month < 1 || month > 12) continue;
          const monthEnd = new Date(0);
          monthEnd.setUTCFullYear(Number(match[1]), month, 0);
          const daysInMonth = monthEnd.getUTCDate();
          for (const day of days) {
            const n = typeof day === 'number' || typeof day === 'string' ? Number(day) : Number.NaN;
            if (Number.isInteger(n) && n >= 1 && n <= daysInMonth) {
              const date = `${match[1]}-${match[2].padStart(2, '0')}-${String(n).padStart(2, '0')}`;
              logs.push({ id: id(), habitId: String(habitId), date, status: 'done' });
            }
          }
        }
      }
    }
    return { ...(habits.length ? { habits } : {}), habitLogs: logs };
  } catch {
    return {};
  }
}

type StoredGoal = Omit<AppData['goals'][number], 'lifeAreaId'> & { lifeAreaId?: string | null };
type StoredAppData = Omit<AppData, 'schemaVersion' | 'lifeAreas' | 'goals'> & {
  schemaVersion: 2 | 3;
  lifeAreas?: unknown[];
  goals: StoredGoal[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
const isStatus = (value: unknown): value is Status => value === 'active' || value === 'completed' || value === 'archived';
const isTaskStatus = (value: unknown): value is TaskStatus => value === 'todo' || value === 'done' || value === 'skipped';
const isPriority = (value: unknown): value is Priority => value === 'high' || value === 'medium' || value === 'low';

function isLifeArea(value: unknown): value is LifeArea {
  return isRecord(value) && isString(value.id) && isString(value.name) && isString(value.description) && isString(value.createdAt);
}

function isGoal(value: unknown, allowMissingLifeArea: boolean): value is StoredGoal {
  return isRecord(value) && isString(value.id) && isString(value.title) && isString(value.outcome) &&
    isString(value.targetDate) && isStatus(value.status) && isString(value.createdAt) &&
    (allowMissingLifeArea ? value.lifeAreaId === undefined || isNullableString(value.lifeAreaId) : isNullableString(value.lifeAreaId));
}

function isProject(value: unknown): value is AppData['projects'][number] {
  return isRecord(value) && isString(value.id) && isNullableString(value.goalId) && isString(value.title) &&
    isString(value.description) && isString(value.dueDate) && isStatus(value.status) && isString(value.createdAt);
}

function isTask(value: unknown): value is AppData['tasks'][number] {
  return isRecord(value) && isString(value.id) && isNullableString(value.projectId) && isString(value.title) &&
    isString(value.dueDate) && isPriority(value.priority) && isTaskStatus(value.status) &&
    isString(value.createdAt) && isNullableString(value.completedAt);
}

function isHabit(value: unknown): value is Habit {
  return isRecord(value) && isString(value.id) && isString(value.name) &&
    (value.frequency === 'daily' || value.frequency === 'weekdays' || value.frequency === 'weekends') &&
    typeof value.active === 'boolean' && isString(value.createdAt);
}

function isHabitLog(value: unknown): value is HabitLog {
  return isRecord(value) && isString(value.id) && isString(value.habitId) && isString(value.date) &&
    (value.status === 'done' || value.status === 'skipped');
}

function isDailyPlan(value: unknown): value is AppData['dailyPlans'][number] {
  return isRecord(value) && isString(value.date) && Array.isArray(value.priorityTaskIds) && value.priorityTaskIds.every(isString);
}

function isDailyReview(value: unknown): value is AppData['dailyReviews'][number] {
  return isRecord(value) && isString(value.date) && isString(value.wins) && isString(value.blockers) &&
    isString(value.notes) && Number.isInteger(value.energy) && Number(value.energy) >= 1 && Number(value.energy) <= 5;
}

export function isValidAppData(value: unknown): value is StoredAppData {
  if (!isRecord(value) || (value.schemaVersion !== 2 && value.schemaVersion !== 3)) return false;
  const isV2 = value.schemaVersion === 2;
  return (isV2 || (Array.isArray(value.lifeAreas) && value.lifeAreas.every(isLifeArea))) &&
    Array.isArray(value.goals) && value.goals.every(goal => isGoal(goal, isV2)) &&
    Array.isArray(value.projects) && value.projects.every(isProject) &&
    Array.isArray(value.tasks) && value.tasks.every(isTask) &&
    Array.isArray(value.habits) && value.habits.every(isHabit) &&
    Array.isArray(value.habitLogs) && value.habitLogs.every(isHabitLog) &&
    Array.isArray(value.dailyPlans) && value.dailyPlans.every(isDailyPlan) &&
    Array.isArray(value.dailyReviews) && value.dailyReviews.every(isDailyReview);
}

function normalizeData(data: StoredAppData): AppData {
  return {
    ...data,
    schemaVersion: 3,
    lifeAreas: data.schemaVersion === 3 ? data.lifeAreas as LifeArea[] : createDefaultLifeAreas(),
    goals: data.goals.map(goal => ({ ...goal, lifeAreaId: goal.lifeAreaId ?? null })),
  };
}

function preserveForRecovery(raw: string): void {
  try {
    localStorage.setItem(RECOVERY_KEY, raw);
    recoveryNotice = 'Saved data could not be read. A recovery copy was preserved in this browser; the app opened with safe defaults.';
  } catch {
    recoveryNotice = 'Saved data could not be read or preserved. The app opened with safe defaults; export data regularly.';
    console.warn('Could not preserve the previous InPursuit data for recovery.');
  }
}

export function loadData(): AppData {
  recoveryNotice = '';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isValidAppData(parsed)) return normalizeData(parsed);
      } catch {
        // Preserve invalid data before loading a clean default state.
      }
      preserveForRecovery(raw);
    }
  } catch {
    // Unavailable storage should not prevent the app from opening.
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
  anchor.download = `inpursuit-backup-${today()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function importData(file: File): Promise<AppData> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('This backup is not valid JSON.');
  }
  if (!isValidAppData(parsed)) throw new Error('This file is not a valid InPursuit backup.');
  return normalizeData(parsed);
}
