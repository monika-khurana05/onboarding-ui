import type { Country, OnboardingTemplate, WorkflowRun } from './types';

export const mockCountries: Country[] = [
  {
    id: 'ctr-usa',
    name: 'United States',
    iso2: 'US',
    region: 'Americas',
    status: 'active',
    regulatoryTier: 'Tier 1',
    openTasks: 1,
    lastUpdated: '2026-02-06T16:34:00.000Z',
    owner: 'North America Ops'
  },
  {
    id: 'ctr-gbr',
    name: 'United Kingdom',
    iso2: 'GB',
    region: 'EMEA',
    status: 'pending',
    regulatoryTier: 'Tier 1',
    openTasks: 4,
    lastUpdated: '2026-02-07T13:14:00.000Z',
    owner: 'London Hub'
  },
  {
    id: 'ctr-ind',
    name: 'India',
    iso2: 'IN',
    region: 'APAC',
    status: 'pending',
    regulatoryTier: 'Tier 2',
    openTasks: 6,
    lastUpdated: '2026-02-05T09:01:00.000Z',
    owner: 'APAC Expansion'
  },
  {
    id: 'ctr-bra',
    name: 'Brazil',
    iso2: 'BR',
    region: 'Americas',
    status: 'blocked',
    regulatoryTier: 'Tier 3',
    openTasks: 8,
    lastUpdated: '2026-02-03T19:20:00.000Z',
    owner: 'LATAM Operations'
  }
];

export const mockWorkflowRuns: WorkflowRun[] = [
  {
    id: 'run-9012',
    countryIso2: 'GB',
    status: 'running',
    initiatedBy: 'ops.manager@cpx.com',
    step: 'Compliance policy checks',
    startedAt: '2026-02-08T08:05:00.000Z'
  },
  {
    id: 'run-9011',
    countryIso2: 'US',
    status: 'success',
    initiatedBy: 'integration.bot@cpx.com',
    step: 'Provisioning complete',
    startedAt: '2026-02-07T16:31:00.000Z',
    completedAt: '2026-02-07T16:38:00.000Z'
  },
  {
    id: 'run-9010',
    countryIso2: 'BR',
    status: 'failed',
    initiatedBy: 'ops.manager@cpx.com',
    step: 'Settlement routing validation',
    startedAt: '2026-02-07T14:04:00.000Z',
    completedAt: '2026-02-07T14:09:00.000Z'
  }
];

export const mockTemplates: OnboardingTemplate[] = [
  {
    id: 'tpl-tier1',
    name: 'Tier 1 Regulated Market',
    description: 'Baseline for markets with direct regulator integration and enhanced reporting.',
    defaultRegion: 'EMEA',
    defaultTier: 'Tier 1',
    defaultRiskThreshold: 30
  },
  {
    id: 'tpl-fast-launch',
    name: 'Fast Launch',
    description: 'Low friction path with phased control activation and post go-live hardening.',
    defaultRegion: 'APAC',
    defaultTier: 'Tier 2',
    defaultRiskThreshold: 45
  }
];
