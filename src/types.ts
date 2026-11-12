export type ID = string;
export type Status = 'active' | 'completed' | 'archived';
export type TaskStatus = 'todo' | 'done' | 'skipped';
export type Priority = 'high' | 'medium' | 'low';

export interface LifeArea {
  id: ID;
  name: string;
  description: string;
  createdAt: string;
}

export interface Goal {
  id: ID;
  lifeAreaId: ID | null;
  title: string;
  outcome: string;
  targetDate: string;
  status: Status;
  createdAt: string;
}
export interface Project {
  id: ID;
  goalId: ID | null;
  title: string;
  description: string;
  dueDate: string;
  status: Status;
  createdAt: string;
}
export interface Task {
  id: ID;
  projectId: ID | null;
  title: string;
  dueDate: string;
  priority: Priority;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
}
export interface Habit {
  id: ID;
  name: string;
  frequency: 'daily' | 'weekdays' | 'weekends';
  active: boolean;
  createdAt: string;
}
export interface HabitLog {
  id: ID;
  habitId: ID;
  date: string;
  status: 'done' | 'skipped';
}
export interface DailyPlan {
  date: string;
  priorityTaskIds: ID[];
}
export interface DailyReview {
  date: string;
  wins: string;
  blockers: string;
  notes: string;
  energy: number;
}
export interface AppData {
  schemaVersion: 3;
  lifeAreas: LifeArea[];
  goals: Goal[];
  projects: Project[];
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  dailyPlans: DailyPlan[];
  dailyReviews: DailyReview[];
  updatedAt?: string;
}

export interface BrainDumpPreview {
  lifeAreas: Array<{ name: string; description: string }>;
  goals: Array<{ title: string; outcome: string; lifeAreaName: string; targetDate: string }>;
  projects: Array<{ title: string; description: string; goalTitle: string; dueDate: string }>;
  habits: Array<{ name: string; frequency: Habit['frequency'] }>;
  tasks: Array<{ title: string; projectTitle: string; dueDate: string; priority: Priority }>;
}
