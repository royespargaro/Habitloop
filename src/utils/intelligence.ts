import type { AppData, Goal, Habit, HabitLog, Project, Task } from '../types';
import { isHabitScheduledOnDate, localDateKey, shiftDateKey } from './habitUtils';

export interface GoalProgress {
  percent: number;
  linkedProjects: number;
  completedProjects: number;
  totalTasks: number;
  completedTasks: number;
}

export interface HabitConsistency {
  completed: number;
  scheduled: number;
  skipped: number;
  rate: number;
}

export interface NeglectedProjectInfo {
  project: Project;
  reason: 'no-tasks' | 'stalled';
  daysIdle: number;
}

export interface WeeklyReflectionSummary {
  weekStart: string;
  weekEnd: string;
  priorityPlanned: number;
  priorityDone: number;
  tasksDone: number;
  tasksTotal: number;
  overdueCount: number;
  habitDone: number;
  habitScheduled: number;
  habitRate: number;
  advancingProjects: Array<{ project: Project; completedThisWeek: number }>;
  neglectedProjects: NeglectedProjectInfo[];
  reviewsWritten: number;
}

const isoDateDay = (isoOrDate: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return localDateKey(parsed);
};

export function getGoalProgress(goal: Goal, projects: readonly Project[], tasks: readonly Task[]): GoalProgress {
  const linked = projects.filter(p => p.goalId === goal.id);
  if (linked.length === 0) {
    return { percent: goal.status === 'completed' ? 100 : 0, linkedProjects: 0, completedProjects: 0, totalTasks: 0, completedTasks: 0 };
  }

  let weightSum = 0;
  let completedProjects = 0;
  let totalTasks = 0;
  let completedTasks = 0;

  for (const project of linked) {
    const projectTasks = tasks.filter(t => t.projectId === project.id && t.status !== 'skipped');
    const doneCount = projectTasks.filter(t => t.status === 'done').length;
    totalTasks += projectTasks.length;
    completedTasks += doneCount;

    if (project.status === 'completed') {
      completedProjects += 1;
      weightSum += 1;
    } else if (projectTasks.length > 0) {
      weightSum += doneCount / projectTasks.length;
    }
  }

  return {
    percent: Math.round((weightSum / linked.length) * 100),
    linkedProjects: linked.length,
    completedProjects,
    totalTasks,
    completedTasks,
  };
}

export function getHabitConsistency(habit: Habit, logs: readonly HabitLog[], days: number, now = new Date()): HabitConsistency {
  const todayStr = localDateKey(now);
  const createdDay = habit.createdAt ? isoDateDay(habit.createdAt) : '';
  const logMap = new Map(logs.filter(l => l.habitId === habit.id).map(l => [l.date, l.status]));

  let scheduled = 0;
  let completed = 0;
  let skipped = 0;

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = shiftDateKey(todayStr, -offset);
    if (createdDay && date < createdDay && !logMap.has(date)) continue;
    if (!isHabitScheduledOnDate(habit, date)) continue;

    const status = logMap.get(date);
    if (status === 'skipped') {
      skipped += 1;
      continue;
    }
    scheduled += 1;
    if (status === 'done') completed += 1;
  }

  const rate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;
  return { completed, scheduled, skipped, rate };
}

export function getNeglectedProjects(
  projects: readonly Project[],
  tasks: readonly Task[],
  now = new Date(),
  staleDays = 7,
): NeglectedProjectInfo[] {
  const todayStr = localDateKey(now);
  const cutoffStr = shiftDateKey(todayStr, -staleDays);
  const todayMs = new Date(`${todayStr}T12:00:00`).getTime();

  const neglected: NeglectedProjectInfo[] = [];

  for (const project of projects) {
    if (project.status !== 'active') continue;
    const projectCreatedDay = project.createdAt ? isoDateDay(project.createdAt) : '';
    if (projectCreatedDay && projectCreatedDay > cutoffStr) continue;

    const projectTasks = tasks.filter(t => t.projectId === project.id);
    if (projectTasks.length === 0) {
      const daysIdle = projectCreatedDay
        ? Math.max(staleDays, Math.round((todayMs - new Date(`${projectCreatedDay}T12:00:00`).getTime()) / 86_400_000))
        : staleDays;
      neglected.push({ project, reason: 'no-tasks', daysIdle });
      continue;
    }

    let latestActivityDay = projectCreatedDay;
    for (const task of projectTasks) {
      const createdDay = task.createdAt ? isoDateDay(task.createdAt) : '';
      const completedDay = task.completedAt ? isoDateDay(task.completedAt) : '';
      if (createdDay && createdDay > latestActivityDay) latestActivityDay = createdDay;
      if (completedDay && completedDay > latestActivityDay) latestActivityDay = completedDay;
    }

    const hasRecentCompletion = projectTasks.some(t => t.status === 'done' && t.completedAt && isoDateDay(t.completedAt) >= cutoffStr);
    const hasRecentTask = projectTasks.some(t => t.createdAt && isoDateDay(t.createdAt) >= cutoffStr);

    if (!hasRecentCompletion && !hasRecentTask && latestActivityDay <= cutoffStr) {
      const daysIdle = latestActivityDay
        ? Math.max(staleDays, Math.round((todayMs - new Date(`${latestActivityDay}T12:00:00`).getTime()) / 86_400_000))
        : staleDays;
      neglected.push({ project, reason: 'stalled', daysIdle });
    }
  }

  return neglected.sort((a, b) => b.daysIdle - a.daysIdle);
}

export function getWeeklyReflectionSummary(data: AppData, today: string, now = new Date()): WeeklyReflectionSummary {
  const baseDate = new Date(`${today}T12:00:00`);
  const mondayOffset = (baseDate.getDay() + 6) % 7;
  const weekDates = Array.from({ length: 7 }, (_, i) => shiftDateKey(today, i - mondayOffset));
  const weekElapsed = weekDates.filter(d => d <= today);
  const weekSet = new Set(weekElapsed);

  const taskById = new Map(data.tasks.map(t => [t.id, t]));

  let priorityPlanned = 0;
  let priorityDone = 0;
  for (const plan of data.dailyPlans) {
    if (!weekSet.has(plan.date)) continue;
    for (const id of plan.priorityTaskIds) {
      const task = taskById.get(id);
      if (!task || task.status === 'skipped') continue;
      priorityPlanned += 1;
      if (task.status === 'done') priorityDone += 1;
    }
  }

  const weekTasks = data.tasks.filter(t => weekSet.has(t.dueDate) && t.status !== 'skipped');
  const tasksDone = weekTasks.filter(t => t.status === 'done').length;
  const overdueCount = data.tasks.filter(t => t.status === 'todo' && t.dueDate !== '' && t.dueDate < today).length;

  let habitScheduled = 0;
  let habitDone = 0;
  const logSet = new Map<string, 'done' | 'skipped'>(
    data.habitLogs.map(l => [`${l.habitId}:${l.date}`, l.status]),
  );

  for (const habit of data.habits) {
    if (!habit.active) continue;
    const createdDay = habit.createdAt ? isoDateDay(habit.createdAt) : '';
    for (const date of weekElapsed) {
      if (createdDay && date < createdDay && !logSet.has(`${habit.id}:${date}`)) continue;
      if (!isHabitScheduledOnDate(habit, date)) continue;
      const status = logSet.get(`${habit.id}:${date}`);
      if (status === 'skipped') continue;
      habitScheduled += 1;
      if (status === 'done') habitDone += 1;
    }
  }

  const habitRate = habitScheduled > 0 ? Math.round((habitDone / habitScheduled) * 100) : 0;

  const projectById = new Map(data.projects.map(p => [p.id, p]));
  const projectCompletions = new Map<string, number>();
  for (const task of data.tasks) {
    if (task.status !== 'done' || !task.projectId || !task.completedAt) continue;
    const doneDay = isoDateDay(task.completedAt);
    if (!weekSet.has(doneDay)) continue;
    projectCompletions.set(task.projectId, (projectCompletions.get(task.projectId) ?? 0) + 1);
  }
  const advancingProjects = [...projectCompletions.entries()]
    .map(([projectId, completedThisWeek]) => ({ project: projectById.get(projectId), completedThisWeek }))
    .filter((entry): entry is { project: Project; completedThisWeek: number } => !!entry.project)
    .sort((a, b) => b.completedThisWeek - a.completedThisWeek);

  const neglectedProjects = getNeglectedProjects(data.projects, data.tasks, now, 7);
  const reviewsWritten = data.dailyReviews.filter(
    r => weekSet.has(r.date) && Boolean(r.wins.trim() || r.blockers.trim() || r.notes.trim()),
  ).length;

  return {
    weekStart: weekDates[0],
    weekEnd: weekDates[6],
    priorityPlanned,
    priorityDone,
    tasksDone,
    tasksTotal: weekTasks.length,
    overdueCount,
    habitDone,
    habitScheduled,
    habitRate,
    advancingProjects,
    neglectedProjects,
    reviewsWritten,
  };
}
