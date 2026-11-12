import type {
  AppData,
  BackupEnvelope,
  DailyPlan,
  DailyReview,
  Habit,
  HabitLog,
  LifeArea,
  Priority,
  Status,
  SyncMeta,
  TaskStatus,
  WorkspaceSummary,
} from '../types';
import { localDateKey } from '../utils/habitUtils';

const STORAGE_KEY = 'habitloop.execution.v2';
const LEGACY_KEY = 'habitmatrix.v1';
const RECOVERY_KEY = `${STORAGE_KEY}.recovery`;
const ACCOUNT_KEY_PREFIX = 'inpursuit.account.v3.';
const SYNC_META_PREFIX = 'inpursuit.syncmeta.v3.';
let recoveryNotice = '';

export const WORKSPACE_LIMITS = {
  lifeAreas: 50,
  goals: 200,
  projects: 200,
  tasks: 1000,
  habits: 100,
  habitLogs: 10000,
  dailyPlans: 1000,
  dailyReviews: 1000,
} as const;

const STARTER_HABIT_NAMES = [
  'Wake up on time',
  'Prayer / spiritual practice',
  'Move my body',
  'Deep work',
  'Read / learn',
  'Sleep on time',
] as const;

const id = () => globalThis.crypto?.randomUUID?.() ?? `hl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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
  const starterHabits: Habit[] = STARTER_HABIT_NAMES.map(name => ({
    id: id(),
    name,
    frequency: 'daily',
    active: true,
    createdAt: now,
  }));
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
      ? parsed.habits
          .filter((habit): habit is Record<string, unknown> => isRecord(habit) && isString(habit.name) && habit.name.trim().length > 0)
          .map(habit => ({
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
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.title) &&
    isString(value.outcome) &&
    isString(value.targetDate) &&
    isStatus(value.status) &&
    isString(value.createdAt) &&
    (allowMissingLifeArea ? value.lifeAreaId === undefined || isNullableString(value.lifeAreaId) : isNullableString(value.lifeAreaId))
  );
}

function isProject(value: unknown): value is AppData['projects'][number] {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isNullableString(value.goalId) &&
    isString(value.title) &&
    isString(value.description) &&
    isString(value.dueDate) &&
    isStatus(value.status) &&
    isString(value.createdAt)
  );
}

function isTask(value: unknown): value is AppData['tasks'][number] {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isNullableString(value.projectId) &&
    isString(value.title) &&
    isString(value.dueDate) &&
    isPriority(value.priority) &&
    isTaskStatus(value.status) &&
    isString(value.createdAt) &&
    isNullableString(value.completedAt)
  );
}

function isHabit(value: unknown): value is Habit {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    (value.frequency === 'daily' || value.frequency === 'weekdays' || value.frequency === 'weekends') &&
    typeof value.active === 'boolean' &&
    isString(value.createdAt)
  );
}

function isHabitLog(value: unknown): value is HabitLog {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.habitId) &&
    isString(value.date) &&
    (value.status === 'done' || value.status === 'skipped')
  );
}

function isDailyPlan(value: unknown): value is DailyPlan {
  return isRecord(value) && isString(value.date) && Array.isArray(value.priorityTaskIds) && value.priorityTaskIds.every(isString);
}

function isDailyReview(value: unknown): value is DailyReview {
  return (
    isRecord(value) &&
    isString(value.date) &&
    isString(value.wins) &&
    isString(value.blockers) &&
    isString(value.notes) &&
    Number.isInteger(value.energy) &&
    Number(value.energy) >= 1 &&
    Number(value.energy) <= 5
  );
}

function isValidData(value: unknown): value is StoredAppData {
  if (!isRecord(value) || (value.schemaVersion !== 2 && value.schemaVersion !== 3)) return false;
  const isV2 = value.schemaVersion === 2;
  return (
    (isV2 || (Array.isArray(value.lifeAreas) && value.lifeAreas.every(isLifeArea))) &&
    Array.isArray(value.goals) &&
    value.goals.every(goal => isGoal(goal, isV2)) &&
    Array.isArray(value.projects) &&
    value.projects.every(isProject) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isTask) &&
    Array.isArray(value.habits) &&
    value.habits.every(isHabit) &&
    Array.isArray(value.habitLogs) &&
    value.habitLogs.every(isHabitLog) &&
    Array.isArray(value.dailyPlans) &&
    value.dailyPlans.every(isDailyPlan) &&
    Array.isArray(value.dailyReviews) &&
    value.dailyReviews.every(isDailyReview) &&
    (value.updatedAt === undefined || isString(value.updatedAt))
  );
}

export const isValidAppData = (value: unknown): value is AppData => isValidData(value) && value.schemaVersion === 3;

function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function sanitizeAppData(data: AppData): AppData {
  const lifeAreas = dedupeById(data.lifeAreas).slice(0, WORKSPACE_LIMITS.lifeAreas);
  const lifeAreaIds = new Set(lifeAreas.map(a => a.id));

  const goals = dedupeById(data.goals)
    .slice(0, WORKSPACE_LIMITS.goals)
    .map(goal => ({
      ...goal,
      lifeAreaId: goal.lifeAreaId && lifeAreaIds.has(goal.lifeAreaId) ? goal.lifeAreaId : null,
    }));
  const goalIds = new Set(goals.map(g => g.id));

  const projects = dedupeById(data.projects)
    .slice(0, WORKSPACE_LIMITS.projects)
    .map(project => ({
      ...project,
      goalId: project.goalId && goalIds.has(project.goalId) ? project.goalId : null,
    }));
  const projectIds = new Set(projects.map(p => p.id));

  const tasks = dedupeById(data.tasks)
    .slice(0, WORKSPACE_LIMITS.tasks)
    .map(task => ({
      ...task,
      projectId: task.projectId && projectIds.has(task.projectId) ? task.projectId : null,
    }));
  const taskIds = new Set(tasks.map(t => t.id));

  const habits = dedupeById(data.habits).slice(0, WORKSPACE_LIMITS.habits);
  const habitIds = new Set(habits.map(h => h.id));

  const seenLogs = new Set<string>();
  const habitLogs: HabitLog[] = [];
  for (const log of data.habitLogs) {
    if (!habitIds.has(log.habitId)) continue;
    const key = `${log.habitId}:${log.date}`;
    if (seenLogs.has(key)) continue;
    seenLogs.add(key);
    habitLogs.push(log);
    if (habitLogs.length >= WORKSPACE_LIMITS.habitLogs) break;
  }

  const planByDate = new Map<string, DailyPlan>();
  for (const plan of data.dailyPlans) {
    const validIds: string[] = [];
    const seenIds = new Set<string>();
    for (const taskId of plan.priorityTaskIds) {
      if (taskIds.has(taskId) && !seenIds.has(taskId)) {
        seenIds.add(taskId);
        validIds.push(taskId);
      }
      if (validIds.length >= 3) break;
    }
    planByDate.set(plan.date, { date: plan.date, priorityTaskIds: validIds });
  }
  const dailyPlans = [...planByDate.values()].slice(-WORKSPACE_LIMITS.dailyPlans);

  const reviewByDate = new Map<string, DailyReview>();
  for (const review of data.dailyReviews) {
    const existing = reviewByDate.get(review.date);
    const hasText = Boolean(review.wins.trim() || review.blockers.trim() || review.notes.trim());
    if (!existing || hasText) {
      reviewByDate.set(review.date, {
        ...review,
        energy: Math.min(5, Math.max(1, Math.round(review.energy))),
      });
    }
  }
  const dailyReviews = [...reviewByDate.values()].slice(-WORKSPACE_LIMITS.dailyReviews);

  const normalized: AppData = {
    schemaVersion: 3,
    lifeAreas,
    goals,
    projects,
    tasks,
    habits,
    habitLogs,
    dailyPlans,
    dailyReviews,
  };
  if (typeof data.updatedAt === 'string' && data.updatedAt) {
    normalized.updatedAt = data.updatedAt.slice(0, 40);
  }
  return normalized;
}

export function normalizeStoredData(data: StoredAppData): AppData {
  const upgraded: AppData = {
    ...data,
    schemaVersion: 3,
    lifeAreas: data.schemaVersion === 3 ? (data.lifeAreas as LifeArea[]) : createDefaultLifeAreas(),
    goals: data.goals.map(goal => ({ ...goal, lifeAreaId: goal.lifeAreaId ?? null })),
  };
  return sanitizeAppData(upgraded);
}

export function normalizeRemoteOrNull(value: unknown): AppData | null {
  if (!isValidData(value)) return null;
  return normalizeStoredData(value);
}

function preserveForRecovery(raw: string, recoveryKey = RECOVERY_KEY): void {
  try {
    localStorage.setItem(recoveryKey, raw);
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
        if (isValidData(parsed)) return normalizeStoredData(parsed);
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
  return sanitizeAppData({ ...defaults, ...legacy });
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeAppData(data)));
}

export function loadAccountData(uid: string): AppData | null {
  try {
    const key = `${ACCOUNT_KEY_PREFIX}${uid}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isValidData(parsed)) return normalizeStoredData(parsed);
    } catch {
      // Preserve invalid account cache before returning null.
    }
    preserveForRecovery(raw, `${key}.recovery`);
    return null;
  } catch {
    return null;
  }
}

export function saveAccountData(uid: string, data: AppData): void {
  localStorage.setItem(`${ACCOUNT_KEY_PREFIX}${uid}`, JSON.stringify(sanitizeAppData(data)));
}

export function loadSyncMeta(uid: string): SyncMeta {
  try {
    const raw = localStorage.getItem(`${SYNC_META_PREFIX}${uid}`);
    if (!raw) return { pendingSync: false, lastSyncedAt: null };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { pendingSync: false, lastSyncedAt: null };
    return {
      pendingSync: parsed.pendingSync === true,
      lastSyncedAt: isString(parsed.lastSyncedAt) ? parsed.lastSyncedAt : null,
    };
  } catch {
    return { pendingSync: false, lastSyncedAt: null };
  }
}

export function saveSyncMeta(uid: string, meta: SyncMeta): void {
  try {
    localStorage.setItem(`${SYNC_META_PREFIX}${uid}`, JSON.stringify(meta));
  } catch {
    // Best-effort sync metadata persistence.
  }
}

export function summarizeWorkspace(data: AppData): WorkspaceSummary {
  return {
    lifeAreas: data.lifeAreas.length,
    goals: data.goals.length,
    projects: data.projects.length,
    tasks: data.tasks.length,
    habits: data.habits.length,
    habitLogs: data.habitLogs.length,
    dailyReviews: data.dailyReviews.length,
    updatedAt: data.updatedAt,
  };
}

export function hasMeaningfulWorkspaceData(data: AppData): boolean {
  if (
    data.goals.length > 0 ||
    data.projects.length > 0 ||
    data.tasks.length > 0 ||
    data.habitLogs.length > 0 ||
    data.dailyPlans.length > 0 ||
    data.dailyReviews.length > 0
  ) {
    return true;
  }
  const starterSet = new Set<string>(STARTER_HABIT_NAMES);
  if (data.habits.length !== starterSet.size) return true;
  return data.habits.some(h => !starterSet.has(h.name));
}

export function mergeWorkspaceData(cloud: AppData, local: AppData): AppData {
  const keyOf = (s: string) => s.trim().toLocaleLowerCase();

  const lifeAreas = [...cloud.lifeAreas];
  const areaByName = new Map(lifeAreas.map(a => [keyOf(a.name), a.id]));
  const areaIdMap = new Map<string, string>();
  for (const area of local.lifeAreas) {
    const existingId = areaByName.get(keyOf(area.name)) ?? lifeAreas.find(a => a.id === area.id)?.id;
    if (existingId) {
      areaIdMap.set(area.id, existingId);
    } else {
      lifeAreas.push(area);
      areaByName.set(keyOf(area.name), area.id);
      areaIdMap.set(area.id, area.id);
    }
  }

  const goals = [...cloud.goals];
  const goalByTitle = new Map(goals.map(g => [keyOf(g.title), g.id]));
  const goalIdMap = new Map<string, string>();
  for (const goal of local.goals) {
    const existingId = goalByTitle.get(keyOf(goal.title)) ?? goals.find(g => g.id === goal.id)?.id;
    if (existingId) {
      goalIdMap.set(goal.id, existingId);
    } else {
      goals.push({
        ...goal,
        lifeAreaId: goal.lifeAreaId ? (areaIdMap.get(goal.lifeAreaId) ?? goal.lifeAreaId) : null,
      });
      goalByTitle.set(keyOf(goal.title), goal.id);
      goalIdMap.set(goal.id, goal.id);
    }
  }

  const projects = [...cloud.projects];
  const projectByTitle = new Map(projects.map(p => [keyOf(p.title), p.id]));
  const projectIdMap = new Map<string, string>();
  for (const project of local.projects) {
    const existingId = projectByTitle.get(keyOf(project.title)) ?? projects.find(p => p.id === project.id)?.id;
    if (existingId) {
      projectIdMap.set(project.id, existingId);
    } else {
      projects.push({
        ...project,
        goalId: project.goalId ? (goalIdMap.get(project.goalId) ?? project.goalId) : null,
      });
      projectByTitle.set(keyOf(project.title), project.id);
      projectIdMap.set(project.id, project.id);
    }
  }

  const tasks = [...cloud.tasks];
  const taskIdSet = new Set(tasks.map(t => t.id));
  const taskSigSet = new Set(tasks.map(t => `${keyOf(t.title)}:${t.projectId ?? ''}:${t.dueDate}`));
  const taskIdMap = new Map<string, string>();
  for (const task of local.tasks) {
    const mappedProjectId = task.projectId ? (projectIdMap.get(task.projectId) ?? task.projectId) : null;
    const sig = `${keyOf(task.title)}:${mappedProjectId ?? ''}:${task.dueDate}`;
    if (taskIdSet.has(task.id) || taskSigSet.has(sig)) {
      const matched = tasks.find(t => t.id === task.id || `${keyOf(t.title)}:${t.projectId ?? ''}:${t.dueDate}` === sig);
      if (matched) taskIdMap.set(task.id, matched.id);
    } else {
      tasks.push({ ...task, projectId: mappedProjectId });
      taskIdSet.add(task.id);
      taskSigSet.add(sig);
      taskIdMap.set(task.id, task.id);
    }
  }

  const habits = [...cloud.habits];
  const habitByName = new Map(habits.map(h => [keyOf(h.name), h.id]));
  const habitIdMap = new Map<string, string>();
  for (const habit of local.habits) {
    const existingId = habitByName.get(keyOf(habit.name)) ?? habits.find(h => h.id === habit.id)?.id;
    if (existingId) {
      habitIdMap.set(habit.id, existingId);
    } else {
      habits.push(habit);
      habitByName.set(keyOf(habit.name), habit.id);
      habitIdMap.set(habit.id, habit.id);
    }
  }

  const habitLogs = [...cloud.habitLogs];
  const logKeys = new Set(habitLogs.map(l => `${l.habitId}:${l.date}`));
  for (const log of local.habitLogs) {
    const mappedHabitId = habitIdMap.get(log.habitId) ?? log.habitId;
    const key = `${mappedHabitId}:${log.date}`;
    if (!logKeys.has(key)) {
      habitLogs.push({ ...log, habitId: mappedHabitId });
      logKeys.add(key);
    }
  }

  const planMap = new Map(cloud.dailyPlans.map(p => [p.date, p]));
  for (const plan of local.dailyPlans) {
    const existing = planMap.get(plan.date);
    const mappedIds = plan.priorityTaskIds.map(tid => taskIdMap.get(tid) ?? tid);
    if (!existing) {
      planMap.set(plan.date, { date: plan.date, priorityTaskIds: mappedIds.slice(0, 3) });
    } else {
      const mergedIds = [...new Set([...existing.priorityTaskIds, ...mappedIds])].slice(0, 3);
      planMap.set(plan.date, { date: plan.date, priorityTaskIds: mergedIds });
    }
  }

  const reviewMap = new Map(cloud.dailyReviews.map(r => [r.date, r]));
  for (const review of local.dailyReviews) {
    if (!reviewMap.has(review.date)) reviewMap.set(review.date, review);
  }

  return sanitizeAppData({
    schemaVersion: 3,
    lifeAreas,
    goals,
    projects,
    tasks,
    habits,
    habitLogs,
    dailyPlans: [...planMap.values()],
    dailyReviews: [...reviewMap.values()],
    updatedAt: new Date().toISOString(),
  });
}

export function buildBackupEnvelope(data: AppData): BackupEnvelope {
  return {
    format: 'inpursuit-backup',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    data: sanitizeAppData(data),
  };
}

export function exportData(data: AppData): void {
  const envelope = buildBackupEnvelope(data);
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `inpursuit-backup-${localDateKey()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface ParsedBackup {
  data: AppData;
  exportedAt: string | null;
  backupVersion: number | null;
  summary: WorkspaceSummary;
}

export function inspectBackupText(rawText: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('This backup is not valid JSON.');
  }

  let candidate: unknown = parsed;
  let exportedAt: string | null = null;
  let backupVersion: number | null = null;

  if (isRecord(parsed) && parsed.format === 'inpursuit-backup') {
    if (typeof parsed.backupVersion !== 'number' || parsed.backupVersion > 1) {
      throw new Error(`This backup format (v${String(parsed.backupVersion)}) is newer than this version of InPursuit.`);
    }
    backupVersion = parsed.backupVersion;
    exportedAt = isString(parsed.exportedAt) ? parsed.exportedAt : null;
    candidate = parsed.data;
  }

  if (isRecord(candidate) && typeof candidate.schemaVersion === 'number' && candidate.schemaVersion > 3) {
    throw new Error(`This backup uses workspace schema v${candidate.schemaVersion}, which is not compatible with this version of InPursuit.`);
  }

  if (!isValidData(candidate)) {
    throw new Error('This file is not a valid InPursuit backup.');
  }

  const normalized = normalizeStoredData(candidate);
  return {
    data: normalized,
    exportedAt,
    backupVersion,
    summary: summarizeWorkspace(normalized),
  };
}

export async function importData(file: File): Promise<AppData> {
  return inspectBackupText(await file.text()).data;
}
