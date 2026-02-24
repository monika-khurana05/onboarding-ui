import { CAPABILITIES, type CapabilityId } from './capabilities';
import type { RequirementAnalysisResult, JiraEpicDraft } from './analysisTypes';
import type { ExtractedRequirement, RequirementDocSource } from './types';
import { validationCatalog } from '../../../catalog/validationCatalog';
import { enrichmentCatalog } from '../../../catalog/enrichmentCatalog';

type WorkspaceOutputCapability = {
  id?: string;
  label?: string;
  requirements?: Array<{ id?: string; category?: string; text?: string }>;
  suggestedValidations?: string[];
  suggestedEnrichments?: string[];
};

type WorkspaceOutputSchema = {
  countryCode?: string;
  source?: { tool?: string; preset?: string };
  capabilities?: WorkspaceOutputCapability[];
};

const capabilityIdSet = new Set(CAPABILITIES.map((capability) => capability.id));
const validationCatalogIds = new Set(validationCatalog.map((item) => item.id));
const enrichmentCatalogIds = new Set(enrichmentCatalog.map((item) => item.id));
const fallbackCapabilityId: CapabilityId = 'DATA';

const categoryLookup: Record<string, ExtractedRequirement['category']> = {
  VALIDATION: 'Validation',
  ENRICHMENT: 'Enrichment',
  WORKFLOW: 'Workflow',
  ROUTING: 'Routing',
  COMPLIANCE: 'Compliance',
  DATA: 'Data',
  OTHER: 'Other'
};

type CapabilityMatch = {
  capabilityId: CapabilityId;
  label: string;
  confidence: number;
  notes: string;
};

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[_\s]+/g, '-');
}

function resolveCapabilityMatch(id?: string, label?: string): CapabilityMatch {
  const rawId = (id ?? '').trim();
  const rawLabel = (label ?? '').trim() || (id ?? '').trim();
  const exact = CAPABILITIES.find((capability) => capability.id === rawId);
  if (exact) {
    return {
      capabilityId: exact.id,
      label: exact.label,
      confidence: 0.95,
      notes: 'Exact capability match.'
    };
  }

  const normalizedId = normalizeToken(rawId);
  const normalizedMatch = CAPABILITIES.find(
    (capability) => normalizeToken(capability.id) === normalizedId
  );
  if (normalizedMatch) {
    return {
      capabilityId: normalizedMatch.id,
      label: normalizedMatch.label,
      confidence: 0.75,
      notes: `Normalized capability id from "${rawId}".`
    };
  }

  const labelMatch = CAPABILITIES.find(
    (capability) => capability.label.toLowerCase() === rawLabel.toLowerCase()
  );
  if (labelMatch) {
    return {
      capabilityId: labelMatch.id,
      label: labelMatch.label,
      confidence: 0.6,
      notes: `Matched by capability label "${rawLabel}".`
    };
  }

  const fallbackLabel = CAPABILITIES.find((capability) => capability.id === fallbackCapabilityId)?.label ?? 'Data';
  return {
    capabilityId: fallbackCapabilityId,
    label: fallbackLabel,
    confidence: 0.4,
    notes: rawId || rawLabel ? `Unknown capability "${rawId || rawLabel}" bucketed under ${fallbackLabel}.` : `Unknown capability bucketed under ${fallbackLabel}.`
  };
}

function normalizeCategory(value?: string): ExtractedRequirement['category'] {
  if (!value) {
    return 'Other';
  }
  const key = value.trim().toUpperCase();
  return categoryLookup[key] ?? 'Other';
}

function inferPriority(text: string): ExtractedRequirement['priority'] {
  const normalized = text.toLowerCase();
  if (/(must|required|shall)/.test(normalized)) {
    return 'MUST';
  }
  if (/(should|recommended)/.test(normalized)) {
    return 'SHOULD';
  }
  return 'MAY';
}

function toTitle(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return 'Requirement';
  }
  return trimmed.length > 90 ? `${trimmed.slice(0, 87)}...` : trimmed;
}

function buildRequirementId(countryCode: string, index: number, fallback = 'REQ'): string {
  const prefix = countryCode || 'REQ';
  return `${prefix}-${fallback}-${String(index + 1).padStart(3, '0')}`;
}

function buildInputDoc(fileName: string, countryCode: string): RequirementDocSource {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  const type: RequirementDocSource['type'] =
    extension === 'pdf'
      ? 'PDF'
      : extension === 'md' || extension === 'markdown'
        ? 'TEXT'
        : extension === 'txt'
          ? 'TEXT'
          : 'TEXT';
  return {
    id: `WS-${fileName}`,
    label: fileName || 'Workspace Output',
    countryCode: countryCode || 'UNKNOWN',
    type,
    tags: ['workspace-output'],
    origin: 'UPLOADED'
  };
}

function detectCountryFromText(content: string): string {
  const match = content.match(/country\s*code\s*[:\-]\s*([A-Z]{2,3})/i);
  return match ? match[1].toUpperCase() : '';
}

function parseJson(content: string): WorkspaceOutputSchema {
  const candidate = content.trim().replace(/^\uFEFF/, '');
  return JSON.parse(candidate) as WorkspaceOutputSchema;
}

function parseMarkdown(content: string): WorkspaceOutputSchema {
  const lines = content.split(/\r?\n/);
  const capabilities: WorkspaceOutputCapability[] = [];
  let current: WorkspaceOutputCapability | null = null;
  lines.forEach((line) => {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      current = { label: headingMatch[1].trim(), requirements: [] };
      capabilities.push(current);
      return;
    }
    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch && current) {
      current.requirements = current.requirements ?? [];
      current.requirements.push({ text: bulletMatch[1].trim() });
    }
  });
  return {
    countryCode: detectCountryFromText(content),
    capabilities
  };
}

function parsePlainText(content: string): WorkspaceOutputSchema {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return {
    countryCode: detectCountryFromText(content),
    capabilities: [
      {
        label: 'General',
        requirements: lines.map((text) => ({ text }))
      }
    ]
  };
}

export function detectWorkspaceOutputFormat(
  fileName: string,
  content: string
): 'json' | 'markdown' | 'text' {
  const trimmed = content.trim();
  if (fileName.toLowerCase().endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  if (/^#{1,6}\s+/m.test(content)) {
    return 'markdown';
  }
  return 'text';
}

function buildAcceptanceCriteria(requirements: ExtractedRequirement[], capabilityLabel: string): string[] {
  if (!requirements.length) {
    return [`Given the ${capabilityLabel} flow, when onboarding is configured, then it is validated.`];
  }
  return requirements.slice(0, 5).map((req) => {
    const text = req.title || req.description;
    return `Given the ${capabilityLabel} flow, when ${text.toLowerCase()}, then the requirement is satisfied.`;
  });
}

function buildEpicSummary(
  capabilityLabel: string,
  requirementCount: number,
  validationCount: number,
  enrichmentCount: number
): string {
  const lines = [
    `- Capability: ${capabilityLabel}`,
    `- Requirements: ${requirementCount} extracted`,
    `- Suggested validations: ${validationCount}`,
    `- Suggested enrichments: ${enrichmentCount}`
  ];
  return lines.slice(0, 6).join('\n');
}

function determineEpicScope(
  requirements: ExtractedRequirement[],
  suggestedValidations: string[],
  suggestedEnrichments: string[]
): JiraEpicDraft['scope'] {
  const codeRegex = /(implement|develop|new endpoint|new schema)/i;
  if (requirements.some((req) => codeRegex.test(req.description))) {
    return 'CODE_CHANGE';
  }
  const allSuggestionsKnown =
    suggestedValidations.every((item) => validationCatalogIds.has(item)) &&
    suggestedEnrichments.every((item) => enrichmentCatalogIds.has(item));
  if (allSuggestionsKnown) {
    return 'CONFIG_ONLY';
  }
  return 'MIXED';
}

function buildAnalysisFromSchema(schema: WorkspaceOutputSchema, fileName: string): RequirementAnalysisResult {
  const countryCode = schema.countryCode?.trim().toUpperCase() || 'UNKNOWN';
  const capabilities = schema.capabilities ?? [];

  const mappedCapabilityRows: CapabilityMatch[] = [];
  const requirements: ExtractedRequirement[] = [];
  const validationSuggestions = new Map<string, RequirementAnalysisResult['validationSuggestions'][number]>();
  const enrichmentSuggestions = new Map<string, RequirementAnalysisResult['enrichmentSuggestions'][number]>();
  const jiraEpics: JiraEpicDraft[] = [];

  let requirementIndex = 0;

  capabilities.forEach((capability) => {
    const match = resolveCapabilityMatch(capability.id, capability.label);
    mappedCapabilityRows.push(match);

    const capRequirements = (capability.requirements ?? []).map((req) => {
      const text = (req.text ?? '').trim();
      const id = req.id?.trim() || buildRequirementId(countryCode, requirementIndex++);
      const description = text || 'Requirement captured from workspace output.';
      const title = text ? toTitle(text) : `Requirement ${requirementIndex}`;
      return {
        id,
        category: normalizeCategory(req.category),
        priority: inferPriority(description),
        title,
        description,
        suggestedCapabilities: [match.capabilityId],
        confidence: Math.round(match.confidence * 100),
        evidence: [],
        openQuestions: []
      } satisfies ExtractedRequirement;
    });

    requirements.push(...capRequirements);

    (capability.suggestedValidations ?? []).forEach((suggestion) => {
      const key = suggestion.trim();
      if (!key) {
        return;
      }
      if (!validationSuggestions.has(key)) {
        validationSuggestions.set(key, {
          key,
          label: validationCatalog.find((item) => item.id === key)?.className ?? key,
          impact: validationCatalogIds.has(key) ? 'CONFIG_ONLY' : 'NEW_CATALOG_ITEM'
        });
      }
    });

    (capability.suggestedEnrichments ?? []).forEach((suggestion) => {
      const key = suggestion.trim();
      if (!key) {
        return;
      }
      if (!enrichmentSuggestions.has(key)) {
        enrichmentSuggestions.set(key, {
          key,
          label: enrichmentCatalog.find((item) => item.id === key)?.className ?? key,
          impact: enrichmentCatalogIds.has(key) ? 'CONFIG_ONLY' : 'NEW_CATALOG_ITEM'
        });
      }
    });

    if (capRequirements.length > 0) {
      const capabilityLabel =
        CAPABILITIES.find((item) => item.id === match.capabilityId)?.label ?? match.label;
      jiraEpics.push({
        capabilityId: match.capabilityId,
        title: `[${countryCode}] ${capabilityLabel} onboarding`,
        summary: buildEpicSummary(
          capabilityLabel,
          capRequirements.length,
          capability.suggestedValidations?.length ?? 0,
          capability.suggestedEnrichments?.length ?? 0
        ),
        acceptanceCriteria: buildAcceptanceCriteria(capRequirements, capabilityLabel),
        scope: determineEpicScope(
          capRequirements,
          capability.suggestedValidations ?? [],
          capability.suggestedEnrichments ?? []
        ),
        dependencies: [],
        linkedRequirements: capRequirements.map((req) => req.id)
      });
    }
  });

  const mappedCapabilities = Array.from(
    mappedCapabilityRows.reduce<Map<CapabilityId, CapabilityMatch>>((acc, match) => {
      const existing = acc.get(match.capabilityId);
      if (!existing || match.confidence > existing.confidence) {
        acc.set(match.capabilityId, match);
      }
      return acc;
    }, new Map())
  ).map(([capabilityId, match]) => ({
    capabilityId,
    confidence: Math.round(match.confidence * 100),
    notes: match.notes
  }));

  return {
    countryCode,
    inputDocs: [buildInputDoc(fileName, countryCode)],
    kpis: {
      requirementsFound: requirements.length,
      reuseOpportunityPct: requirements.length ? 60 : 0,
      discoveryTimeReductionPct: requirements.length ? 45 : 0,
      ambiguitiesCount: requirements.filter((req) => req.openQuestions.length > 0).length,
      manualErrorReductionPct: requirements.length ? 30 : 0
    },
    mappedCapabilities,
    validationSuggestions: Array.from(validationSuggestions.values()),
    enrichmentSuggestions: Array.from(enrichmentSuggestions.values()),
    requirements,
    jiraEpics
  };
}

export function parseWorkspaceOutputToAnalysisResult(args: {
  fileName: string;
  content: string;
  nowIso?: string;
}): RequirementAnalysisResult {
  const format = detectWorkspaceOutputFormat(args.fileName, args.content);
  let schema: WorkspaceOutputSchema;

  if (format === 'json') {
    schema = parseJson(args.content);
  } else if (format === 'markdown') {
    schema = parseMarkdown(args.content);
  } else {
    schema = parsePlainText(args.content);
  }

  return buildAnalysisFromSchema(schema, args.fileName);
}
