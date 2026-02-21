import type { ParsedPain001, TestScenario, TestScenarioPack } from '../types';
import { removeTag, setTagText } from './xmlMutations';

export type ScenarioOptions = {
  happyPath: boolean;
  missingMandatory: boolean;
  invalidFormats: boolean;
  duplicateSubmission: boolean;
  cutoffEdge: boolean;
  creditorAgentVariations: boolean;
};

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function buildScenario(
  scenarioId: string,
  title: string,
  type: TestScenario['type'],
  mutations: string[],
  expectedOutcome: TestScenario['expectedOutcome'],
  xmlVariant: string,
  parsed: ParsedPain001
): TestScenario {
  return {
    scenarioId,
    title,
    type,
    mutations,
    expectedOutcome,
    xmlVariant,
    extractedFieldsSnapshot: parsed
  };
}

export function generateTestScenarioPack(
  baseXml: string,
  parsed: ParsedPain001,
  options: ScenarioOptions,
  countryCode?: string
): TestScenarioPack {
  const scenarios: TestScenario[] = [];

  if (options.happyPath) {
    scenarios.push(
      buildScenario(
        'TC-SMOKE-001',
        'Happy path payment',
        'POSITIVE',
        ['No mutation'],
        { state: 'ACCEPTED', notes: 'Baseline acceptance path' },
        baseXml,
        parsed
      )
    );
  }

  if (options.missingMandatory) {
    scenarios.push(
      buildScenario(
        'TC-NEG-001',
        'Missing debtor account',
        'NEGATIVE',
        ['Remove DbtrAcct'],
        { state: 'REJECTED', errorCode: 'MISSING_DEBTOR_ACCOUNT' },
        removeTag(baseXml, 'DbtrAcct'),
        parsed
      )
    );
    scenarios.push(
      buildScenario(
        'TC-NEG-002',
        'Missing creditor account',
        'NEGATIVE',
        ['Remove CdtrAcct'],
        { state: 'REJECTED', errorCode: 'MISSING_CREDITOR_ACCOUNT' },
        removeTag(baseXml, 'CdtrAcct'),
        parsed
      )
    );
    scenarios.push(
      buildScenario(
        'TC-NEG-003',
        'Missing message ID',
        'NEGATIVE',
        ['Remove MsgId'],
        { state: 'REJECTED', errorCode: 'MISSING_MESSAGE_ID' },
        removeTag(baseXml, 'MsgId'),
        parsed
      )
    );
    const nbOfTxs = Number(parsed.groupHeader.nbOfTxs ?? '1') || 1;
    scenarios.push(
      buildScenario(
        'TC-NEG-004',
        'Control sum / NbOfTxs mismatch',
        'NEGATIVE',
        [`Set NbOfTxs to ${nbOfTxs + 1}`],
        { state: 'REJECTED', errorCode: 'CONTROL_MISMATCH' },
        setTagText(baseXml, 'NbOfTxs', String(nbOfTxs + 1)),
        parsed
      )
    );
  }

  if (options.invalidFormats) {
    scenarios.push(
      buildScenario(
        'TC-NEG-005',
        'Invalid creation timestamp',
        'NEGATIVE',
        ['Set CreDtTm to invalid format'],
        { state: 'REJECTED', errorCode: 'INVALID_TIMESTAMP' },
        setTagText(baseXml, 'CreDtTm', '2026-99-99T00:00:00Z'),
        parsed
      )
    );
  }

  if (options.cutoffEdge) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    scenarios.push(
      buildScenario(
        'TC-NEG-006',
        'Execution date in the past',
        'NEGATIVE',
        ['Set ReqdExctnDt to yesterday'],
        { state: 'REJECTED', errorCode: 'INVALID_EXECUTION_DATE' },
        setTagText(baseXml, 'ReqdExctnDt', formatDate(yesterday)),
        parsed
      )
    );
  }

  if (options.duplicateSubmission) {
    scenarios.push(
      buildScenario(
        'TC-NEG-007',
        'Duplicate submission',
        'NEGATIVE',
        ['Resend same MsgId + PmtInfId'],
        { state: 'REJECTED', errorCode: 'DUPLICATE_PAYMENT' },
        baseXml,
        parsed
      )
    );
  }

  if (options.creditorAgentVariations) {
    scenarios.push(
      buildScenario(
        'TC-NEG-008',
        'Missing creditor clearing member ID',
        'NEGATIVE',
        ['Remove ClrSysMmbId'],
        { state: 'REJECTED', errorCode: 'MISSING_CLEARING_MEMBER' },
        removeTag(baseXml, 'ClrSysMmbId'),
        parsed
      )
    );
  }

  return {
    meta: {
      countryCode,
      generatedAt: new Date().toISOString(),
      baseMessageType: parsed.messageType
    },
    baseXml,
    parsed,
    scenarios,
    options
  };
}
