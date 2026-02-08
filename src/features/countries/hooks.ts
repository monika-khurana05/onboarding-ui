import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createOnboardingRequest,
  listCountries,
  listTemplates,
  listWorkflowRuns
} from './api';

export const countriesQueryKey = ['countries'] as const;
export const workflowRunsQueryKey = ['workflow-runs'] as const;
export const templatesQueryKey = ['onboarding-templates'] as const;

export function useCountriesQuery() {
  return useQuery({
    queryKey: countriesQueryKey,
    queryFn: listCountries
  });
}

export function useWorkflowRunsQuery() {
  return useQuery({
    queryKey: workflowRunsQueryKey,
    queryFn: listWorkflowRuns
  });
}

export function useTemplatesQuery() {
  return useQuery({
    queryKey: templatesQueryKey,
    queryFn: listTemplates
  });
}

export function useCreateOnboardingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOnboardingRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: countriesQueryKey });
      void queryClient.invalidateQueries({ queryKey: workflowRunsQueryKey });
    }
  });
}
