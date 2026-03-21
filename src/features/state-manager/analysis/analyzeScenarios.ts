import type { ScenarioCategory } from '../types';
import { classifyNormalizedRow, withSemanticTag } from './classify';
import { detectConflicts } from './conflicts';
import { detectArchetypes } from './archetypes';
import {
  inferBalanceTarget,
  inferLifecycleFlags,
  inferNextAfterInit,
  inferPostSanctionsTarget,
  inferWarehousedReleaseTarget,
  type SequenceEvidence
} from './inference';
import {
  DEFAULT_PRE_FSM_REJECTIONS,
  normalizeDirection,
  normalizeToken,
  resolveStateName,
  shouldSkipSubFlow,
  type DirectionInput,
  type StateResolutionOptions
} from './normalize';
import type { AnalysisConflict, AnalysisEvidence, AnalysisModel, NormalizedRow } from './types';

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeStringList(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function dedupeEvidence(evidence: readonly AnalysisEvidence[]): AnalysisEvidence[] {
  const map = new Map<string, AnalysisEvidence>();
  evidence.forEach((entry) => {
    const normalizedEntry: AnalysisEvidence = {
      ...entry,
      sources: normalizeStringList(entry.sources)
    };
    const key = `${normalizedEntry.decision}::${normalizedEntry.chosenValue}::${normalizedEntry.reason}::${normalizedEntry.sources.join('|')}::${normalizedEntry.confidence}`;
    if (!map.has(key)) {
      map.set(key, normalizedEntry);
    }
  });

  return [...map.values()].sort((left, right) => {
    const decisionCompare = left.decision.localeCompare(right.decision);
    if (decisionCompare !== 0) {
      return decisionCompare;
    }
    const valueCompare = left.chosenValue.localeCompare(right.chosenValue);
    if (valueCompare !== 0) {
      return valueCompare;
    }
    const reasonCompare = left.reason.localeCompare(right.reason);
    if (reasonCompare !== 0) {
      return reasonCompare;
    }
    const confidenceCompare = left.confidence.localeCompare(right.confidence);
    if (confidenceCompare !== 0) {
      return confidenceCompare;
    }
    return left.sources.join('|').localeCompare(right.sources.join('|'));
  });
}

function mergeConflicts(items: readonly AnalysisConflict[]): AnalysisConflict[] {
  const map = new Map<string, AnalysisConflict>();
  items.forEach((item) => {
    const normalizedItem: AnalysisConflict = {
      ...item,
      ...(item.details?.length ? { details: normalizeStringList(item.details) } : {})
    };
    const key = `${normalizedItem.severity}::${normalizedItem.code}::${normalizedItem.message}::${(normalizedItem.details ?? []).join('|')}`;
    if (!map.has(key)) {
      map.set(key, normalizedItem);
    }
  });

  return [...map.values()].sort((left, right) => {
    const severityCompare = left.severity.localeCompare(right.severity);
    if (severityCompare !== 0) {
      return severityCompare;
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
  });
}

export function extractFlowSequences(
  scenarios: readonly ScenarioCategory[],
  options?: StateResolutionOptions
): string[][] {
  const sequences: string[][] = [];

  scenarios.forEach((scenario) => {
    scenario.subFlows.forEach((subFlow) => {
      if (shouldSkipSubFlow(subFlow.title)) {
        return;
      }

      const sequence: string[] = [];
      subFlow.rows.forEach((row) => {
        const stateName = resolveStateName(row.msgStatus, row.msgSubStatus, options);
        if (!stateName || sequence[sequence.length - 1] === stateName) {
          return;
        }
        sequence.push(stateName);
      });

      if (sequence.length > 0) {
        sequences.push(sequence);
      }
    });
  });

  return sequences;
}

export function discoverStates(
  scenarios: readonly ScenarioCategory[],
  options?: StateResolutionOptions
): Set<string> {
  return new Set(extractFlowSequences(scenarios, options).flat());
}

export function deriveRawTransitions(sequences: readonly string[][]): Map<string, Set<string>> {
  const transitions = new Map<string, Set<string>>();

  sequences.forEach((sequence) => {
    for (let index = 0; index < sequence.length - 1; index += 1) {
      const source = sequence[index];
      const target = sequence[index + 1];
      if (!source || !target || source === target) {
        continue;
      }

      const existing = transitions.get(source) ?? new Set<string>();
      existing.add(target);
      transitions.set(source, existing);
    }
  });

  return transitions;
}

function isReachable(
  start: string,
  target: string,
  transitions: ReadonlyMap<string, ReadonlySet<string>>,
  excludeSource: string
): boolean {
  if (start === target) {
    return true;
  }

  const visited = new Set<string>([excludeSource, start]);
  const queue: string[] = [start];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const nextStates = transitions.get(current);
    if (!nextStates) {
      continue;
    }

    [...nextStates]
      .sort((left, right) => left.localeCompare(right))
      .forEach((nextState) => {
        if (nextState === excludeSource || visited.has(nextState)) {
          return;
        }
        if (nextState === target) {
          visited.add(nextState);
          queue.unshift(target);
          return;
        }
        visited.add(nextState);
        queue.push(nextState);
      });

    if (visited.has(target)) {
      return true;
    }
  }

  return false;
}

export function pruneSubsumedTransitions(transitions: Map<string, Set<string>>): Map<string, Set<string>> {
  const pruned = new Map<string, Set<string>>();

  [...transitions.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([source, targets]) => {
      const sortedTargets = [...targets].sort((left, right) => left.localeCompare(right));
      const removedTargets = new Set<string>();

      for (let leftIndex = 0; leftIndex < sortedTargets.length; leftIndex += 1) {
        const leftTarget = sortedTargets[leftIndex];
        if (removedTargets.has(leftTarget)) {
          continue;
        }

        for (let rightIndex = leftIndex + 1; rightIndex < sortedTargets.length; rightIndex += 1) {
          const rightTarget = sortedTargets[rightIndex];
          if (removedTargets.has(rightTarget)) {
            continue;
          }

          const leftReachesRight = isReachable(leftTarget, rightTarget, transitions, source);
          const rightReachesLeft = isReachable(rightTarget, leftTarget, transitions, source);

          if (leftReachesRight && !rightReachesLeft) {
            removedTargets.add(rightTarget);
            continue;
          }

          if (rightReachesLeft && !leftReachesRight) {
            removedTargets.add(leftTarget);
            break;
          }

          if (leftReachesRight && rightReachesLeft) {
            removedTargets.add(rightTarget);
          }
        }
      }

      pruned.set(source, new Set(sortedTargets.filter((target) => !removedTargets.has(target))));
    });

  return pruned;
}

function buildNormalizedRows(
  scenarios: readonly ScenarioCategory[],
  direction: 'incoming' | 'outgoing',
  options?: StateResolutionOptions
): { normalizedRows: NormalizedRow[]; sequenceEvidence: SequenceEvidence[] } {
  const normalizedRows: NormalizedRow[] = [];
  const sequenceEvidence: SequenceEvidence[] = [];
  const preFsmRejections = new Set((options?.preFsmRejections ?? DEFAULT_PRE_FSM_REJECTIONS).map((entry) => normalizeToken(entry)));

  scenarios.forEach((scenario) => {
    scenario.subFlows.forEach((subFlow) => {
      if (shouldSkipSubFlow(subFlow.title)) {
        return;
      }

      const sequence: string[] = [];
      let lastResolvedState: string | null = null;

      subFlow.rows.forEach((row) => {
        const resolvedState = resolveStateName(row.msgStatus, row.msgSubStatus, options);
        const normalizedRowBase: NormalizedRow = {
          sourceScenarioId: scenario.id,
          sourceScenarioName: scenario.name,
          sourceSubFlowId: subFlow.id,
          sourceSubFlowTitle: subFlow.title,
          rowId: row.id,
          msgStatus: normalizeToken(row.msgStatus),
          msgSubStatus: normalizeToken(row.msgSubStatus),
          transactionStatus: normalizeToken(row.transactionStatus),
          transactionStatusReason: normalizeToken(row.transactionStatusReason),
          scenario: normalizeOptionalText(row.scenario),
          responsibleComponent: normalizeOptionalText(row.responsibleComponent),
          triggerReversal: row.triggerReversal,
          resolvedState,
          semanticTags: []
        };

        const isPreFsmRejection = normalizedRowBase.msgStatus === 'REJECTED' && preFsmRejections.has(normalizedRowBase.msgSubStatus);
        let normalizedRow: NormalizedRow = {
          ...normalizedRowBase,
          semanticTags: classifyNormalizedRow(normalizedRowBase, {
            direction,
            isPreFsmRejection
          })
        };

        if (lastResolvedState === 'Warehoused' && resolvedState && resolvedState !== 'Warehoused') {
          normalizedRow = withSemanticTag(normalizedRow, 'WAREHOUSE_RELEASE');
        }

        normalizedRows.push(normalizedRow);

        if (!resolvedState) {
          return;
        }

        if (sequence[sequence.length - 1] !== resolvedState) {
          sequence.push(resolvedState);
        }
        lastResolvedState = resolvedState;
      });

      if (sequence.length > 0) {
        sequenceEvidence.push({
          sourceScenarioId: scenario.id,
          sourceSubFlowId: subFlow.id,
          sourceSubFlowTitle: subFlow.title,
          sequence
        });
      }
    });
  });

  return { normalizedRows, sequenceEvidence };
}

export function analyzeScenarios(
  scenarios: readonly ScenarioCategory[],
  countryCode?: string,
  direction?: DirectionInput,
  options?: StateResolutionOptions
): AnalysisModel {
  void countryCode;

  const normalizedDirection = normalizeDirection(direction);
  const { normalizedRows, sequenceEvidence } = buildNormalizedRows(scenarios, normalizedDirection, options);
  const rawSequences = sequenceEvidence.map((entry) => [...entry.sequence]);
  const discoveredStates = new Set(rawSequences.flat());
  const prunedTransitions = pruneSubsumedTransitions(deriveRawTransitions(rawSequences));
  const lifecycleFlags = inferLifecycleFlags(discoveredStates, normalizedRows);

  const nextAfterInit = inferNextAfterInit({ discoveredStates, lifecycleFlags });
  const postSanctionsTarget = inferPostSanctionsTarget({ discoveredStates, lifecycleFlags, sequenceEvidence });
  const balanceTarget = inferBalanceTarget({ discoveredStates, lifecycleFlags, sequenceEvidence });
  const warehousedReleaseTarget = lifecycleFlags.hasWarehousing
    ? inferWarehousedReleaseTarget({ sequenceEvidence })
    : { value: undefined, evidence: [], conflicts: [], warnings: [] };

  const inferredTargets: AnalysisModel['inferredTargets'] = {
    ...(nextAfterInit.value ? { nextAfterInit: nextAfterInit.value } : {}),
    ...(postSanctionsTarget.value ? { postSanctionsTarget: postSanctionsTarget.value } : {}),
    ...(balanceTarget.value ? { balanceTarget: balanceTarget.value } : {}),
    ...(warehousedReleaseTarget.value ? { warehousedReleaseTarget: warehousedReleaseTarget.value } : {})
  };

  const additionalTerminals = new Set<string>();
  if (lifecycleFlags.hasBalanceCheck) {
    additionalTerminals.add('TxnRejectedOnNSF');
    additionalTerminals.add('TxnRejectedOnGLSTechError');
  }
  if (lifecycleFlags.hasWarehousing) {
    additionalTerminals.add('WarehousedCancelled');
  }

  const evidence = dedupeEvidence([
    ...nextAfterInit.evidence,
    ...postSanctionsTarget.evidence,
    ...balanceTarget.evidence,
    ...warehousedReleaseTarget.evidence
  ]);

  const archetypeMatches = detectArchetypes({
    normalizedRows,
    discoveredStates,
    rawSequences,
    lifecycleFlags,
    inferredTargets,
    direction: normalizedDirection
  });

  const conflictResult = detectConflicts({
    normalizedRows,
    rawSequences,
    discoveredStates,
    lifecycleFlags,
    inferredTargets,
    archetypeMatches,
    direction: normalizedDirection,
    seedConflicts: [...nextAfterInit.conflicts, ...postSanctionsTarget.conflicts, ...balanceTarget.conflicts, ...warehousedReleaseTarget.conflicts],
    seedWarnings: [...nextAfterInit.warnings, ...postSanctionsTarget.warnings, ...balanceTarget.warnings, ...warehousedReleaseTarget.warnings]
  });

  return {
    normalizedRows,
    discoveredStates,
    rawSequences,
    prunedTransitions,
    lifecycleFlags,
    inferredTargets,
    additionalTerminals,
    conflicts: mergeConflicts(conflictResult.conflicts),
    warnings: mergeConflicts(conflictResult.warnings),
    evidence,
    archetypeMatches
  };
}

