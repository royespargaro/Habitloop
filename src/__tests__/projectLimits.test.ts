import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import { canActivateProject, MAX_ACTIVE_PROJECTS } from '../utils/projectLimits';

const project = (id: string, status: Project['status'] = 'active'): Project => ({
  id,
  goalId: null,
  title: `Project ${id}`,
  description: '',
  dueDate: '',
  status,
  createdAt: '',
});

describe('projectLimits', () => {
  it('allows active projects below the cap', () => {
    expect(canActivateProject(Array.from({ length: MAX_ACTIVE_PROJECTS - 1 }, (_, index) => project(String(index))))).toBe(true);
  });

  it('blocks new active projects at the cap', () => {
    expect(canActivateProject(Array.from({ length: MAX_ACTIVE_PROJECTS }, (_, index) => project(String(index))))).toBe(false);
  });

  it('allows editing a project that already occupies an active slot', () => {
    const projects = Array.from({ length: MAX_ACTIVE_PROJECTS }, (_, index) => project(String(index)));
    expect(canActivateProject(projects, projects[0].id)).toBe(true);
  });
});