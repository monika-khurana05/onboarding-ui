import { apiFetch } from '../../lib/apiClient';
import { env } from '../../lib/env';
import type { CountryOnboardingInput } from '../onboarding/schema';
import { mockCountries, mockTemplates, mockWorkflowRuns } from './mockData';
import type { Country, OnboardingTemplate, WorkflowRun } from './types';

type OnboardingResult = {
  requestId: string;
  message: string;
};

function delay<T>(value: T, ms = 500): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}

export async function listCountries(): Promise<Country[]> {
  if (!env.apiBaseUrl) {
    return delay(structuredClone(mockCountries));
  }
  return apiFetch<Country[]>('/countries');
}

export async function listWorkflowRuns(): Promise<WorkflowRun[]> {
  if (!env.apiBaseUrl) {
    return delay(structuredClone(mockWorkflowRuns));
  }
  return apiFetch<WorkflowRun[]>('/workflow-runs');
}

export async function listTemplates(): Promise<OnboardingTemplate[]> {
  if (!env.apiBaseUrl) {
    return delay(structuredClone(mockTemplates), 300);
  }
  return apiFetch<OnboardingTemplate[]>('/onboarding-templates');
}

export async function createOnboardingRequest(
  payload: CountryOnboardingInput
): Promise<OnboardingResult> {
  if (!env.apiBaseUrl) {
    return delay({
      requestId: `mock-${Date.now()}`,
      message: `Onboarding run started for ${payload.countryName} (${payload.iso2}).`
    }, 900);
  }
  return apiFetch<OnboardingResult>('/onboarding-requests', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
