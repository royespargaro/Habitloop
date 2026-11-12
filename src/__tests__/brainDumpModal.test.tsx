// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrainDumpModal } from '../components/BrainDumpModal';
import { createDefaultData } from '../services/appStore';

describe('BrainDumpModal review, editing & failure resilience', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('preserves user draft when AI endpoint returns malformed or error output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'Not JSON at all',
    }));

    const onImport = vi.fn();
    render(<BrainDumpModal onClose={vi.fn()} onImport={onImport} />);

    const textarea = screen.getByPlaceholderText(/Paste plans, meeting notes/i) as HTMLTextAreaElement;
    const draft = 'I want to finish my thesis draft this month and work out three times a week.';
    fireEvent.change(textarea, { target: { value: draft } });

    fireEvent.click(screen.getByRole('button', { name: /Analyze draft/i }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('unreadable response'));
    expect(textarea.value).toBe(draft);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('flags existing duplicates unchecked, supports inline editing, and imports only on confirmation', async () => {
    const existing = createDefaultData();
    existing.habits.push({
      id: 'h-existing',
      name: 'Morning Run',
      frequency: 'daily',
      active: true,
      createdAt: '2026-11-01T00:00:00.000Z',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        lifeAreas: [],
        goals: [{ title: 'Ship InPursuit v2', outcome: 'Reliable daily use', lifeAreaName: 'Career', targetDate: '2026-12-20' }],
        projects: [],
        habits: [{ name: 'Morning Run', frequency: 'daily' }],
        tasks: [],
      }),
    }));

    const onImport = vi.fn();
    const onClose = vi.fn();
    render(<BrainDumpModal existingData={existing} onClose={onClose} onImport={onImport} />);

    const textarea = screen.getByPlaceholderText(/Paste plans, meeting notes/i);
    fireEvent.change(textarea, { target: { value: 'Ship InPursuit v2 by December and keep up Morning Run.' } });
    fireEvent.click(screen.getByRole('button', { name: /Analyze draft/i }));

    await waitFor(() => expect(screen.getByText('Ship InPursuit v2')).toBeTruthy());

    // Duplicate habit is flagged and unchecked by default; non-duplicate goal is checked
    expect(screen.getByText('Already exists')).toBeTruthy();
    expect(onImport).not.toHaveBeenCalled();

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[0].checked).toBe(true); // goal
    expect(checkboxes[1].checked).toBe(false); // duplicate habit

    // Inline edit the goal title before confirming import
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    fireEvent.click(editButtons[0]);
    const goalInput = screen.getByLabelText('Goal title') as HTMLInputElement;
    fireEvent.change(goalInput, { target: { value: 'Ship InPursuit Production' } });

    fireEvent.click(screen.getByRole('button', { name: /Import 1/i }));

    expect(onImport).toHaveBeenCalledTimes(1);
    const imported = onImport.mock.calls[0][0];
    expect(imported.goals).toHaveLength(1);
    expect(imported.goals[0].title).toBe('Ship InPursuit Production');
    expect(imported.habits).toEqual([]);
  });
});
