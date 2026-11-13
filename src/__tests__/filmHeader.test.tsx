// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FilmHeader, type HeroGoalSummary } from '../components/FilmHeader';

const sampleGoals: HeroGoalSummary[] = [
  {
    id: 'goal-1',
    title: 'Launch v2 workspace',
    areaName: 'Career',
    percent: 64,
    completedTasks: 7,
    totalTasks: 11,
    targetDate: '2026-12-01',
  },
  {
    id: 'goal-2',
    title: 'Run half marathon',
    areaName: 'Health',
    percent: 40,
    completedTasks: 4,
    totalTasks: 10,
    targetDate: '2026-12-15',
  },
  {
    id: 'goal-3',
    title: 'Publish monthly essays',
    areaName: 'Creative',
    percent: 75,
    completedTasks: 3,
    totalTasks: 4,
    targetDate: '2026-12-30',
  },
  {
    id: 'goal-4',
    title: 'Build emergency reserve',
    areaName: 'Finance',
    percent: 20,
    completedTasks: 1,
    totalTasks: 5,
    targetDate: '',
  },
];

describe('FilmHeader Horizon goal strip', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders synced active goals without a layout switcher and triggers goal callbacks', () => {
    const onOpenGoal = vi.fn();
    const onOpenGoals = vi.fn();

    render(
      <FilmHeader
        eyebrow="Thursday 12 November"
        title="good morning"
        subtitle="Choose what matters."
        goals={sampleGoals}
        onOpenGoal={onOpenGoal}
        onOpenGoals={onOpenGoals}
      />,
    );

    // Switcher controls are removed
    expect(screen.queryByRole('group', { name: 'Goal header layout preview' })).toBeNull();

    // Displays up to 3 active goals and links to all goals
    expect(screen.getByText('goals · 4 active')).toBeTruthy();
    expect(screen.getByText(/Launch v2 workspace/)).toBeTruthy();
    expect(screen.getByText(/Run half marathon/)).toBeTruthy();
    expect(screen.getByText(/Publish monthly essays/)).toBeTruthy();
    expect(screen.queryByText(/Build emergency reserve/)).toBeNull();
    expect(screen.getByText('64%')).toBeTruthy();

    fireEvent.click(screen.getByText(/Launch v2 workspace/).closest('button')!);
    expect(onOpenGoal).toHaveBeenCalledWith('goal-1');

    fireEvent.click(screen.getByRole('button', { name: 'All 4 goals →' }));
    expect(onOpenGoals).toHaveBeenCalledTimes(1);
  });

  it('shows compact empty state and triggers onAddGoal when no active goals exist', () => {
    const onAddGoal = vi.fn();

    render(
      <FilmHeader
        eyebrow="Thursday 12 November"
        title="good morning"
        subtitle="Choose what matters."
        goals={[]}
        onAddGoal={onAddGoal}
      />,
    );

    expect(screen.getByText('No active goals synced yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Set first goal →' }));
    expect(onAddGoal).toHaveBeenCalledTimes(1);
  });
});
