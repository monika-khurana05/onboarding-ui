import { env } from './env';

const ROLE_STORAGE_KEY = 'cpx.user.roles';
const assemblyPodRoles = ['onboarding-admin', 'capability-owner'] as const;

function normalizeRole(role: string): string {
  return role.trim().toLowerCase().replace(/[_\s]+/g, '-');
}

function parseRoles(value: string | undefined | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/[;,]+/)
    .map((role) => normalizeRole(role))
    .filter(Boolean);
}

function readStoredRoles(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    return parseRoles(window.localStorage.getItem(ROLE_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function getUserRoles(): string[] {
  const roles = [...parseRoles(env.userRoles), ...readStoredRoles()];
  return Array.from(new Set(roles));
}

export function hasAssemblyPodAccess(roles: string[] = getUserRoles()): boolean {
  const normalized = new Set(roles.map((role) => normalizeRole(role)));
  return assemblyPodRoles.some((role) => normalized.has(role));
}

export function getAssemblyPodAccessRoles(): string[] {
  return [...assemblyPodRoles];
}
