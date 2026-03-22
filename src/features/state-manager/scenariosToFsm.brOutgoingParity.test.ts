import { describe, expect, it } from 'vitest';
import { scenariosToWorkflowSpec } from './scenariosToFsm';
import {
  BR_OUTGOING_ACTUAL_SPEC,
  BR_OUTGOING_COUNTRY_CODE,
  BR_OUTGOING_DIRECTION,
  BR_OUTGOING_GENERATION_OPTIONS,
  BR_OUTGOING_SEED_SCENARIOS,
  BR_OUTGOING_WORKFLOW_KEY
} from './validation/brOutgoingActual.fixture';
import { compareFsmSpecs, toTransitionComparisonKey } from './validation/compareFsmSpecs';
import { createBrOutgoingValidationReport } from './validation/brOutgoingValidationReport';
import { reverseEngineerFsm } from './validation/reverseEngineerFsm';

function generateBrOutgoingSpec() {
  return scenariosToWorkflowSpec(
    BR_OUTGOING_SEED_SCENARIOS,
    null,
    [],
    BR_OUTGOING_WORKFLOW_KEY,
    BR_OUTGOING_COUNTRY_CODE,
    BR_OUTGOING_DIRECTION,
    BR_OUTGOING_GENERATION_OPTIONS
  ).spec;
}

describe('scenariosToFsm BR outgoing parity', () => {
  it('matches the reverse-engineered BR outgoing baseline exactly', () => {
    const generated = generateBrOutgoingSpec();
    const comparison = compareFsmSpecs(BR_OUTGOING_ACTUAL_SPEC, generated);
    const report = createBrOutgoingValidationReport(generated);
    const generatedTransitionKeys = new Set(
      reverseEngineerFsm(generated).transitions.map((transition) =>
        toTransitionComparisonKey(transition.source, transition.eventName, transition.target)
      )
    );
    const requiredTransitionKeys = [
      'Init::DupCheckPassed::SpmCheck',
      'SanctionsSent::OnRetry::SanctionsSent',
      'SanctionsRespRepair::OnRetry::SanctionsSent',
      'SendClearingPostingPending::ClearingResponseReceived::SendClearingPostingPending',
      'NormalPostingPending::PostingSuccess::FinalPostingComplete'
    ];
    const missingRequiredTransitionKeys = requiredTransitionKeys.filter((key) => !generatedTransitionKeys.has(key));

    if (
      generated.startState !== 'Init' ||
      !comparison.startStateMatches ||
      !comparison.summary.exactStateParity ||
      !comparison.summary.exactTerminalParity ||
      !comparison.summary.exactTransitionParity ||
      !comparison.summary.exactActionParity ||
      comparison.orderingIssues.length > 0 ||
      missingRequiredTransitionKeys.length > 0
    ) {
      const extraDetails = missingRequiredTransitionKeys.length
        ? `\n\nMissing required transition keys:\n- ${missingRequiredTransitionKeys.join('\n- ')}`
        : '';
      throw new Error(`${report}${extraDetails}`);
    }

    expect(generated.startState).toBe('Init');
    expect(comparison.missingStates).toEqual([]);
    expect(comparison.extraStates).toEqual([]);
    expect(comparison.missingTerminalStates).toEqual([]);
    expect(comparison.extraTerminalStates).toEqual([]);
    expect(comparison.missingTransitions).toEqual([]);
    expect(comparison.extraTransitions).toEqual([]);
    expect(comparison.actionMismatches).toEqual([]);
    expect(comparison.orderingIssues).toEqual([]);
    expect(missingRequiredTransitionKeys).toEqual([]);
  });
});

