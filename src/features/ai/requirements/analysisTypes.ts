import { CapabilityId } from './capabilities';
import type { TextDiff } from './simpleDiff';
import { ExtractedRequirement, RequirementDocSource } from './types';

export type JiraIssueType = 'EPIC' | 'STORY' | 'TASK' | 'SUBTASK';

export type JiraChildDraft = {
  id: string;
  type: JiraIssueType; // STORY/TASK
  summary: string;
  description: string;
  acceptanceCriteria?: string;
  labels: string[];
  components: string[];
  parentEpicCapabilityId: string;
  sourceFileName?: string;
};

export type JiraEpicDraft = {
  capabilityId: CapabilityId;
  title: string;
  summary: string;
  acceptanceCriteria: string[];
  scope: 'CONFIG_ONLY' | 'CODE_CHANGE' | 'MIXED';
  dependencies: CapabilityId[];
  linkedRequirements: string[]; // requirement ids
  // NEW (for Stylus template docs)
  descriptionText?: string; // Section 1 + Section 2 combined (Jira description body)
  acceptanceCriteriaText?: string; // Section 4 full text (scenarios + G/W/T)
  sourceFileName?: string; // uploaded doc name
  detectedCapabilityConfidence?: number; // for UI
  labels?: string[];
  components?: string[];
  owner?: { team?: string; name?: string };
  children?: JiraChildDraft[];
  fingerprint?: string; // for duplicate detection
  updatedFromFingerprint?: string; // if update-mode
  diff?: {
    description?: TextDiff;
    acceptance?: TextDiff;
    inScope?: TextDiff;
  };
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
