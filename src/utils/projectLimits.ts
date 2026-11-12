import type { ID, Project } from '../types';

export const MAX_ACTIVE_PROJECTS = 3;

export function canActivateProject(projects: readonly Project[], projectId?: ID | null): boolean {
  if (projectId) {
    const existing = projects.find(project => project.id === projectId);
    if (existing?.status === 'active') return true;
  }
  return projects.filter(project => project.status === 'active' && project.id !== projectId).length < MAX_ACTIVE_PROJECTS;
}