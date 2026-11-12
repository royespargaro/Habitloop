import type { Habit, HabitLog } from '../types';

export const localDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const shiftDateKey = (dateStr: string, deltaDays: number): string => {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + deltaDays);
  return localDateKey(date);
};

export const mk = (year: number, month: number) => `${year}-${month + 1}`;
export const pad = (value: number) => String(value).padStart(2, '0');
export const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

export const isHabitScheduledOnDate = (habit: Pick<Habit, 'frequency'>, dateStr: string): boolean => {
  if (habit.frequency === 'daily') return true;
  const day = new Date(`${dateStr}T12:00:00`).getDay();
  const isWeekend = day === 0 || day === 6;
  return habit.frequency === 'weekends' ? isWeekend : !isWeekend;
};

export const getStreak = (habitId: string, logs: HabitLog[], now: Date) => {
  const byDate = new Map(logs.filter(log => log.habitId === habitId).map(log => [log.date, log.status]));
  let streak = byDate.get(localDateKey(now)) === 'done' ? 1 : 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  cursor.setDate(cursor.getDate() - 1);

  while (true) {
    const status = byDate.get(localDateKey(cursor));
    if (status === 'done') streak += 1;
    else if (status !== 'skipped') break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

export const getBestStreak = (habitId: string, logs: HabitLog[]) => {
  const byDate = new Map(logs.filter(log => log.habitId === habitId).map(log => [log.date, log.status]));
  const dates = [...byDate.keys()].sort();
  if (!dates.length) return 0;

  const cursor = new Date(`${dates[0]}T12:00:00`);
  const last = new Date(`${dates[dates.length - 1]}T12:00:00`);
  let current = 0;
  let best = 0;
  while (cursor <= last) {
    const status = byDate.get(localDateKey(cursor));
    if (status === 'done') {
      current += 1;
      best = Math.max(best, current);
    } else if (status !== 'skipped') {
      current = 0;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return best;
};
