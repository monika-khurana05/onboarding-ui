export type Region = 'Americas' | 'EMEA' | 'APAC';

export type CountryStatus = 'active' | 'pending' | 'blocked';

export type WorkflowRunStatus = 'success' | 'failed' | 'running';

export type RegulatoryTier = 'Tier 1' | 'Tier 2' | 'Tier 3';

export interface Country {
  id: string;
  name: string;
  iso2: string;
  region: Region;
  status: CountryStatus;
  regulatoryTier: RegulatoryTier;
  openTasks: number;
  lastUpdated: string;
  owner: string;
}

export interface WorkflowRun {
  id: string;
  countryIso2: string;
  status: WorkflowRunStatus;
  initiatedBy: string;
  step: string;
  startedAt: string;
  completedAt?: string;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  defaultRegion: Region;
  defaultTier: RegulatoryTier;
  defaultRiskThreshold: number;
}
