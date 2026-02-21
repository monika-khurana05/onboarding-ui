import type { ParsedPain001, RequirementsAnalysis, SampleMessage, TestScenario, TestScenarioPack } from '../types';
import { removeTag, setTagText } from './xmlMutations';

export type ScenarioOptions = {
  happyPath: boolean;
  missingMandatory: boolean;
  invalidFormats: boolean;
  duplicate: boolean;
  cutoff: boolean;
  creditorAgentVariations: boolean;
};

export type GenerateScenarioPackInput = {
  countryCode?: string;
  flow?: 'INCOMING' | 'OUTGOING';
  parsedSamples: SampleMessage[];
  requirementsContext?: RequirementsAnalysis | null;
  toggles: ScenarioOptions;
};

type ScenarioRequirementHints = {
  requireDuplicate?: boolean;
  requireClearingMember?: boolean;
  requireDebtorAccount?: boolean;
  requireCreditorAccount?: boolean;
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

function includesRequired(text: string) {
  return text.includes('required') || text.includes('mandatory') || text.includes('must');
}

function includesDebtorAccount(text: string) {
  return (text.includes('debtor') && text.includes('account')) || text.includes('dbtracct');
}

function includesCreditorAccount(text: string) {
  return (text.includes('creditor') && text.includes('account')) || text.includes('cdtracct');
}

function deriveRequirementHints(
  requirements?: RequirementsAnalysis | null,
  flow?: 'INCOMING' | 'OUTGOING'
): ScenarioRequirementHints {
  if (!requirements) {
    return {};
  }

  const reqs = requirements.requirements ?? [];
  const normalizedReqs = reqs.map((req) => ({
    text: normalizeText(req.text),
    category: req.category,
    enrichments: req.suggestions.enrichments.length
  }));
  const traceTexts = (requirements.traceability?.testCases ?? []).flatMap((testCase) => [
    normalizeText(testCase.title),
    ...(testCase.steps ?? []).map((step) => normalizeText(step))
  ]);
  const allTexts = [...normalizedReqs.map((req) => req.text), ...traceTexts];

  const requireDuplicate = allTexts.some((text) => includesDuplicate(text));

  const clearingReqs = normalizedReqs.filter((req) => includesClearingMember(req.text));
  const requireClearingMember =
    clearingReqs.length > 0 || traceTexts.some((text) => includesClearingMember(text));
  let clearingMemberHandling: ScenarioRequirementHints['clearingMemberHandling'];
  if (requireClearingMember) {
    const enrichmentHit = clearingReqs.some(
      (req) => req.category === 'Enrichment' || includesDerive(req.text) || req.enrichments > 0
    );
    clearingMemberHandling = enrichmentHit && flow === 'OUTGOING' ? 'ENRICH' : 'REJECT';
  }

  const requireDebtorAccount =
    normalizedReqs.some(
      (req) =>
        (req.category === 'Validation' || includesRequired(req.text)) &&
        includesDebtorAccount(req.text)
    ) ||
    traceTexts.some((text) => includesRequired(text) && includesDebtorAccount(text));

  const requireCreditorAccount =
    normalizedReqs.some(
      (req) =>
        (req.category === 'Validation' || includesRequired(req.text)) &&
        includesCreditorAccount(req.text)
    ) ||
    traceTexts.some((text) => includesRequired(text) && includesCreditorAccount(text));

  return {
    requireDuplicate,
    requireClearingMember,
    requireDebtorAccount,
    requireCreditorAccount,
    clearingMemberHandling
  };
}

function setAccountTypeCode(
  xml: string,
  accountTag: 'DbtrAcct' | 'CdtrAcct',
  newValue: string
): string {
  const regex = new RegExp(`(<${accountTag}[\\s\\S]*?<Tp>[\\s\\S]*?<Cd>)([\\s\\S]*?)(</Cd>)`);
  if (!regex.test(xml)) {
    return xml;
  }
  return xml.replace(regex, `$1${newValue}$3`);
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

export function generateScenarioPack({
  countryCode,
  flow,
  parsedSamples,
  requirementsContext,
  toggles
}: GenerateScenarioPackInput): TestScenarioPack {
  const samples = parsedSamples ?? [];
  const scenarios: TestScenario[] = [];
  const requirementHints = deriveRequirementHints(requirementsContext, flow);
  const includeDuplicate = toggles.duplicate || Boolean(requirementHints.requireDuplicate);
  const includeMissingDebtor = toggles.missingMandatory || Boolean(requirementHints.requireDebtorAccount);
  const includeMissingCreditor = toggles.missingMandatory || Boolean(requirementHints.requireCreditorAccount);
  const includeMissingMsgId = toggles.missingMandatory;
  const includeInvalidFormats = toggles.invalidFormats;
  const includeCutoff = toggles.cutoff;
  const includeHappyPath = toggles.happyPath;
  const includeCreditorAgent =
    toggles.creditorAgentVariations || Boolean(requirementHints.requireClearingMember);
  const duplicateNotes = requirementHints.requireDuplicate ? 'Requirement-driven duplicate detection.' : undefined;
  const clearingHandling = requirementHints.clearingMemberHandling ?? 'REJECT';

  const clearingMemberValues = samples.map((sample) => sample.parsed.creditorAgent.clrSysMmbId);
  const clearingMemberSometimesMissing =
    clearingMemberValues.some((value) => Boolean(value)) && clearingMemberValues.some((value) => !value);

  const accountTypeCandidates = samples.map((sample) => {
    const debtorType = sample.parsed.debtor.accountTypeCd;
    const creditorType = sample.parsed.creditor.accountTypeCd;
    const accountType = debtorType ?? creditorType ?? null;
    const accountTag = debtorType ? 'DbtrAcct' : creditorType ? 'CdtrAcct' : null;
    return { sample, accountType, accountTag };
  });
  const accountTypeValues = accountTypeCandidates
    .map((entry) => entry.accountType)
    .filter((value): value is string => Boolean(value));
  const distinctAccountTypes = Array.from(new Set(accountTypeValues));
  const accountTypeVaries = distinctAccountTypes.length > 1;

  samples.forEach((sample, index) => {
    const sampleIndex = index + 1;
    const hasMultipleSamples = samples.length > 1;
    const titlePrefix = hasMultipleSamples ? `Sample ${sampleIndex}: ` : '';
    const scenarioIdFor = (suffix: string) => `S${sampleIndex}-${suffix}`;
    const baseXml = sample.xml;
    const parsed = sample.parsed;
    const msgIdLabel = parsed.groupHeader.msgId ?? 'unknown';

    if (includeHappyPath) {
      scenarios.push(
        buildScenario(
          `SMOKE-HP-${sampleIndex}`,
          `Happy path (MsgId: ${msgIdLabel})`,
          'POSITIVE',
          ['No mutation'],
          { state: 'ACCEPTED', notes: 'Baseline acceptance path' },
          baseXml,
          parsed,
          sample.sampleId
        )
      );
    }

    if (includeMissingDebtor && parsed.debtor.accountId) {
      scenarios.push(
        buildScenario(
          scenarioIdFor('NEG-MISSING-DEBTOR'),
          `${titlePrefix}Missing debtor account`,
          'NEGATIVE',
          ['Remove DbtrAcct'],
          { state: 'REJECTED', errorCode: 'MISSING_DEBTOR_ACCOUNT' },
          removeTag(baseXml, 'DbtrAcct'),
          parsed,
          sample.sampleId
        )
      );
    }

    if (includeMissingCreditor && parsed.creditor.accountId) {
      scenarios.push(
        buildScenario(
          scenarioIdFor('NEG-MISSING-CREDITOR'),
          `${titlePrefix}Missing creditor account`,
          'NEGATIVE',
          ['Remove CdtrAcct'],
          { state: 'REJECTED', errorCode: 'MISSING_CREDITOR_ACCOUNT' },
          removeTag(baseXml, 'CdtrAcct'),
          parsed,
          sample.sampleId
        )
      );
    }

    if (includeMissingMsgId && parsed.groupHeader.msgId) {
      scenarios.push(
        buildScenario(
          scenarioIdFor('NEG-MISSING-MSGID'),
          `${titlePrefix}Missing message ID`,
          'NEGATIVE',
          ['Remove MsgId'],
          { state: 'REJECTED', errorCode: 'MISSING_MESSAGE_ID' },
          removeTag(baseXml, 'MsgId'),
          parsed,
          sample.sampleId
        )
      );
    }

    if (includeInvalidFormats) {
      if (parsed.groupHeader.creDtTm) {
        scenarios.push(
          buildScenario(
            scenarioIdFor('NEG-INVALID-CREDTTM'),
            `${titlePrefix}Invalid creation timestamp`,
            'NEGATIVE',
            ['Set CreDtTm to invalid format'],
            { state: 'REJECTED', errorCode: 'INVALID_TIMESTAMP' },
            setTagText(baseXml, 'CreDtTm', '2026-99-99T00:00:00Z'),
            parsed,
            sample.sampleId
          )
        );
      }
      if (parsed.groupHeader.ctrlSum) {
        scenarios.push(
          buildScenario(
            scenarioIdFor('NEG-INVALID-CTRLSUM'),
            `${titlePrefix}Control sum non-numeric`,
            'NEGATIVE',
            ['Set CtrlSum to non-numeric'],
            { state: 'REJECTED', errorCode: 'INVALID_CTRL_SUM' },
            setTagText(baseXml, 'CtrlSum', 'NOT_A_NUMBER'),
            parsed,
            sample.sampleId
          )
        );
      }
      if (parsed.groupHeader.nbOfTxs) {
        const nbOfTxs = Number(parsed.groupHeader.nbOfTxs ?? '1') || 1;
        scenarios.push(
          buildScenario(
            scenarioIdFor('NEG-NBOFTXS-MISMATCH'),
            `${titlePrefix}Control sum / NbOfTxs mismatch`,
            'NEGATIVE',
            [`Set NbOfTxs to ${nbOfTxs + 1}`],
            { state: 'REJECTED', errorCode: 'CONTROL_MISMATCH' },
            setTagText(baseXml, 'NbOfTxs', String(nbOfTxs + 1)),
            parsed,
            sample.sampleId
          )
        );
      }
    }

    if (includeCutoff && parsed.paymentInfo.reqdExctnDt) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      scenarios.push(
        buildScenario(
          scenarioIdFor('NEG-CUTOFF-DATE'),
          `${titlePrefix}Execution date in the past`,
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
          scenarioIdFor('NEG-DUPLICATE'),
          `${titlePrefix}Duplicate submission`,
          'NEGATIVE',
          ['Resend same MsgId + PmtInfId'],
          { state: 'REJECTED', errorCode: 'DUPLICATE_PAYMENT', notes: duplicateNotes },
          baseXml,
          parsed,
          sample.sampleId
        )
      );
    }
  });

  const clearingSample = samples.find((sample) => sample.parsed.creditorAgent.clrSysMmbId);
  if ((includeCreditorAgent || clearingMemberSometimesMissing) && clearingSample) {
    const isEnrichment = clearingHandling === 'ENRICH';
    scenarios.push(
      buildScenario(
        `S${samples.indexOf(clearingSample) + 1}-NEG-MISSING-CLRMBR`,
        isEnrichment ? 'Missing clearing member triggers enrichment' : 'Missing creditor clearing member ID',
        'NEGATIVE',
        ['Remove ClrSysMmbId'],
        isEnrichment
          ? { state: 'NEEDS_ENRICHMENT', notes: 'Derive clearing member ID per requirements.' }
          : { state: 'REJECTED', errorCode: 'MISSING_CLEARING_MEMBER' },
        removeTag(clearingSample.xml, 'ClrSysMmbId'),
        clearingSample.parsed,
        clearingSample.sampleId
      )
    );
  }

  if ((toggles.creditorAgentVariations || accountTypeVaries) && accountTypeVaries) {
    const target = accountTypeCandidates.find((entry) => entry.accountType && entry.accountTag);
    if (target && target.accountType && target.accountTag) {
      const altType = distinctAccountTypes.find((value) => value !== target.accountType) ?? target.accountType;
      scenarios.push(
        buildScenario(
          `S${samples.indexOf(target.sample) + 1}-VAR-ACCT-TYPE`,
          `Account type variation (${target.accountType} → ${altType})`,
          'POSITIVE',
          [`Set ${target.accountTag}.Tp.Cd to ${altType}`],
          { state: 'ACCEPTED', notes: 'Account type variation' },
          setAccountTypeCode(target.sample.xml, target.accountTag, altType),
          target.sample.parsed,
          target.sample.sampleId
        )
      );
    }
  }

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
    options: toggles
  };
}
