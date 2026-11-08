import type { ID, Project } from '../types';

export const MAX_ACTIVE_PROJECTS = 5;

export function canActivateProject(projects: readonly Project[], projectId?: ID | null): boolean {
  return projects.filter(project => project.status === 'active' && project.id !== projectId).length < MAX_ACTIVE_PROJECTS;
}