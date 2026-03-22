import type { StateSpec, WorkflowSpec } from '../../../models/snapshot';
import { reverseEngineerFsm } from './reverseEngineerFsm';
import type { FsmActionMismatch, FsmComparisonReport, ReverseEngineeredTransition } from './types';

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasOutgoingTransitions(state: Pick<StateSpec, 'onEvent'>): boolean {
  return Object.keys(state.onEvent ?? {}).length > 0;
}

export function toTransitionComparisonKey(source: string, eventName: string, target: string): string {
  return `${source}::${eventName}::${target}`;
}

function mapTransitions(transitions: readonly ReverseEngineeredTransition[]): Map<string, ReverseEngineeredTransition> {
  return new Map(
    transitions.map((transition) => [
      toTransitionComparisonKey(transition.source, transition.eventName, transition.target),
      transition
    ])
  );
}

function findOrderingIssues(spec: WorkflowSpec): string[] {
  const issues: string[] = [];
  const orderedStateNames = spec.states.map((state) => state.name.trim()).filter(Boolean);
  const startState = spec.startState?.trim() ?? '';

  if (startState) {
    if (!orderedStateNames.includes(startState)) {
      issues.push(`Start state "${startState}" is missing from spec.states.`);
    } else if (orderedStateNames[0] !== startState) {
      issues.push(`Start state "${startState}" is not first in spec.states.`);
    }
  }

  let firstTerminalState: string | null = null;
  spec.states.forEach((state) => {
    const stateName = state.name.trim();
    if (!stateName) {
      return;
    }

    if (!hasOutgoingTransitions(state)) {
      firstTerminalState ??= stateName;
      return;
    }

    if (firstTerminalState) {
      const message = `Terminal state "${firstTerminalState}" appears before non-terminal state "${stateName}".`;
      if (!issues.includes(message)) {
        issues.push(message);
      }
    }
  });

  return issues.sort(compareStrings);
}

function compareActionMismatches(
  expectedTransitions: Map<string, ReverseEngineeredTransition>,
  actualTransitions: Map<string, ReverseEngineeredTransition>
): FsmActionMismatch[] {
  return [...expectedTransitions.entries()]
    .filter(([key]) => actualTransitions.has(key))
    .map(([key, expectedTransition]) => {
      const actualTransition = actualTransitions.get(key);
      if (!actualTransition || arraysEqual(expectedTransition.actions, actualTransition.actions)) {
        return null;
      }

      return {
        source: expectedTransition.source,
        eventName: expectedTransition.eventName,
        target: expectedTransition.target,
        expectedActions: [...expectedTransition.actions],
        actualActions: [...actualTransition.actions]
      } satisfies FsmActionMismatch;
    })
    .filter((mismatch): mismatch is FsmActionMismatch => mismatch !== null)
    .sort((left, right) => {
      const sourceCompare = compareStrings(left.source, right.source);
      if (sourceCompare !== 0) {
        return sourceCompare;
      }

      const eventCompare = compareStrings(left.eventName, right.eventName);
      if (eventCompare !== 0) {
        return eventCompare;
      }

      return compareStrings(left.target, right.target);
    });
}

export function compareFsmSpecs(actual: WorkflowSpec, generated: WorkflowSpec): FsmComparisonReport {
  const expected = reverseEngineerFsm(actual);
  const observed = reverseEngineerFsm(generated);

  const expectedStateSet = new Set(expected.stateNames);
  const observedStateSet = new Set(observed.stateNames);
  const expectedTerminalSet = new Set(expected.terminalStates);
  const observedTerminalSet = new Set(observed.terminalStates);
  const expectedTransitionMap = mapTransitions(expected.transitions);
  const observedTransitionMap = mapTransitions(observed.transitions);

  const missingStates = expected.stateNames.filter((stateName) => !observedStateSet.has(stateName));
  const extraStates = observed.stateNames.filter((stateName) => !expectedStateSet.has(stateName));
  const missingTerminalStates = expected.terminalStates.filter((stateName) => !observedTerminalSet.has(stateName));
  const extraTerminalStates = observed.terminalStates.filter((stateName) => !expectedTerminalSet.has(stateName));
  const missingTransitions = [...expectedTransitionMap.keys()]
    .filter((key) => !observedTransitionMap.has(key))
    .sort(compareStrings);
  const extraTransitions = [...observedTransitionMap.keys()]
    .filter((key) => !expectedTransitionMap.has(key))
    .sort(compareStrings);
  const actionMismatches = compareActionMismatches(expectedTransitionMap, observedTransitionMap);
  const orderingIssues = findOrderingIssues(generated);

  return {
    startStateMatches: expected.startState === observed.startState,
    missingStates,
    extraStates,
    missingTerminalStates,
    extraTerminalStates,
    missingTransitions,
    extraTransitions,
    actionMismatches,
    orderingIssues,
    summary: {
      exactStateParity: missingStates.length === 0 && extraStates.length === 0,
      exactTerminalParity: missingTerminalStates.length === 0 && extraTerminalStates.length === 0,
      exactTransitionParity: missingTransitions.length === 0 && extraTransitions.length === 0,
      exactActionParity: actionMismatches.length === 0
    }
  };
}

