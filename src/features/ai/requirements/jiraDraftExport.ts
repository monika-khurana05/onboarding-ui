import type { JiraChildDraft, JiraEpicDraft, RequirementAnalysisResult } from './analysisTypes';
import type { TextDiff } from './simpleDiff';

type JiraDraftExport = {
  meta: { generatedAt: string; countryCode: string };
  epics: Array<{
    capabilityId: string;
    title: string;
    summary: string;
    scope: string;
    dependencies: string[];
    descriptionText?: string;
    acceptanceCriteriaText?: string;
    acceptanceCriteria: string[];
    linkedRequirements: string[];
    sourceFileName?: string;
    detectedCapabilityConfidence?: number;
    labels?: string[];
    components?: string[];
    owner?: { team?: string; name?: string };
    children?: JiraChildDraft[];
    fingerprint?: string;
    updatedFromFingerprint?: string;
    diff?: {
      description?: TextDiff;
      acceptance?: TextDiff;
      inScope?: TextDiff;
    };
  }>;
};

export function buildJiraDraftExport(result: RequirementAnalysisResult): JiraDraftExport {
  const countryCode = result.countryCode || 'UNKNOWN';
  const epics = result.jiraEpics.map((epic: JiraEpicDraft) => ({
    capabilityId: epic.capabilityId,
    title: epic.title,
    summary: epic.summary,
    scope: epic.scope,
    dependencies: epic.dependencies,
    descriptionText: epic.descriptionText,
    acceptanceCriteriaText: epic.acceptanceCriteriaText,
    acceptanceCriteria: epic.acceptanceCriteria,
    linkedRequirements: epic.linkedRequirements,
    sourceFileName: epic.sourceFileName,
    detectedCapabilityConfidence: epic.detectedCapabilityConfidence,
    labels: epic.labels,
    components: epic.components,
    owner: epic.owner,
    children: epic.children,
    fingerprint: epic.fingerprint,
    updatedFromFingerprint: epic.updatedFromFingerprint,
    diff: epic.diff
  }));
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      countryCode
    },
    epics
  };
}

export function buildJiraDraftExportFromMany(results: RequirementAnalysisResult[]): JiraDraftExport {
  const generatedAt = new Date().toISOString();
  const countryCode = results.find((result) => result.countryCode)?.countryCode || 'UNKNOWN';
  const epics = results
    .flatMap((result) => result.jiraEpics)
    .map((epic: JiraEpicDraft) => ({
      capabilityId: epic.capabilityId,
      title: epic.title,
      summary: epic.summary,
      scope: epic.scope,
      dependencies: epic.dependencies,
      descriptionText: epic.descriptionText,
      acceptanceCriteriaText: epic.acceptanceCriteriaText,
      acceptanceCriteria: epic.acceptanceCriteria,
      linkedRequirements: epic.linkedRequirements,
      sourceFileName: epic.sourceFileName,
      detectedCapabilityConfidence: epic.detectedCapabilityConfidence,
      labels: epic.labels,
      components: epic.components,
      owner: epic.owner,
      children: epic.children,
      fingerprint: epic.fingerprint,
      updatedFromFingerprint: epic.updatedFromFingerprint,
      diff: epic.diff
    }));
  return {
    meta: { generatedAt, countryCode },
    epics
  };
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(value: unknown): Promise<void> {
  if (!navigator?.clipboard?.writeText) {
    throw new Error('Clipboard access is unavailable.');
  }
  await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
}
