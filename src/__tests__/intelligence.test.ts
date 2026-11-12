import { describe, expect, it } from 'vitest';
import type { AppData, Goal, Habit, HabitLog, Project, Task } from '../types';
import {
  getGoalProgress,
  getHabitConsistency,
  getNeglectedProjects,
  getWeeklyReflectionSummary,
} from '../utils/intelligence';

const makeGoal = (id: string, status: Goal['status'] = 'active'): Goal => ({
  id,
  lifeAreaId: null,
  title: `Goal ${id}`,
  outcome: 'Target outcome',
  targetDate: '2026-12-31',
  status,
  createdAt: '2026-10-01T00:00:00.000Z',
});

const makeProject = (id: string, goalId: string | null, status: Project['status'] = 'active', createdAt = '2026-10-01T00:00:00.000Z'): Project => ({
  id,
  goalId,
  title: `Project ${id}`,
  description: '',
  dueDate: '',
  status,
  createdAt,
});

const makeTask = (
  id: string,
  projectId: string | null,
  status: Task['status'],
  dueDate = '2026-11-12',
  createdAt = '2026-11-01T00:00:00.000Z',
  completedAt: string | null = null,
): Task => ({
  id,
  projectId,
  title: `Task ${id}`,
  dueDate,
  priority: 'medium',
  status,
  createdAt,
  completedAt,
});

describe('product intelligence utilities', () => {
  it('computes goal progress weighted by tasks inside linked projects', () => {
    const goal = makeGoal('g1');
    const projects = [makeProject('p1', 'g1', 'active'), makeProject('p2', 'g1', 'completed')];
    const tasks = [
      makeTask('t1', 'p1', 'done'),
      makeTask('t2', 'p1', 'todo'),
      makeTask('t3', 'p1', 'skipped'),
    ];

    // p1: 1/2 = 0.5, p2: completed = 1.0 -> average = 75%
    const progress = getGoalProgress(goal, projects, tasks);
    expect(progress.percent).toBe(75);
    expect(progress.linkedProjects).toBe(2);
    expect(progress.completedProjects).toBe(1);
    expect(progress.completedTasks).toBe(1);
    expect(progress.totalTasks).toBe(2);
  });

  it('respects habit schedules and excludes skipped days from adherence denominator', () => {
    const weekdayHabit: Habit = {
      id: 'h1',
      name: 'Deep work',
      frequency: 'weekdays',
      active: true,
      createdAt: '2026-11-02T00:00:00.000Z', // Monday
    };
    const logs: HabitLog[] = [
      { id: '1', habitId: 'h1', date: '2026-11-02', status: 'done' },
      { id: '2', habitId: 'h1', date: '2026-11-03', status: 'done' },
      { id: '3', habitId: 'h1', date: '2026-11-04', status: 'skipped' },
      { id: '4', habitId: 'h1', date: '2026-11-05', status: 'done' },
      // 2026-11-06 missed
      // 2026-11-07 Sat, 2026-11-08 Sun (not scheduled)
    ];

    // Evaluate across 7 days ending Sunday 2026-11-08
    const result = getHabitConsistency(weekdayHabit, logs, 7, new Date('2026-11-08T12:00:00'));
    expect(result.scheduled).toBe(4); // Mon, Tue, Thu, Fri (Wed skipped)
    expect(result.completed).toBe(3);
    expect(result.skipped).toBe(1);
    expect(result.rate).toBe(75);
  });

  it('detects neglected active projects with no tasks or stale activity', () => {
    const now = new Date('2026-11-12T12:00:00');
    const projects = [
      makeProject('empty-old', null, 'active', '2026-10-20T00:00:00.000Z'),
      makeProject('stalled', null, 'active', '2026-10-20T00:00:00.000Z'),
      makeProject('fresh-empty', null, 'active', '2026-11-10T00:00:00.000Z'),
      makeProject('active-moving', null, 'active', '2026-10-20T00:00:00.000Z'),
    ];
    const tasks = [
      makeTask('t1', 'stalled', 'todo', '2026-10-25', '2026-10-22T00:00:00.000Z'),
      makeTask('t2', 'active-moving', 'done', '2026-11-11', '2026-10-22T00:00:00.000Z', '2026-11-11T10:00:00.000Z'),
    ];

    const neglected = getNeglectedProjects(projects, tasks, now, 7);
    expect(neglected.map(n => [n.project.id, n.reason])).toEqual([
      ['empty-old', 'no-tasks'],
      ['stalled', 'stalled'],
    ]);
  });

  it('summarizes weekly reflection evidence accurately', () => {
    const today = '2026-11-12'; // Thursday
    const now = new Date(`${today}T12:00:00`);
    const data: AppData = {
      schemaVersion: 3,
      lifeAreas: [],
      goals: [makeGoal('g1')],
      projects: [makeProject('p1', 'g1', 'active', '2026-10-01T00:00:00.000Z')],
      tasks: [
        makeTask('t1', 'p1', 'done', '2026-11-10', '2026-11-01T00:00:00.000Z', '2026-11-10T15:00:00.000Z'),
        makeTask('t2', 'p1', 'todo', '2026-11-05', '2026-11-01T00:00:00.000Z'), // overdue
      ],
      habits: [{ id: 'h1', name: 'Read', frequency: 'daily', active: true, createdAt: '2026-11-09T00:00:00.000Z' }],
      habitLogs: [
        { id: 'hl1', habitId: 'h1', date: '2026-11-09', status: 'done' },
        { id: 'hl2', habitId: 'h1', date: '2026-11-10', status: 'done' },
      ],
      dailyPlans: [{ date: '2026-11-10', priorityTaskIds: ['t1', 't2'] }],
      dailyReviews: [{ date: '2026-11-11', wins: 'Shipped milestone', blockers: '', notes: '', energy: 4 }],
    };

    const summary = getWeeklyReflectionSummary(data, today, now);
    expect(summary.weekStart).toBe('2026-11-09');
    expect(summary.priorityPlanned).toBe(2);
    expect(summary.priorityDone).toBe(1);
    expect(summary.overdueCount).toBe(1);
    expect(summary.habitDone).toBe(2);
    expect(summary.habitScheduled).toBe(4); // Mon Nov 9 .. Thu Nov 12
    expect(summary.habitRate).toBe(50);
    expect(summary.advancingProjects).toHaveLength(1);
    expect(summary.reviewsWritten).toBe(1);
  });
});
