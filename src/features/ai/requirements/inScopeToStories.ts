import type { JiraChildDraft } from './analysisTypes';

const BULLET_REGEX = /^\s*(?:[-•*–]|\d+\s*[.)])\s+(.*)$/;
const MAX_SUMMARY_LENGTH = 120;

function toShortSummary(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_SUMMARY_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_SUMMARY_LENGTH - 3).trimEnd()}...`;
}

function buildChildId(sourceFileName: string | undefined, index: number): string {
  const base = sourceFileName ? sourceFileName.replace(/\.[^.]+$/, '') : 'IN_SCOPE';
  const cleaned = base.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const token = cleaned ? cleaned.toUpperCase() : 'IN_SCOPE';
  return `${token}_${index + 1}`;
}

export function extractBullets(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      const match = line.match(BULLET_REGEX);
      return match?.[1]?.trim() ?? '';
    })
    .filter((line) => line.length > 0);
}

export function buildStoriesFromInScope(args: {
  inScopeText: string;
  countryCode?: string;
  capabilityId: string;
  capabilityLabel: string;
  sourceFileName?: string;
  baseLabels?: string[];
  baseComponents?: string[];
}): JiraChildDraft[] {
  const bullets = extractBullets(args.inScopeText);
  if (!bullets.length) {
    return [];
  }
  const country = (args.countryCode || 'UNKNOWN').toUpperCase();
  const labels = args.baseLabels ? [...args.baseLabels] : [];
  const components = args.baseComponents ? [...args.baseComponents] : [];
  return bullets.map((bullet, index) => ({
    id: buildChildId(args.sourceFileName, index),
    type: 'STORY',
    summary: `[${country}] ${args.capabilityLabel} - ${toShortSummary(bullet)}`,
    description: `${bullet}\n\nDerived from In Scope.`,
    labels,
    components,
    parentEpicCapabilityId: args.capabilityId,
    sourceFileName: args.sourceFileName
  }));
}
