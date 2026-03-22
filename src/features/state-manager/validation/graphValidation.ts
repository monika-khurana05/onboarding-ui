import type { WorkflowSpec } from '../../../models/snapshot';
import type { AnalysisModel } from '../analysis/types';
import type { GraphValidationIssue, GraphValidationReport } from './types';

export type GraphValidationContext = {
  analysis?: AnalysisModel;
  terminalStates?: ReadonlySet<string>;
  presetRetainedStates?: ReadonlySet<string>;
};

function normalizeKey(value: string): string {
  return value.trim().toUpperCase();
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function compareIssue(left: GraphValidationIssue, right: GraphValidationIssue): number {
  if (left.severity !== right.severity) {
    return left.severity === 'ERROR' ? -1 : 1;
  }

  const codeCompare = left.code.localeCompare(right.code);
  if (codeCompare !== 0) {
    return codeCompare;
  }

  const messageCompare = left.message.localeCompare(right.message);
  if (messageCompare !== 0) {
    return messageCompare;
  }

  return (left.details ?? []).join('|').localeCompare((right.details ?? []).join('|'));
}

function hasMeaningfulExit(spec: WorkflowSpec, stateName: string): boolean {
  const state = spec.states.find((entry) => entry.name === stateName);
  if (!state) {
    return false;
  }

  return Object.values(state.onEvent ?? {}).some((transition) => transition?.target?.trim() && transition.target !== stateName);
}

function buildReachableStates(spec: WorkflowSpec): Set<string> {
  const reachable = new Set<string>();
  const stateMap = new Map(spec.states.map((state) => [state.name, state]));
  const startState = spec.startState?.trim();
  if (!startState || !stateMap.has(startState)) {
    return reachable;
  }

  const queue = [startState];
  reachable.add(startState);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const state = stateMap.get(current);
    if (!state) {
      continue;
    }

    Object.values(state.onEvent ?? {})
      .map((transition) => transition?.target?.trim() ?? '')
      .filter(Boolean)
      .sort(compareStrings)
      .forEach((target) => {
        if (reachable.has(target) || !stateMap.has(target)) {
          return;
        }
        reachable.add(target);
        queue.push(target);
      });
  }

  return reachable;
}

export function validateGeneratedWorkflow(
  spec: WorkflowSpec,
  context: GraphValidationContext = {}
): GraphValidationReport {
  const issues: GraphValidationIssue[] = [];
  const stateMap = new Map(spec.states.map((state) => [state.name.trim(), state]));
  const stateNames = spec.states.map((state) => state.name.trim()).filter(Boolean);
  const stateSet = new Set(stateNames);
  const terminalStates = new Set(context.terminalStates ?? stateNames.filter((stateName) => (stateMap.get(stateName)?.onEvent ? Object.keys(stateMap.get(stateName)?.onEvent ?? {}).length === 0 : true)));
  const presetRetainedStates = new Set(context.presetRetainedStates ?? []);
  const reachableStates = buildReachableStates(spec);
  const discoveredStates = context.analysis?.discoveredStates ?? new Set<string>();

  const startState = spec.startState?.trim() ?? '';
  if (!startState || !stateSet.has(startState)) {
    issues.push({
      code: 'START_STATE_MISSING',
      severity: 'ERROR',
      message: 'Workflow start state is missing or does not exist in the generated state set.',
      details: startState ? [startState] : undefined
    });
  }

  spec.states.forEach((state) => {
    const stateName = state.name.trim();
    const eventNames = Object.keys(state.onEvent ?? {});
    const normalizedEventNames = new Map<string, string[]>();
    const sortedEventNames = [...eventNames].sort(compareStrings);

    if (eventNames.some((eventName, index) => eventName !== sortedEventNames[index])) {
      issues.push({
        code: 'EVENT_ORDER_NOT_SORTED',
        severity: 'WARN',
        message: `State "${stateName}" has non-deterministic event ordering.`,
        details: eventNames
      });
    }

    eventNames.forEach((eventName) => {
      const normalizedEvent = normalizeKey(eventName);
      const bucket = normalizedEventNames.get(normalizedEvent) ?? [];
      bucket.push(eventName);
      normalizedEventNames.set(normalizedEvent, bucket);
    });

    [...normalizedEventNames.entries()]
      .filter(([, entries]) => entries.length > 1)
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([, entries]) => {
        issues.push({
          code: 'DUPLICATE_EVENT_NAME',
          severity: 'ERROR',
          message: `State "${stateName}" contains duplicate event names after case normalization.`,
          details: [...entries].sort(compareStrings)
        });
      });

    eventNames
      .sort(compareStrings)
      .forEach((eventName) => {
        const target = state.onEvent[eventName]?.target?.trim() ?? '';
        if (!target || stateSet.has(target)) {
          return;
        }

        issues.push({
          code: 'MISSING_TARGET_STATE',
          severity: 'ERROR',
          message: `Transition "${stateName}.${eventName}" targets a missing state.`,
          details: [target]
        });
      });

    if (terminalStates.has(stateName) && eventNames.length > 0) {
      issues.push({
        code: 'TERMINAL_HAS_OUTGOING',
        severity: 'ERROR',
        message: `Terminal state "${stateName}" should not have outgoing transitions.`,
        details: eventNames.sort(compareStrings)
      });
    }

    if (!terminalStates.has(stateName) && eventNames.length === 0) {
      issues.push({
        code: 'DEAD_END_NON_TERMINAL',
        severity: presetRetainedStates.has(stateName) ? 'WARN' : 'ERROR',
        message: `Non-terminal state "${stateName}" has no outgoing transitions.`,
        details: presetRetainedStates.has(stateName) ? ['preset-retained-state'] : undefined
      });
    }
  });

  stateNames
    .slice()
    .sort(compareStrings)
    .forEach((stateName) => {
      if (reachableStates.has(stateName)) {
        return;
      }

      const state = stateMap.get(stateName);
      const eventCount = Object.keys(state?.onEvent ?? {}).length;
      if (terminalStates.has(stateName) && eventCount === 0) {
        if (!presetRetainedStates.has(stateName)) {
          issues.push({
            code: 'UNREACHABLE_TERMINAL_STATE',
            severity: 'WARN',
            message: `Terminal state "${stateName}" is unreachable from the workflow start state.`
          });
        }
        return;
      }

      issues.push({
        code: 'UNREACHABLE_STATE',
        severity: presetRetainedStates.has(stateName) ? 'WARN' : 'ERROR',
        message: `State "${stateName}" is unreachable from the workflow start state.`,
        details: presetRetainedStates.has(stateName) ? ['preset-retained-state'] : undefined
      });
    });

  if (context.analysis?.lifecycleFlags.hasSanctions) {
    ['SanctionsSent', 'OfacPossibleHit', 'SanctionsRespRepair']
      .filter((stateName) => discoveredStates.has(stateName))
      .sort(compareStrings)
      .forEach((stateName) => {
        if (!stateSet.has(stateName) || hasMeaningfulExit(spec, stateName)) {
          return;
        }

        issues.push({
          code: 'SANCTIONS_EXIT_MISSING',
          severity: 'ERROR',
          message: `Sanctions state "${stateName}" does not have a meaningful exit path.`
        });
      });
  }

  if (context.analysis?.lifecycleFlags.hasBalanceCheck && discoveredStates.has('BalanceCheckPending')) {
    if (!stateSet.has('BalanceCheckPending') || !hasMeaningfulExit(spec, 'BalanceCheckPending')) {
      issues.push({
        code: 'BALANCE_EXIT_MISSING',
        severity: 'ERROR',
        message: 'BalanceCheckPending does not have a meaningful exit path.'
      });
    }
  }

  if (context.analysis?.lifecycleFlags.hasWarehousing && discoveredStates.has('Warehoused')) {
    const warehousedState = stateMap.get('Warehoused');
    const warehousedEvents = Object.keys(warehousedState?.onEvent ?? {});
    const normalizedEvents = new Set(warehousedEvents.map((eventName) => normalizeKey(eventName)));

    if (!warehousedState) {
      issues.push({
        code: 'WAREHOUSED_STATE_MISSING',
        severity: 'ERROR',
        message: 'Warehousing lifecycle was detected but the Warehoused state is missing from the generated workflow.'
      });
    } else {
      if (!normalizedEvents.has('ONRELEASE')) {
        issues.push({
          code: 'WAREHOUSED_RELEASE_MISSING',
          severity: 'ERROR',
          message: 'Warehoused state is missing the OnRelease transition.'
        });
      }

      if (!normalizedEvents.has('ONCANCEL')) {
        issues.push({
          code: 'WAREHOUSED_CANCEL_MISSING',
          severity: 'ERROR',
          message: 'Warehoused state is missing the OnCancel transition.'
        });
      }
    }
  }

  const orderedIssues = issues.sort(compareIssue);
  return {
    issues: orderedIssues,
    hasErrors: orderedIssues.some((issue) => issue.severity === 'ERROR')
  };
}

