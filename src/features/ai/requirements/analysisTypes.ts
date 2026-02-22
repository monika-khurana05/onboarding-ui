import { CapabilityId } from './capabilities';
import { ExtractedRequirement, RequirementDocSource } from './types';

export type JiraEpicDraft = {
  capabilityId: CapabilityId;
  title: string;
  summary: string;
  acceptanceCriteria: string[];
  scope: 'CONFIG_ONLY' | 'CODE_CHANGE' | 'MIXED';
  dependencies: CapabilityId[];
  linkedRequirements: string[]; // requirement ids
};

export type RequirementAnalysisResult = {
  countryCode: string;
  inputDocs: RequirementDocSource[];

  kpis: {
    requirementsFound: number;
    reuseOpportunityPct: number; // e.g. 70
    discoveryTimeReductionPct: number; // e.g. 60
    ambiguitiesCount: number;
    manualErrorReductionPct: number; // e.g. 40
  };

  mappedCapabilities: { capabilityId: CapabilityId; confidence: number; notes: string }[];

  validationSuggestions: { key: string; label: string; impact: 'NEW_CATALOG_ITEM' | 'CONFIG_ONLY' | 'CODE_CHANGE' }[];
  enrichmentSuggestions: { key: string; label: string; impact: 'CONFIG_ONLY' | 'CODE_CHANGE' }[];

  requirements: ExtractedRequirement[];

  jiraEpics: JiraEpicDraft[];
};
