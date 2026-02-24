import type { JiraEpicDraft } from './analysisTypes';
import { CAPABILITIES, type CapabilityId } from './capabilities';
import { buildStoriesFromInScope } from './inScopeToStories';
import { buildJiraAutoEnrichment } from './jiraAutoEnrichment';
import type { StylusTemplateSections } from './stylusTemplateParser';

const CODE_CHANGE_REGEX = /\b(implement|develop|new api|api endpoint|build|create|integration|code change)\b/i;
const REQUIREMENT_ID_REGEX = /\bREQ-\d+\b/gi;

function getCapabilityLabel(capabilityId: CapabilityId): string {
  const capability = CAPABILITIES.find((item) => item.id === capabilityId);
  return capability?.label ?? capabilityId;
}

function buildDescriptionText(sections: StylusTemplateSections): string {
  const description = sections.descriptionText.trim();
  const inScope = sections.inScopeText.trim();

  if (!description && !inScope) {
    return '';
  }

  if (!inScope) {
    return description;
  }

  const inScopeBlock = `In Scope\n${inScope}`;
  if (!description) {
    return inScopeBlock;
  }

  return `${description}\n\n${inScopeBlock}`;
}

function detectScope(rawText: string): 'CONFIG_ONLY' | 'CODE_CHANGE' {
  return CODE_CHANGE_REGEX.test(rawText) ? 'CODE_CHANGE' : 'CONFIG_ONLY';
}

function detectDependencies(rawText: string, currentCapabilityId: CapabilityId): CapabilityId[] {
  const normalized = rawText.toLowerCase();
  const dependencies: CapabilityId[] = [];

  for (const capability of CAPABILITIES) {
    if (capability.id === currentCapabilityId) {
      continue;
    }
    const labelMatch = capability.label.toLowerCase();
    const idMatch = capability.id.toLowerCase().replace(/_/g, ' ');
    if (normalized.includes(labelMatch) || normalized.includes(idMatch)) {
      dependencies.push(capability.id);
    }
  }

  return dependencies;
}

function extractRequirementIds(rawText: string): string[] {
  const matches = rawText.match(REQUIREMENT_ID_REGEX) ?? [];
  const unique = new Set<string>();
  for (const match of matches) {
    unique.add(match.toUpperCase());
  }
  return Array.from(unique);
}

function buildAcceptanceCriteriaList(acceptanceCriteriaText: string): string[] {
  return acceptanceCriteriaText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function buildJiraEpicFromStylusDoc(args: {
  sections: StylusTemplateSections;
  capabilityId: CapabilityId;
  countryCode?: string;
  sourceFileName: string;
  detectedCapabilityConfidence?: number;
}): JiraEpicDraft {
  const { sections, capabilityId, countryCode, sourceFileName, detectedCapabilityConfidence } = args;
  const capabilityLabel = getCapabilityLabel(capabilityId);
  const epicTitle = sections.epicTitle.trim();
  const summaryCountry = (countryCode || 'UNKNOWN').toUpperCase();
  const combinedText = [sections.epicTitle, sections.descriptionText, sections.inScopeText, sections.acceptanceCriteriaText]
    .filter((value) => value && value.trim().length > 0)
    .join('\n');

  const descriptionText = buildDescriptionText(sections);
  const acceptanceCriteriaText = sections.acceptanceCriteriaText.trim();
  const autoEnrichment = buildJiraAutoEnrichment({ capabilityId, countryCode });
  const children = buildStoriesFromInScope({
    inScopeText: sections.inScopeText,
    countryCode,
    capabilityId,
    capabilityLabel,
    sourceFileName,
    baseLabels: autoEnrichment.labels,
    baseComponents: autoEnrichment.components
  });

  const linkedRequirements = new Set<string>([sourceFileName]);
  for (const requirementId of extractRequirementIds(combinedText)) {
    linkedRequirements.add(requirementId);
  }

  return {
    capabilityId,
    title: epicTitle,
    summary: `[${summaryCountry}] ${capabilityLabel} - ${epicTitle}`,
    scope: detectScope(combinedText),
    dependencies: detectDependencies(combinedText, capabilityId),
    acceptanceCriteria: buildAcceptanceCriteriaList(acceptanceCriteriaText),
    linkedRequirements: Array.from(linkedRequirements),
    descriptionText,
    acceptanceCriteriaText,
    sourceFileName,
    detectedCapabilityConfidence,
    labels: autoEnrichment.labels,
    components: autoEnrichment.components,
    owner: autoEnrichment.owner,
    children: children.length ? children : undefined
  };
}
