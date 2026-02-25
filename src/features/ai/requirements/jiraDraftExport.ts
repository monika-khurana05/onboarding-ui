import type { RequirementAnalysisResult } from './analysisTypes';

export function buildJiraDraftExport(result: RequirementAnalysisResult) {
  return {
    meta: { generatedAt: new Date().toISOString(), countryCode: result.countryCode || 'UNKNOWN' },
    epics: (result.jiraEpics ?? []).map((e: any) => ({
      capabilityId: e.capabilityId,
      title: e.title,
      summary: e.summary,
      scope: e.scope,
      dependencies: e.dependencies ?? [],
      linkedRequirements: e.linkedRequirements ?? [],
      descriptionText: e.descriptionText,
      acceptanceCriteriaText: e.acceptanceCriteriaText,
      children: e.children ?? [],
      labels: e.labels ?? [],
      components: e.components ?? [],
      owner: e.owner ?? undefined
    }))
  };
}

export function buildJiraDraftExportFromMany(results: RequirementAnalysisResult[]) {
  const generatedAt = new Date().toISOString();
  const countryCodes = Array.from(new Set(results.map((result) => result.countryCode || 'UNKNOWN')));
  return {
    meta: { generatedAt, countryCodes },
    epics: results.flatMap((result) => buildJiraDraftExport(result).epics)
  };
}

export async function copyToClipboard(value: unknown): Promise<void> {
  const text = JSON.stringify(value, null, 2);
  await navigator.clipboard.writeText(text);
}

export function downloadJson(filename: string, value: unknown): void {
  const text = JSON.stringify(value, null, 2);
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
