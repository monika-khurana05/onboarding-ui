import type { WorkflowSpec } from '../../../models/snapshot';
import { BR_OUTGOING_ACTUAL_SPEC } from './brOutgoingActual.fixture';
import { compareFsmSpecs } from './compareFsmSpecs';
import type { FsmActionMismatch, FsmComparisonReport } from './types';

function formatListSection(title: string, items: readonly string[]): string {
  const lines = items.length > 0 ? items.map((item) => `- ${item}`) : ['- None'];
  return [`## ${title}`, ...lines].join('\n');
}

function formatActionMismatch(mismatch: FsmActionMismatch): string {
  return [
    `- ${mismatch.source}::${mismatch.eventName}::${mismatch.target}`,
    `  expected: [ ${mismatch.expectedActions.join(', ')} ]`,
    `  actual: [ ${mismatch.actualActions.join(', ')} ]`
  ].join('\n');
}

export function formatBrOutgoingValidationReport(report: FsmComparisonReport): string {
  const verdict =
    report.startStateMatches &&
    report.summary.exactStateParity &&
    report.summary.exactTerminalParity &&
    report.summary.exactTransitionParity &&
    report.summary.exactActionParity &&
    report.orderingIssues.length === 0
      ? 'PASS'
      : 'FAIL';

  const actionMismatchSection = [
    '## Action mismatches',
    ...(report.actionMismatches.length > 0
      ? report.actionMismatches.map(formatActionMismatch)
      : ['- None'])
  ].join('\n');

  return [
    '# BR Outgoing FSM Validation',
    '## Start state',
    `- Matches expected baseline: ${report.startStateMatches ? 'yes' : 'no'}`,
    formatListSection('Missing states', report.missingStates),
    formatListSection('Extra states', report.extraStates),
    formatListSection('Missing terminal states', report.missingTerminalStates),
    formatListSection('Extra terminal states', report.extraTerminalStates),
    formatListSection('Missing transitions', report.missingTransitions),
    formatListSection('Extra transitions', report.extraTransitions),
    actionMismatchSection,
    formatListSection('Ordering issues', report.orderingIssues),
    '## Final verdict',
    `- ${verdict}`,
    `- exactStateParity: ${report.summary.exactStateParity}`,
    `- exactTerminalParity: ${report.summary.exactTerminalParity}`,
    `- exactTransitionParity: ${report.summary.exactTransitionParity}`,
    `- exactActionParity: ${report.summary.exactActionParity}`
  ].join('\n\n');
}

export function compareAgainstBrOutgoingActual(generated: WorkflowSpec): FsmComparisonReport {
  return compareFsmSpecs(BR_OUTGOING_ACTUAL_SPEC, generated);
}

export function createBrOutgoingValidationReport(generated: WorkflowSpec): string {
  return formatBrOutgoingValidationReport(compareAgainstBrOutgoingActual(generated));
}

