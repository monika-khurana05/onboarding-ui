import { CAPABILITIES, type CapabilityId } from './capabilities';
import type { RequirementAnalysisResult, JiraEpicDraft } from './analysisTypes';
import type { ExtractedRequirement, RequirementDocSource } from './types';

export type WorkspaceParseResult = {
  analysis: RequirementAnalysisResult;
  warnings: string[];
};

export type WorkspaceOutputInput = {
  fileName: string;
  content: string;
};

const capabilityIdSet = new Set(CAPABILITIES.map((capability) => capability.id));
const capabilityLabelLookup = new Map(
  CAPABILITIES.map((capability) => [capability.label.toLowerCase(), capability.id])
);
const capabilitySlugLookup = new Map(
  CAPABILITIES.map((capability) => [capability.label.replace(/\s+/g, '_').toUpperCase(), capability.id])
);

const categoryLookup: Record<string, ExtractedRequirement['category']> = {
  VALIDATION: 'Validation',
  ENRICHMENT: 'Enrichment',
  WORKFLOW: 'Workflow',
  ROUTING: 'Routing',
  COMPLIANCE: 'Compliance',
  DATA: 'Data',
  REGULATORY: 'Compliance',
  OTHER: 'Other'
};

const priorityLookup: Record<string, ExtractedRequirement['priority']> = {
  MUST: 'MUST',
  SHOULD: 'SHOULD',
  MAY: 'MAY',
  HIGH: 'MUST',
  CRITICAL: 'MUST',
  MEDIUM: 'SHOULD',
  LOW: 'MAY'
};

const scopeLookup: Record<string, JiraEpicDraft['scope']> = {
  CONFIG_ONLY: 'CONFIG_ONLY',
  CODE_CHANGE: 'CODE_CHANGE',
  MIXED: 'MIXED',
  CONFIG: 'CONFIG_ONLY',
  CODE: 'CODE_CHANGE'
};

const impactLookup: Record<string, 'NEW_CATALOG_ITEM' | 'CONFIG_ONLY' | 'CODE_CHANGE'> = {
  NEW_CATALOG_ITEM: 'NEW_CATALOG_ITEM',
  CONFIG_ONLY: 'CONFIG_ONLY',
  CODE_CHANGE: 'CODE_CHANGE',
  NEW: 'NEW_CATALOG_ITEM',
  CONFIG: 'CONFIG_ONLY',
  CODE: 'CODE_CHANGE'
};

function normalizeCountryCode(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toUpperCase();
}

function normalizeCategory(value: unknown): ExtractedRequirement['category'] {
  const key = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return categoryLookup[key] ?? 'Other';
}

function normalizePriority(value: unknown): ExtractedRequirement['priority'] {
  const key = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return priorityLookup[key] ?? 'MAY';
}

function normalizePercent(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  const scaled = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  const scaled = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, scaled));
}

function normalizeDocType(value: unknown, fallbackName?: string): RequirementDocSource['type'] {
  const raw = typeof value === 'string' ? value.toUpperCase() : '';
  if (raw.includes('PDF')) {
    return 'PDF';
  }
  if (raw.includes('DOC')) {
    return 'DOCX';
  }
  if (raw.includes('EMAIL') || raw.includes('MAIL')) {
    return 'EMAIL';
  }
  if (raw.includes('JIRA')) {
    return 'JIRA';
  }
  if (raw.includes('HTML')) {
    return 'HTML';
  }
  const extension = fallbackName?.trim().split('.').pop()?.toLowerCase() ?? '';
  switch (extension) {
    case 'pdf':
      return 'PDF';
    case 'doc':
    case 'docx':
      return 'DOCX';
    case 'msg':
    case 'eml':
      return 'EMAIL';
    case 'html':
    case 'htm':
      return 'HTML';
    case 'txt':
    case 'md':
    case 'markdown':
      return 'TEXT';
    default:
      return 'TEXT';
  }
}

function normalizeCapabilityId(value: unknown): CapabilityId | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const upper = trimmed.toUpperCase().replace(/\s+/g, '_');
    if (capabilityIdSet.has(upper as CapabilityId)) {
      return upper as CapabilityId;
    }
    const labelMatch = capabilityLabelLookup.get(trimmed.toLowerCase());
    if (labelMatch) {
      return labelMatch;
    }
    const slugMatch = capabilitySlugLookup.get(upper);
    return slugMatch ?? null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return normalizeCapabilityId(record.capabilityId ?? record.capabilityKey ?? record.id ?? record.key ?? record.name);
  }
  return null;
}

function normalizeCapabilities(value: unknown): CapabilityId[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',').map((entry) => entry.trim())
      : [];
  const next = new Set<CapabilityId>();
  values.forEach((entry) => {
    const normalized = normalizeCapabilityId(entry);
    if (normalized) {
      next.add(normalized);
    }
  });
  return Array.from(next);
}

function normalizeEvidence(value: unknown): ExtractedRequirement['evidence'] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        return { docId: 'SOURCE', cite: entry };
      }
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const docId = String(record.docId ?? record.documentId ?? record.sourceId ?? record.doc ?? 'SOURCE');
      const cite = String(record.cite ?? record.pageHint ?? record.location ?? record.section ?? '');
      const snippetValue = record.snippet ?? record.excerpt ?? record.quote;
      const snippet = typeof snippetValue === 'string' ? snippetValue : undefined;
      return { docId, cite: cite || 'n/a', snippet };
    })
    .filter((entry): entry is ExtractedRequirement['evidence'][number] => Boolean(entry));
}

function normalizeOpenQuestions(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          return String(record.text ?? record.question ?? record.prompt ?? '');
        }
        return '';
      })
      .filter((entry) => entry.trim().length > 0);
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

function inferCountryCodeFromRequirements(requirements: unknown[]): string {
  for (const entry of requirements) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const id = record.id ?? record.requirementId ?? record.key;
    if (typeof id !== 'string') {
      continue;
    }
    const match = id.match(/^([A-Z]{2,})-REQ/);
    if (match) {
      return match[1];
    }
  }
  return '';
}

function normalizeRequirement(raw: unknown, index: number, fallbackCountryCode: string): ExtractedRequirement {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const id =
    String(
      record.id ??
        record.requirementId ??
        record.key ??
        `${fallbackCountryCode}-REQ-${String(index + 1).padStart(3, '0')}`
    ) || `${fallbackCountryCode}-REQ-${String(index + 1).padStart(3, '0')}`;
  const title = String(record.title ?? record.text ?? record.summary ?? `Requirement ${index + 1}`);
  const description = String(record.description ?? record.details ?? record.text ?? '');
  const suggestedCapabilities = normalizeCapabilities(
    record.suggestedCapabilities ?? record.capabilities ?? record.capabilityIds ?? record.domainCapabilities
  );
  return {
    id,
    category: normalizeCategory(record.category ?? record.type ?? record.domain ?? record.group),
    priority: normalizePriority(record.priority ?? record.severity ?? record.level),
    title,
    description,
    suggestedCapabilities,
    confidence: normalizeConfidence(record.confidence ?? record.score ?? record.probability),
    evidence: normalizeEvidence(record.evidence ?? record.sources ?? record.citations),
    openQuestions: normalizeOpenQuestions(record.openQuestions ?? record.questions ?? record.open_items ?? record.openItems)
  };
}

function normalizeInputDocs(payload: Record<string, unknown>, countryCode: string): RequirementDocSource[] {
  const meta = payload.meta && typeof payload.meta === 'object' ? (payload.meta as Record<string, unknown>) : null;
  const rawDocs =
    (payload.inputDocs as unknown[]) ??
    (payload.documents as unknown[]) ??
    (payload.sources as unknown[]) ??
    (meta?.sourceDocuments as unknown[]) ??
    [];
  if (!Array.isArray(rawDocs)) {
    return [];
  }
  return rawDocs.map((entry, index) => {
    const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const label = String(record.label ?? record.title ?? record.name ?? `Document ${index + 1}`);
    const id = String(record.id ?? record.docId ?? record.documentId ?? `${countryCode}-DOC-${index + 1}`);
    const docCountry = normalizeCountryCode(record.countryCode ?? record.country ?? countryCode) || countryCode;
    return {
      id,
      label,
      countryCode: docCountry,
      type: normalizeDocType(record.type ?? record.fileType ?? record.mimeType, label),
      tags: Array.isArray(record.tags) ? record.tags.filter((tag) => typeof tag === 'string') : [],
      origin: 'UPLOADED'
    };
  });
}

function deriveMappedCapabilities(requirements: ExtractedRequirement[]): RequirementAnalysisResult['mappedCapabilities'] {
  const counts = new Map<CapabilityId, { count: number; confidenceTotal: number }>();
  requirements.forEach((req) => {
    req.suggestedCapabilities.forEach((capabilityId) => {
      const current = counts.get(capabilityId) ?? { count: 0, confidenceTotal: 0 };
      counts.set(capabilityId, {
        count: current.count + 1,
        confidenceTotal: current.confidenceTotal + req.confidence
      });
    });
  });
  return Array.from(counts.entries()).map(([capabilityId, stats]) => ({
    capabilityId,
    confidence: stats.count ? Math.round(stats.confidenceTotal / stats.count) : 0,
    notes: `Identified in ${stats.count} requirement${stats.count === 1 ? '' : 's'}.`
  }));
}

function normalizeMappedCapabilities(
  payload: Record<string, unknown>,
  requirements: ExtractedRequirement[]
): RequirementAnalysisResult['mappedCapabilities'] {
  const raw =
    (payload.mappedCapabilities as unknown[]) ??
    (payload.suggestedDomainCapabilities as unknown[]) ??
    (payload.capabilities as unknown[]) ??
    [];
  if (Array.isArray(raw) && raw.length) {
    const mapped = raw
      .map((entry) => {
        if (typeof entry === 'string') {
          const id = normalizeCapabilityId(entry);
          if (!id) {
            return null;
          }
          return { capabilityId: id, confidence: 0, notes: '' };
        }
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const capabilityId = normalizeCapabilityId(
          record.capabilityId ?? record.capabilityKey ?? record.id ?? record.key ?? record.name
        );
        if (!capabilityId) {
          return null;
        }
        const confidence = normalizeConfidence(record.confidence ?? record.score ?? record.probability);
        const notes = String(record.notes ?? record.reason ?? record.description ?? '');
        return { capabilityId, confidence, notes };
      })
      .filter((entry): entry is RequirementAnalysisResult['mappedCapabilities'][number] => Boolean(entry));
    if (mapped.length) {
      return mapped.map((entry) => ({
        ...entry,
        confidence: entry.confidence || 0,
        notes: entry.notes || `Identified in workspace output.`
      }));
    }
  }
  return deriveMappedCapabilities(requirements);
}

function normalizeImpact(value: unknown): 'NEW_CATALOG_ITEM' | 'CONFIG_ONLY' | 'CODE_CHANGE' {
  const key = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return impactLookup[key] ?? 'CONFIG_ONLY';
}

function normalizeScope(value: unknown): JiraEpicDraft['scope'] {
  const key = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return scopeLookup[key] ?? 'MIXED';
}

function normalizeValidationSuggestions(payload: Record<string, unknown>): RequirementAnalysisResult['validationSuggestions'] {
  const raw =
    (payload.validationSuggestions as unknown[]) ??
    (payload.validations as unknown[]) ??
    (payload.suggestions && typeof payload.suggestions === 'object'
      ? (payload.suggestions as Record<string, unknown>).validations
      : []) ??
    [];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => {
      if (typeof entry === 'string') {
        return { key: entry, label: entry, impact: 'CONFIG_ONLY' as const };
      }
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const key = String(record.key ?? record.catalogId ?? record.id ?? record.label ?? 'validation');
      const label = String(record.label ?? record.catalogId ?? record.name ?? key);
      const impact = normalizeImpact(record.impact ?? record.changeType ?? record.type);
      return { key, label, impact };
    })
    .filter((entry): entry is RequirementAnalysisResult['validationSuggestions'][number] => Boolean(entry));
}

function normalizeEnrichmentSuggestions(payload: Record<string, unknown>): RequirementAnalysisResult['enrichmentSuggestions'] {
  const raw =
    (payload.enrichmentSuggestions as unknown[]) ??
    (payload.enrichments as unknown[]) ??
    (payload.suggestions && typeof payload.suggestions === 'object'
      ? (payload.suggestions as Record<string, unknown>).enrichments
      : []) ??
    [];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => {
      if (typeof entry === 'string') {
        return { key: entry, label: entry, impact: 'CONFIG_ONLY' as const };
      }
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const key = String(record.key ?? record.catalogId ?? record.id ?? record.label ?? 'enrichment');
      const label = String(record.label ?? record.catalogId ?? record.name ?? key);
      let impact = normalizeImpact(record.impact ?? record.changeType ?? record.type);
      if (impact === 'NEW_CATALOG_ITEM') {
        impact = 'CODE_CHANGE';
      }
      return { key, label, impact };
    })
    .filter((entry): entry is RequirementAnalysisResult['enrichmentSuggestions'][number] => Boolean(entry));
}

function normalizeJiraEpics(
  payload: Record<string, unknown>,
  requirements: ExtractedRequirement[],
  warnings: string[]
): JiraEpicDraft[] {
  const raw =
    (payload.jiraEpics as unknown[]) ??
    (payload.epics as unknown[]) ??
    (payload.jiraDrafts as unknown[]) ??
    (payload.jira && typeof payload.jira === 'object' ? (payload.jira as Record<string, unknown>).epics : []) ??
    [];
  if (!Array.isArray(raw)) {
    return [];
  }
  const fallbackCapability = CAPABILITIES[0]?.id ?? 'PAYMENT_INITIATION';
  let missingCapability = false;
  const epics = raw
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const directCapability = normalizeCapabilityId(
        record.capabilityId ?? record.capabilityKey ?? record.capability ?? record.domain ?? record.id
      );
      const capabilityId =
        directCapability ??
        normalizeCapabilities(record.dependencies ?? record.requiredCapabilities ?? record.tags)[0] ??
        requirements[index]?.suggestedCapabilities[0] ??
        fallbackCapability;
      if (!directCapability) {
        missingCapability = true;
      }
      const title = String(record.title ?? record.summary ?? record.name ?? `Epic ${index + 1}`);
      const summary = String(record.summary ?? record.description ?? record.details ?? '');
      const acceptanceCriteriaRaw =
        (record.acceptanceCriteria as unknown[]) ??
        (record.criteria as unknown[]) ??
        (record.acceptance as unknown[]) ??
        [];
      const acceptanceCriteria = Array.isArray(acceptanceCriteriaRaw)
        ? acceptanceCriteriaRaw.map((item) => String(item)).filter((item) => item.trim().length > 0)
        : [];
      const linkedRequirementsRaw =
        (record.linkedRequirements as unknown[]) ??
        (record.requirements as unknown[]) ??
        (record.requirementIds as unknown[]) ??
        [];
      const linkedRequirements = Array.isArray(linkedRequirementsRaw)
        ? linkedRequirementsRaw.map((item) => String(item))
        : [];
      return {
        capabilityId,
        title,
        summary,
        acceptanceCriteria,
        scope: normalizeScope(record.scope ?? record.impact ?? record.changeType),
        dependencies: normalizeCapabilities(record.dependencies ?? record.dependsOn ?? record.requiredCapabilities),
        linkedRequirements
      };
    })
    .filter((entry): entry is JiraEpicDraft => Boolean(entry));
  if (missingCapability) {
    warnings.push('Some Jira epics were missing a capability; defaults were applied.');
  }
  return epics;
}

function resolvePayloadRoot(raw: unknown): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }
  if (Array.isArray(raw)) {
    return { requirements: raw };
  }
  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const nested =
      (record.requirementsAnalysis as Record<string, unknown>) ??
      (record.requirementAnalysis as Record<string, unknown>) ??
      (record.analysis as Record<string, unknown>) ??
      (record.output as Record<string, unknown>) ??
      (record.data as Record<string, unknown>);
    return nested ?? record;
  }
  return null;
}

function extractJsonCandidate(text: string): string | null {
  const trimmed = text.trim().replace(/^\uFEFF/, '');
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(text))) {
    const candidate = match[1].trim();
    if (!candidate) {
      continue;
    }
    if (candidate.startsWith('{') || candidate.startsWith('[')) {
      return candidate;
    }
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return null;
}

function parseJson(text: string): unknown {
  const candidate = extractJsonCandidate(text);
  if (!candidate) {
    throw new Error('No JSON found in the workspace output. Export JSON or include a JSON block in Markdown/TXT.');
  }
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error('Workspace output JSON is invalid or malformed.');
  }
}

function buildAnalysis(payload: Record<string, unknown>, warnings: string[]): RequirementAnalysisResult {
  const rawRequirements =
    (payload.requirements as unknown[]) ??
    (payload.requirementsList as unknown[]) ??
    (payload.items as unknown[]) ??
    [];
  const requirementsArray = Array.isArray(rawRequirements) ? rawRequirements : [];
  const inferredCountry = inferCountryCodeFromRequirements(requirementsArray);
  const meta = payload.meta && typeof payload.meta === 'object' ? (payload.meta as Record<string, unknown>) : null;
  const rawCountry = payload.countryCode ?? payload.country ?? meta?.countryCode ?? inferredCountry;
  const countryCode = normalizeCountryCode(rawCountry);
  if (!countryCode) {
    warnings.push('Country code missing in workspace output.');
  }
  const fallbackCountryCode = countryCode || 'WORKSPACE';
  const requirements = requirementsArray.map((entry, index) => normalizeRequirement(entry, index, fallbackCountryCode));
  if (!requirements.length) {
    warnings.push('No requirements found in the workspace output.');
  }
  const summary = payload.summary && typeof payload.summary === 'object' ? (payload.summary as Record<string, unknown>) : null;
  const kpisSource =
    (payload.kpis as Record<string, unknown>) ??
    (payload.metrics as Record<string, unknown>) ??
    (summary?.impact as Record<string, unknown>) ??
    {};
  const ambiguitiesCount = requirements.reduce((sum, req) => sum + (req.openQuestions.length > 0 ? 1 : 0), 0);
  const kpis = {
    requirementsFound: requirements.length,
    reuseOpportunityPct: normalizePercent(kpisSource.reuseOpportunityPct ?? kpisSource.reuseOpportunity),
    discoveryTimeReductionPct: normalizePercent(kpisSource.discoveryTimeReductionPct ?? kpisSource.discoveryTimeReduction),
    ambiguitiesCount,
    manualErrorReductionPct: normalizePercent(kpisSource.manualErrorReductionPct ?? kpisSource.manualErrorReduction)
  };
  const mappedCapabilities = normalizeMappedCapabilities(payload, requirements);
  const validationSuggestions = normalizeValidationSuggestions(payload);
  const enrichmentSuggestions = normalizeEnrichmentSuggestions(payload);
  const jiraEpics = normalizeJiraEpics(payload, requirements, warnings);
  if (!jiraEpics.length) {
    warnings.push('No Jira epic drafts found in the workspace output.');
  }
  return {
    countryCode,
    inputDocs: normalizeInputDocs(payload, fallbackCountryCode),
    kpis,
    mappedCapabilities,
    validationSuggestions,
    enrichmentSuggestions,
    requirements,
    jiraEpics
  };
}

export function parseWorkspaceOutputToAnalysisResult(input: WorkspaceOutputInput): WorkspaceParseResult {
  const raw = parseJson(input.content);
  const payload = resolvePayloadRoot(raw);
  if (!payload) {
    throw new Error('Workspace output is empty or unreadable.');
  }
  const warnings: string[] = [];
  const analysis = buildAnalysis(payload, warnings);
  return { analysis, warnings };
}

export function parseWorkspaceOutput(text: string): WorkspaceParseResult {
  return parseWorkspaceOutputToAnalysisResult({ fileName: 'workspace-output', content: text });
}
