import type { WorkflowSpec } from '../../../models/snapshot';
import type { ReverseEngineeredFsm, ReverseEngineeredTransition } from './types';

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function normalizeName(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeActions(actions: readonly string[] | undefined): string[] {
  return (actions ?? []).map((action) => action.trim()).filter((action) => action.length > 0);
}

function compareTransitions(left: ReverseEngineeredTransition, right: ReverseEngineeredTransition): number {
  const sourceCompare = compareStrings(left.source, right.source);
  if (sourceCompare !== 0) {
    return sourceCompare;
  }

  const eventCompare = compareStrings(left.eventName, right.eventName);
  if (eventCompare !== 0) {
    return eventCompare;
  }

  return compareStrings(left.target, right.target);
}

export function reverseEngineerFsm(spec: WorkflowSpec): ReverseEngineeredFsm {
  const stateNames = [...new Set(spec.states.map((state) => normalizeName(state.name)).filter(Boolean))].sort(compareStrings);
  const terminalStates = spec.states
    .filter((state) => Object.keys(state.onEvent ?? {}).length === 0)
    .map((state) => normalizeName(state.name))
    .filter(Boolean)
    .filter((stateName, index, values) => values.indexOf(stateName) === index)
    .sort(compareStrings);

  const transitions = spec.states
    .flatMap((state) => {
      const source = normalizeName(state.name);
      if (!source) {
        return [];
      }

      return Object.entries(state.onEvent ?? {}).flatMap(([eventName, transition]) => {
        const normalizedEventName = normalizeName(eventName);
        const target = normalizeName(transition?.target);
        if (!normalizedEventName || !target) {
          return [];
        }

        return [
          {
            source,
            eventName: normalizedEventName,
            target,
            actions: normalizeActions(transition?.actions)
          } satisfies ReverseEngineeredTransition
        ];
      });
    })
    .sort(compareTransitions);

  const startState = normalizeName(spec.startState) || undefined;

  return {
    startState,
    stateNames,
    terminalStates,
    transitions
  };
}

