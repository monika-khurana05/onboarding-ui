import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createSnapshot,
  createSnapshotVersion,
  generatePreview,
  getHealth,
  getRepoDefaults,
  getRepoPacks,
  getSnapshot
} from './api';

export const healthQueryKey = ['health'] as const;
export const repoDefaultsQueryKey = ['repo-defaults'] as const;

export function useHealthQuery() {
  const isDev = import.meta.env.MODE === 'development';
  return useQuery({
    queryKey: healthQueryKey,
    queryFn: getHealth,
    staleTime: 10_000,
    retry: 0,
    refetchInterval: isDev ? 30_000 : false,
    meta: { suppressGlobalError: true }
  });
}

export function useRepoDefaultsQuery() {
  return useQuery({
    queryKey: repoDefaultsQueryKey,
    queryFn: getRepoDefaults,
    staleTime: 30_000,
    retry: 1
  });
}

export function useSnapshotQuery(snapshotId: string, version?: string) {
  return useQuery({
    queryKey: ['snapshot', snapshotId, version] as const,
    queryFn: () => getSnapshot(snapshotId, version),
    enabled: Boolean(snapshotId)
  });
}

export function useRepoPacksQuery(repoSlug: string, ref: string) {
  return useQuery({
    queryKey: ['repo-packs', repoSlug, ref] as const,
    queryFn: () => getRepoPacks(repoSlug, ref),
    enabled: Boolean(repoSlug)
  });
}

export function useCreateSnapshotMutation() {
  return useMutation({
    mutationFn: createSnapshot
  });
}

export function useCreateSnapshotVersionMutation(snapshotId: string) {
  return useMutation({
    mutationFn: (payload: { reason: string }) => createSnapshotVersion(snapshotId, payload)
  });
}

export function useGeneratePreviewMutation() {
  return useMutation({
    mutationFn: generatePreview
  });
}
