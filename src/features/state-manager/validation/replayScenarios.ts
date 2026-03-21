import type { WorkflowSpec } from '../../../models/snapshot';
import type { ScenarioCategory } from '../types';
import { resolveStateName, shouldSkipSubFlow, type StateResolutionOptions } from '../analysis/normalize';
import type { ScenarioReplayReport, ScenarioReplayResult } from './types';

export type ScenarioReplayOptions = StateResolutionOptions & {
  maxDepth?: number;
};

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function buildExpectedStates(
  rows: readonly { msgStatus: string; msgSubStatus: string }[],
  options?: StateResolutionOptions
): ScenarioReplayResult['expectedStates'] {
  const expectedStates: string[] = [];
  rows.forEach((row) => {
    const stateName = resolveStateName(row.msgStatus, row.msgSubStatus, options);
    if (!stateName || expectedStates[expectedStates.length - 1] === stateName) {
      return;
    }
    expectedStates.push(stateName);
  });

  return expectedStates;
}

function buildAdjacency(spec: WorkflowSpec): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  spec.states.forEach((state) => {
    const nextStates = new Set<string>();
    Object.values(state.onEvent ?? {}).forEach((transition) => {
      const target = transition?.target?.trim() ?? '';
      if (!target) {
        return;
      }
      nextStates.add(target);
    });
    const stateName = state.name.trim();
    if (!stateName) {
      return;
    }
    adjacency.set(stateName, nextStates);
  });

  return adjacency;
}

function canReachWithinDepth(
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  source: string,
  target: string,
  maxDepth: number
): boolean {
  if (source === target) {
    return true;
  }

  const queue: Array<{ state: string; depth: number }> = [{ state: source, depth: 0 }];
  const visited = new Set<string>([source]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    const neighbors = [...(adjacency.get(current.state) ?? new Set<string>())].sort(compareStrings);
    for (const neighbor of neighbors) {
      if (neighbor === target) {
        return true;
      }
      if (visited.has(neighbor)) {
        continue;
      }
      visited.add(neighbor);
      queue.push({ state: neighbor, depth: current.depth + 1 });
    }
  }

  return false;
}

export function replayScenariosAgainstWorkflow(
  scenarios: readonly ScenarioCategory[],
  spec: WorkflowSpec,
  options?: ScenarioReplayOptions
): ScenarioReplayReport {
  const results: ScenarioReplayResult[] = [];
  const maxDepth = options?.maxDepth ?? 4;
  const stateSet = new Set(spec.states.map((state) => state.name.trim()).filter(Boolean));
  const adjacency = buildAdjacency(spec);

  scenarios.forEach((scenario) => {
    scenario.subFlows.forEach((subFlow) => {
      if (shouldSkipSubFlow(subFlow.title)) {
        return;
      }

      const expectedStates = buildExpectedStates(subFlow.rows, options);
      const unexpectedStates = expectedStates.filter((stateName) => !stateSet.has(stateName));
      const missingTransitions: string[] = [];

      for (let index = 0; index < expectedStates.length - 1; index += 1) {
        const source = expectedStates[index];
        const target = expectedStates[index + 1];
        if (!stateSet.has(source) || !stateSet.has(target)) {
          missingTransitions.push(`${source}->${target}`);
          continue;
        }

        if (!canReachWithinDepth(adjacency, source, target, maxDepth)) {
          missingTransitions.push(`${source}->${target}`);
        }
      }

      results.push({
        scenarioName: scenario.name,
        subFlowTitle: subFlow.title,
        expectedStates,
        matched: missingTransitions.length === 0 && unexpectedStates.length === 0,
        missingTransitions,
        unexpectedStates: [...new Set(unexpectedStates)].sort(compareStrings)
      });
    });
  });

  const passedCount = results.filter((result) => result.matched).length;
  return {
    results,
    failedCount: results.length - passedCount,
    passedCount
  };
}
