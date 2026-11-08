import { describe, expect, it } from 'vitest';
import { getBestStreak, getStreak } from '../utils/habitUtils';
import type { HabitLog } from '../types';

const log = (date: string, status: HabitLog['status'] = 'done'): HabitLog => ({ id: date, habitId: 'h1', date, status });

describe('habitUtils', () => {
  it('calculates a current streak from the new habit log schema', () => {
    const logs = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map(date => log(date));
    expect(getStreak('h1', logs, new Date(2026, 9, 25))).toBe(4);
  });

  it('keeps the previous streak when today is not completed yet', () => {
    const logs = ['2026-10-22', '2026-10-23', '2026-10-24'].map(date => log(date));
    expect(getStreak('h1', logs, new Date(2026, 9, 25))).toBe(3);
  });

  it('allows skipped days without counting them as completed days', () => {
    const logs = [log('2026-10-22'), log('2026-10-23', 'skipped'), log('2026-10-24'), log('2026-10-25')];
    expect(getStreak('h1', logs, new Date(2026, 9, 25))).toBe(3);
  });

  it('calculates the best streak across recorded history', () => {
    const logs = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06'].map(date => log(date));
    expect(getBestStreak('h1', logs)).toBe(3);
  });
});
