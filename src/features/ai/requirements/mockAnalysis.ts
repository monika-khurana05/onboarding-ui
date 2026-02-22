import type { CapabilityId } from './capabilities';
import type { RequirementAnalysisResult, JiraEpicDraft } from './analysisTypes';
import type { ExtractedRequirement, RequirementDocSource } from './types';

type DocRuleSpec = {
  docId: string;
  capabilityId: CapabilityId;
  requirement: Omit<ExtractedRequirement, 'id'>;
  epic: Omit<JiraEpicDraft, 'capabilityId' | 'linkedRequirements'> & {
    linkedRequirements?: string[];
  };
};

const capabilityConfidence: Record<CapabilityId, number> = {
  PAYMENT_INITIATION: 94,
  PAYMENT_ORCHESTRATION: 91,
  SANCTIONS: 88,
  CLEARING: 86,
  POSTING: 84,
  LIQUIDITY: 89,
  DATA: 83
};

const docRuleSpecs: DocRuleSpec[] = [
  {
    docId: 'AR-SANC-EMAIL-01',
    capabilityId: 'SANCTIONS',
    requirement: {
      category: 'Compliance',
      priority: 'MUST',
      title: 'Run sanctions screening before release.',
      description:
        'Ordering party and beneficiary must be screened against OFAC/AML watchlists prior to clearing release.',
      suggestedCapabilities: ['SANCTIONS'],
      confidence: 88,
      evidence: [
        {
          docId: 'AR-SANC-EMAIL-01',
          cite: 'thread 2',
          snippet: 'Ops requires pre-clearing watchlist checks for all parties.'
        }
      ],
      openQuestions: ['Confirm handling for near-match thresholds.']
    },
    epic: {
      title: 'Implement sanctions screening workflow for AR instant payments',
      summary: 'Run watchlist screening and capture audit outcomes before clearing release.',
      acceptanceCriteria: [
        'Sanctions screen runs prior to clearing release.',
        'Screening outcomes stored with audit metadata.',
        'Exceptions routed to compliance review queue.'
      ],
      scope: 'CODE_CHANGE',
      dependencies: ['PAYMENT_ORCHESTRATION']
    }
  },
  {
    docId: 'AR-CLEAR-REQ-02',
    capabilityId: 'CLEARING',
    requirement: {
      category: 'Routing',
      priority: 'MUST',
      title: 'Map clearing fields to AR scheme requirements.',
      description:
        'Populate clearingSystemMemId and scheme routing attributes based on the clearing mapping notes.',
      suggestedCapabilities: ['CLEARING'],
      confidence: 85,
      evidence: [
        {
          docId: 'AR-CLEAR-REQ-02',
          cite: 'section 3.1',
          snippet: 'Mapping table provides member IDs for AR clearing routing.'
        }
      ],
      openQuestions: ['Confirm mapping table effective date for cutover.']
    },
    epic: {
      title: 'Configure AR clearing field mappings',
      summary: 'Normalize clearing member IDs and apply scheme-specific routing transformations.',
      acceptanceCriteria: [
        'Mapping rules applied for all outgoing payments.',
        'ClearingSystemMemId validated and enriched.',
        'Routing transformations logged for audit.'
      ],
      scope: 'CONFIG_ONLY',
      dependencies: ['PAYMENT_INITIATION']
    }
  },
  {
    docId: 'AR-POST-EPIC-03',
    capabilityId: 'POSTING',
    requirement: {
      category: 'Data',
      priority: 'SHOULD',
      title: 'Emit ledger posting events after clearing.',
      description:
        'Publish accounting events with payment identifiers, settlement timestamps, and posting codes.',
      suggestedCapabilities: ['POSTING'],
      confidence: 82,
      evidence: [
        {
          docId: 'AR-POST-EPIC-03',
          cite: 'export tab',
          snippet: 'Posting epic requires emitting ledger entries for every settled payment.'
        }
      ],
      openQuestions: ['Clarify partial settlement posting schema.']
    },
    epic: {
      title: 'Publish posting events for AR payments',
      summary: 'Create ledger posting integration events with required accounting metadata.',
      acceptanceCriteria: [
        'Posting events emitted after clearing completion.',
        'Accounting codes align to AR chart of accounts.',
        'Events available to reconciliation feed.'
      ],
      scope: 'CODE_CHANGE',
      dependencies: ['CLEARING']
    }
  },
  {
    docId: 'AR-LIQ-RULES-01',
    capabilityId: 'LIQUIDITY',
    requirement: {
      category: 'Workflow',
      priority: 'MUST',
      title: 'Reserve liquidity before clearing release.',
      description:
        'Perform balance checks and reserve liquidity; reject payments exceeding configured limits.',
      suggestedCapabilities: ['LIQUIDITY'],
      confidence: 87,
      evidence: [
        {
          docId: 'AR-LIQ-RULES-01',
          cite: 'p.7',
          snippet: 'Liquidity reserve required prior to clearing release.'
        }
      ],
      openQuestions: ['Confirm intra-day limit refresh cadence.']
    },
    epic: {
      title: 'Implement liquidity reservation rules for AR',
      summary: 'Validate balances and reserve liquidity prior to clearing release.',
      acceptanceCriteria: [
        'Liquidity reserve created before clearing.',
        'Limit breaches trigger rejection reason codes.',
        'Reservations released on settlement.'
      ],
      scope: 'MIXED',
      dependencies: ['PAYMENT_ORCHESTRATION', 'CLEARING']
    }
  },
  {
    docId: 'AR-DATA-FEEDS-01',
    capabilityId: 'DATA',
    requirement: {
      category: 'Data',
      priority: 'SHOULD',
      title: 'Publish regulatory reporting and analytics feeds.',
      description:
        'Daily regulatory reports must include payment status, risk flags, and settlement totals.',
      suggestedCapabilities: ['DATA'],
      confidence: 81,
      evidence: [
        {
          docId: 'AR-DATA-FEEDS-01',
          cite: 'section 2.4',
          snippet: 'Reporting feed must include status and settlement totals.'
        }
      ],
      openQuestions: ['Define SLA for report delivery window.']
    },
    epic: {
      title: 'Deliver AR reporting and analytics feeds',
      summary: 'Persist and publish daily regulatory reporting feeds and analytics summaries.',
      acceptanceCriteria: [
        'Daily report file generated by 07:00 local time.',
        'Feed includes status, risk, and settlement totals.',
        'Data lineage documented for audit.'
      ],
      scope: 'CONFIG_ONLY',
      dependencies: ['POSTING']
    }
  }
];

function normalizeCountryCode(value: string) {
  const trimmed = value.trim().toUpperCase();
  return trimmed || 'AR';
}

function selectPrimaryDocId(normalizedCountry: string, docs: RequirementDocSource[]) {
  const preferred = `${normalizedCountry}-REG-001`;
  return docs.find((doc) => doc.id === preferred)?.id ?? docs[0]?.id ?? preferred;
}

function buildMappedCapabilities(
  requirements: ExtractedRequirement[]
): RequirementAnalysisResult['mappedCapabilities'] {
  const counts = new Map<CapabilityId, number>();
  requirements.forEach((req) => {
    req.suggestedCapabilities.forEach((capabilityId) => {
      counts.set(capabilityId, (counts.get(capabilityId) ?? 0) + 1);
    });
  });
  return Array.from(counts.entries()).map(([capabilityId, count]) => {
    const baseConfidence = capabilityConfidence[capabilityId] ?? 82;
    const confidence = Math.min(95, baseConfidence + (count > 1 ? 2 : 0));
    return {
      capabilityId,
      confidence,
      notes: `Identified in ${count} requirement${count === 1 ? '' : 's'}.`
    };
  });
}

export function runMockAnalysis(countryCode: string, docs: RequirementDocSource[]): RequirementAnalysisResult {
  const normalizedCountry = normalizeCountryCode(countryCode);
  const inputDocs = docs.length ? docs : [];
  const docIds = new Set(inputDocs.map((doc) => doc.id));
  const primaryDocId = selectPrimaryDocId(normalizedCountry, inputDocs);

  const requirements: ExtractedRequirement[] = [
    {
      id: `${normalizedCountry}-REQ-PI-001`,
      category: 'Validation',
      priority: 'MUST',
      title: 'Detect duplicate submissions by composite key (ccy + paymentId).',
      description:
        'Duplicate submissions must be detected using a composite key derived from currency and payment identifier.',
      suggestedCapabilities: ['PAYMENT_INITIATION', 'PAYMENT_ORCHESTRATION'],
      confidence: 93,
      evidence: [{ docId: primaryDocId, cite: 'p.12' }],
      openQuestions: []
    },
    {
      id: `${normalizedCountry}-REQ-PO-002`,
      category: 'Enrichment',
      priority: 'MUST',
      title: 'Derive missing clearingSystemMemId from participant profile.',
      description:
        'When clearingSystemMemId is missing, enrich from stored participant profile before orchestration.',
      suggestedCapabilities: ['PAYMENT_INITIATION', 'PAYMENT_ORCHESTRATION'],
      confidence: 89,
      evidence: [{ docId: primaryDocId, cite: 'p.18' }],
      openQuestions: ['Confirm whether profile fallback applies to retry flows.']
    }
  ];

  const jiraEpics: JiraEpicDraft[] = [
    {
      capabilityId: 'PAYMENT_INITIATION',
      title: 'Baseline validations and enrichments for AR payments',
      summary: 'Implement duplicate checks and enrichment wiring ahead of workflow execution.',
      acceptanceCriteria: [
        'Duplicate checks configured for currency + payment ID.',
        'ClearingSystemMemId enriched when missing.',
        'Validation failures emit standard error codes.'
      ],
      scope: 'CONFIG_ONLY',
      dependencies: [],
      linkedRequirements: [`${normalizedCountry}-REQ-PI-001`, `${normalizedCountry}-REQ-PO-002`]
    },
    {
      capabilityId: 'PAYMENT_ORCHESTRATION',
      title: 'Enforce orchestration gates for AR onboarding',
      summary: 'Ensure validation and enrichment steps run before clearing release.',
      acceptanceCriteria: [
        'Validation runs before enrichment and clearing.',
        'Enrichment failures follow retry policy.',
        'State transitions logged for audit.'
      ],
      scope: 'MIXED',
      dependencies: ['PAYMENT_INITIATION'],
      linkedRequirements: [`${normalizedCountry}-REQ-PI-001`, `${normalizedCountry}-REQ-PO-002`]
    }
  ];

  docRuleSpecs.forEach((spec) => {
    if (!docIds.has(spec.docId)) {
      return;
    }
    const requirementId = `${normalizedCountry}-REQ-${spec.capabilityId}-001`;
    requirements.push({
      id: requirementId,
      category: spec.requirement.category,
      priority: spec.requirement.priority,
      title: spec.requirement.title,
      description: spec.requirement.description,
      suggestedCapabilities: spec.requirement.suggestedCapabilities,
      confidence: spec.requirement.confidence,
      evidence: spec.requirement.evidence,
      openQuestions: spec.requirement.openQuestions
    });

    jiraEpics.push({
      capabilityId: spec.capabilityId,
      title: spec.epic.title,
      summary: spec.epic.summary,
      acceptanceCriteria: spec.epic.acceptanceCriteria,
      scope: spec.epic.scope,
      dependencies: spec.epic.dependencies,
      linkedRequirements: spec.epic.linkedRequirements ?? [requirementId]
    });
  });

  const mappedCapabilities = buildMappedCapabilities(requirements);
  const ambiguitiesCount = requirements.reduce((sum, req) => sum + (req.openQuestions.length > 0 ? 1 : 0), 0);
  const reuseOpportunityPct = inputDocs.length > 4 ? 60 : 70;

  return {
    countryCode: normalizedCountry,
    inputDocs,
    kpis: {
      requirementsFound: requirements.length,
      reuseOpportunityPct,
      discoveryTimeReductionPct: 60,
      ambiguitiesCount,
      manualErrorReductionPct: 40
    },
    mappedCapabilities,
    validationSuggestions: [
      {
        key: 'validation:DuplicateCheckRule',
        label: 'Duplicate Check Rule',
        impact: 'NEW_CATALOG_ITEM'
      }
    ],
    enrichmentSuggestions: [
      {
        key: 'enrichment:DebtorMembershipEnricher',
        label: 'Debtor Membership Enricher',
        impact: 'CONFIG_ONLY'
      }
    ],
    requirements,
    jiraEpics
  };
}
