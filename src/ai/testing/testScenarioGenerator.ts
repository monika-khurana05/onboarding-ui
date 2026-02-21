import type { ParsedPain001, RequirementsAnalysis, SampleMessage, TestScenario, TestScenarioPack } from '../types';
import { removeTag, setTagText } from './xmlMutations';

export type ScenarioOptions = {
  happyPath: boolean;
  missingMandatory: boolean;
  invalidFormats: boolean;
  duplicateSubmission: boolean;
  cutoffEdge: boolean;
  creditorAgentVariations: boolean;
};

type ScenarioRequirementHints = {
  forceDuplicateSubmission?: boolean;
  clearingMemberHandling?: 'REJECT' | 'ENRICH';
};

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function normalizeText(value?: string | null) {
  return (value ?? '').toLowerCase();
}

function includesDuplicate(text: string) {
  return text.includes('duplicate');
}

function includesClearingMember(text: string) {
  return (
    (text.includes('clearing') && text.includes('member')) ||
    text.includes('clrsysmmbid') ||
    text.includes('clearingsystemmemid')
  );
}

function includesDerive(text: string) {
  return text.includes('derive') || text.includes('enrich');
}

function deriveRequirementHints(
  requirements?: RequirementsAnalysis | null,
  flow?: 'INCOMING' | 'OUTGOING'
): ScenarioRequirementHints {
  if (!requirements) {
    return {};
  }

  const reqs = requirements.requirements ?? [];
  const duplicateFromReqs = reqs.some((req) => includesDuplicate(normalizeText(req.text)));
  const duplicateFromTrace = (requirements.traceability?.testCases ?? []).some((testCase) => {
    const titleHit = includesDuplicate(normalizeText(testCase.title));
    const stepHit = (testCase.steps ?? []).some((step) => includesDuplicate(normalizeText(step)));
    return titleHit || stepHit;
  });

  let clearingMemberHandling: ScenarioRequirementHints['clearingMemberHandling'];
  if (flow === 'OUTGOING') {
    const clearingReqs = reqs.filter((req) => includesClearingMember(normalizeText(req.text)));
    if (clearingReqs.length > 0) {
      const enrichmentHit = clearingReqs.some(
        (req) =>
          req.category === 'Enrichment' ||
          includesDerive(normalizeText(req.text)) ||
          req.suggestions.enrichments.length > 0
      );
      clearingMemberHandling = enrichmentHit ? 'ENRICH' : 'REJECT';
    }
  }

  return {
    forceDuplicateSubmission: duplicateFromReqs || duplicateFromTrace,
    clearingMemberHandling
  };
}

function buildScenario(
  scenarioId: string,
  title: string,
  type: TestScenario['type'],
  mutations: string[],
  expectedOutcome: TestScenario['expectedOutcome'],
  xmlVariant: string,
  parsed: ParsedPain001,
  sourceSampleId?: string
): TestScenario {
  return {
    scenarioId,
    title,
    type,
    mutations,
    expectedOutcome,
    xmlVariant,
    extractedFieldsSnapshot: parsed,
    sourceSampleId
  };
}

export function generateTestScenarioPack(
  samples: SampleMessage[],
  options: ScenarioOptions,
  countryCode?: string,
  flow?: 'INCOMING' | 'OUTGOING',
  requirements?: RequirementsAnalysis | null
): TestScenarioPack {
  const scenarios: TestScenario[] = [];
  const requirementHints = deriveRequirementHints(requirements, flow);
  const includeDuplicate = options.duplicateSubmission || Boolean(requirementHints.forceDuplicateSubmission);
  const includeCreditorAgent =
    options.creditorAgentVariations || Boolean(requirementHints.clearingMemberHandling);
  const duplicateNotes = requirementHints.forceDuplicateSubmission ? 'Requirement-driven duplicate detection.' : undefined;
  const clearingHandling = requirementHints.clearingMemberHandling ?? 'REJECT';

  samples.forEach((sample, index) => {
    const hasMultipleSamples = samples.length > 1;
    const scenarioPrefix = hasMultipleSamples ? `S${index + 1}-` : '';
    const titlePrefix = hasMultipleSamples ? `Sample ${index + 1}: ` : '';
    const scenarioIdFor = (id: string) => `${scenarioPrefix}${id}`;
    const titleFor = (title: string) => `${titlePrefix}${title}`;
    const baseXml = sample.xml;
    const parsed = sample.parsed;

    if (options.happyPath) {
      scenarios.push(
        buildScenario(
          scenarioIdFor('TC-SMOKE-001'),
          titleFor('Happy path payment'),
          'POSITIVE',
          ['No mutation'],
          { state: 'ACCEPTED', notes: 'Baseline acceptance path' },
          baseXml,
          parsed,
          sample.sampleId
        )
      );
    }

    if (options.missingMandatory) {
      scenarios.push(
        buildScenario(
          scenarioIdFor('TC-NEG-001'),
          titleFor('Missing debtor account'),
          'NEGATIVE',
          ['Remove DbtrAcct'],
          { state: 'REJECTED', errorCode: 'MISSING_DEBTOR_ACCOUNT' },
          removeTag(baseXml, 'DbtrAcct'),
          parsed,
          sample.sampleId
        )
      );
      scenarios.push(
        buildScenario(
          scenarioIdFor('TC-NEG-002'),
          titleFor('Missing creditor account'),
          'NEGATIVE',
          ['Remove CdtrAcct'],
          { state: 'REJECTED', errorCode: 'MISSING_CREDITOR_ACCOUNT' },
          removeTag(baseXml, 'CdtrAcct'),
          parsed,
          sample.sampleId
        )
      );
      scenarios.push(
        buildScenario(
          scenarioIdFor('TC-NEG-003'),
          titleFor('Missing message ID'),
          'NEGATIVE',
          ['Remove MsgId'],
          { state: 'REJECTED', errorCode: 'MISSING_MESSAGE_ID' },
          removeTag(baseXml, 'MsgId'),
          parsed,
          sample.sampleId
        )
      );
      const nbOfTxs = Number(parsed.groupHeader.nbOfTxs ?? '1') || 1;
      scenarios.push(
        buildScenario(
          scenarioIdFor('TC-NEG-004'),
          titleFor('Control sum / NbOfTxs mismatch'),
          'NEGATIVE',
          [`Set NbOfTxs to ${nbOfTxs + 1}`],
          { state: 'REJECTED', errorCode: 'CONTROL_MISMATCH' },
          setTagText(baseXml, 'NbOfTxs', String(nbOfTxs + 1)),
          parsed,
          sample.sampleId
        )
      );
    }

    if (options.invalidFormats) {
      scenarios.push(
        buildScenario(
          scenarioIdFor('TC-NEG-005'),
          titleFor('Invalid creation timestamp'),
          'NEGATIVE',
          ['Set CreDtTm to invalid format'],
          { state: 'REJECTED', errorCode: 'INVALID_TIMESTAMP' },
          setTagText(baseXml, 'CreDtTm', '2026-99-99T00:00:00Z'),
          parsed,
          sample.sampleId
        )
      );
    }

    if (options.cutoffEdge) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      scenarios.push(
        buildScenario(
          scenarioIdFor('TC-NEG-006'),
          titleFor('Execution date in the past'),
          'NEGATIVE',
          ['Set ReqdExctnDt to yesterday'],
          { state: 'REJECTED', errorCode: 'INVALID_EXECUTION_DATE' },
          setTagText(baseXml, 'ReqdExctnDt', formatDate(yesterday)),
          parsed,
          sample.sampleId
        )
      );
    }

    if (includeDuplicate) {
      scenarios.push(
        buildScenario(
          scenarioIdFor('TC-NEG-007'),
          titleFor('Duplicate submission'),
          'NEGATIVE',
          ['Resend same MsgId + PmtInfId'],
          { state: 'REJECTED', errorCode: 'DUPLICATE_PAYMENT', notes: duplicateNotes },
          baseXml,
          parsed,
          sample.sampleId
        )
      );
    }

    if (includeCreditorAgent) {
      const isEnrichment = clearingHandling === 'ENRICH';
      scenarios.push(
        buildScenario(
          scenarioIdFor('TC-NEG-008'),
          titleFor(isEnrichment ? 'Missing clearing member triggers enrichment' : 'Missing creditor clearing member ID'),
          'NEGATIVE',
          ['Remove ClrSysMmbId'],
          isEnrichment
            ? { state: 'NEEDS_ENRICHMENT', notes: 'Derive clearing member ID per requirements.' }
            : { state: 'REJECTED', errorCode: 'MISSING_CLEARING_MEMBER' },
          removeTag(baseXml, 'ClrSysMmbId'),
          parsed,
          sample.sampleId
        )
      );
    }
  });

  const primarySample = samples[0];
  const baseXml = primarySample?.xml ?? '';
  const parsed = primarySample?.parsed ?? {
    messageType: 'unknown',
    groupHeader: { msgId: null, creDtTm: null, nbOfTxs: null, ctrlSum: null, initgPtyNm: null },
    paymentInfo: { pmtInfId: null, pmtMtd: null, svcLvlCd: null, lclInstrmPrtry: null, reqdExctnDt: null },
    debtor: { name: null, accountId: null, accountTypeCd: null },
    creditor: { name: null, postalAdrLine: null, accountId: null, accountTypeCd: null },
    creditorAgent: { clrSysMmbId: null, othrId: null, brcId: null, othrSchemeCd: null },
    currency: null
  };

  return {
    meta: {
      countryCode,
      generatedAt: new Date().toISOString(),
      baseMessageType: parsed.messageType,
      flow
    },
    baseXml,
    parsed,
    samples,
    scenarios,
    options
  };
}
