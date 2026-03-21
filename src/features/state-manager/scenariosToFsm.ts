import type { StateSpec, TransitionSpec, WorkflowSpec } from '../../models/snapshot';
import type { FlowDirection, ScenarioCategory } from './types';

type TransitionKnowledge = {
  eventName: string;
  actions: string[];
};

const DEFAULT_STATES_CLASS = 'com.citi.cpx.statemanager.fsm.State';
const DEFAULT_EVENTS_CLASS = 'com.citi.cpx.statemanager.fsm.Event';

const PRE_FSM_NULL_STATES = new Set([
  'REJECTED::ACCOUNT_INVALID',
  'REJECTED::ACCOUNT_CLOSED',
  'REJECTED::INVALID_ACCOUNT_CLASS',
  'REJECTED::TAX_INFO_MISSING',
  'REJECTED::INVALID_TAX_ID',
  'REJECTED::ALIAS_NOT_RESOLVED',
  'REJECTED::CREDITOR_MEMBERSHIP_INVALID'
]);

const NULL_STATE_TOKENS = new Set([
  'NON_PAY_COMPLETE',
  'NON_PAY_REJECTED',
  'NON_PAY_RECEIVED_FOR_PROCESSING',
  'WAREHOUSED'
]);

const POSTING_STATE_MAP = new Map<string, string>([
  ['SENT_TO_CLEARING::POSTING_PENDING', 'SendClearingPostingPending'],
  ['COMPLETE::POSTING_PENDING', 'NormalPostingPending'],
  ['SENT_TO_CLEARING::POSTING_COMPLETE', 'SendClearingPostingComplete'],
  ['COMPLETE::POSTING_COMPLETE', 'FinalPostingComplete'],
  ['SENT_TO_CLEARING::POSTING_PENDING_CLEARING_INFORMED', 'SendClearingPostingPending'],
  ['COMPLETE::POSTING_PENDING_CLEARING_INFORMED', 'NormalPostingPending'],
  ['SENT_TO_CLEARING::POSTING_COMPLETE_CLEARING_INFORMED', 'SendClearingPostingComplete'],
  ['COMPLETE::POSTING_COMPLETE_CLEARING_INFORMED', 'FinalPostingComplete'],
  ['REJECTED::CLEARING_REJECT_POSTING_COMPLETE', 'ClearingRejectPostingComplete']
]);

const DIRECT_STATE_MAP = new Map<string, string>([
  ['VALIDATED', 'Init'],
  ['RECEIVED_FOR_PROCESSING', 'Init'],
  ['SPM_SENT', 'SpmSent'],
  ['SPM_FAILED', 'SpmFailed'],
  ['SPM_ERROR', 'SpmError'],
  ['SANCTIONS_SENT', 'SanctionsSent'],
  ['BALANCE_CHECK_PENDING', 'BalanceCheckPending'],
  ['OFAC_POSSIBLE_HIT', 'OfacPossibleHit'],
  ['CLEARING_REJECT_POSTING_PENDING', 'ClrRejectedOrgPostingPending'],
  ['CLEARING_REJECT_POSTING_COMPLETE', 'ClearingRejectPostingComplete'],
  ['DUPLICATE', 'DuplicatePayment'],
  ['SANCTION_REJECTED', 'SanctionsReject'],
  ['SANCTION_CANCELLED', 'SanctionsCancelled'],
  ['SANCTIONS_SEIZED', 'SanctionsSeized'],
  ['STOP_RECALL_REQUEST', 'SanctionsCancelled']
]);

function normalizeToken(value: string | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}

function toPascalCase(value: string): string {
  return value
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function toKebabCase(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function normalizeActions(actions: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  actions.forEach((action) => {
    const next = action.trim();
    if (!next || seen.has(next)) {
      return;
    }
    seen.add(next);
    normalized.push(next);
  });
  return normalized;
}

function resolveStateName(msgStatus: string, msgSubStatus: string): string | null {
  const status = normalizeToken(msgStatus);
  const subStatus = normalizeToken(msgSubStatus);

  if (!status && !subStatus) {
    return null;
  }

  const stateKey = `${status}::${subStatus}`;
  if (PRE_FSM_NULL_STATES.has(stateKey)) {
    return null;
  }

  if (NULL_STATE_TOKENS.has(status) || NULL_STATE_TOKENS.has(subStatus)) {
    return null;
  }

  const postingState = POSTING_STATE_MAP.get(stateKey);
  if (postingState) {
    return postingState;
  }

  const directState = DIRECT_STATE_MAP.get(subStatus) ?? DIRECT_STATE_MAP.get(status);
  if (directState) {
    return directState;
  }

  const fallbackValue = subStatus || status;
  return fallbackValue ? toPascalCase(fallbackValue) : null;
}

function collectFlowSequences(scenarios: readonly ScenarioCategory[]): string[][] {
  const sequences: string[][] = [];

  scenarios.forEach((scenario) => {
    scenario.subFlows.forEach((subFlow) => {
      const sequence: string[] = [];
      subFlow.rows.forEach((row) => {
        const nextState = resolveStateName(row.msgStatus, row.msgSubStatus);
        if (!nextState) {
          return;
        }
        if (sequence[sequence.length - 1] === nextState) {
          return;
        }
        sequence.push(nextState);
      });
      if (sequence.length) {
        sequences.push(sequence);
      }
    });
  });

  return sequences;
}

function buildAdjacency(sequences: readonly string[][]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  sequences.forEach((sequence) => {
    sequence.forEach((stateName) => {
      if (!adjacency.has(stateName)) {
        adjacency.set(stateName, new Set());
      }
    });

    for (let index = 0; index < sequence.length - 1; index += 1) {
      const source = sequence[index];
      const target = sequence[index + 1];
      if (!source || !target || source === target) {
        continue;
      }
      adjacency.get(source)?.add(target);
    }
  });

  return adjacency;
}

function isReachable(
  source: string,
  target: string,
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  excludedSource: string
): boolean {
  if (source === target) {
    return true;
  }

  const visited = new Set<string>([excludedSource, source]);
  const queue: string[] = [source];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const nextTargets = adjacency.get(current);
    if (!nextTargets) {
      continue;
    }

    const sortedTargets = [...nextTargets].sort((left, right) => left.localeCompare(right));
    for (const nextTarget of sortedTargets) {
      if (nextTarget === excludedSource) {
        continue;
      }
      if (nextTarget === target) {
        return true;
      }
      if (!visited.has(nextTarget)) {
        visited.add(nextTarget);
        queue.push(nextTarget);
      }
    }
  }

  return false;
}

function pruneShortcutTransitions(
  adjacency: ReadonlyMap<string, ReadonlySet<string>>
): Map<string, Set<string>> {
  const pruned = new Map<string, Set<string>>();

  [...adjacency.entries()]
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

          const leftReachesRight = isReachable(leftTarget, rightTarget, adjacency, source);
          const rightReachesLeft = isReachable(rightTarget, leftTarget, adjacency, source);

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

      pruned.set(
        source,
        new Set(sortedTargets.filter((target) => !removedTargets.has(target)))
      );
    });

  return pruned;
}

function detectTerminalStates(
  sequences: readonly string[][],
  adjacency: ReadonlyMap<string, ReadonlySet<string>>
): Set<string> {
  const candidateTerminalStates = new Set<string>();
  sequences.forEach((sequence) => {
    const lastState = sequence[sequence.length - 1];
    if (lastState) {
      candidateTerminalStates.add(lastState);
    }
  });

  return new Set(
    [...candidateTerminalStates].filter((stateName) => (adjacency.get(stateName)?.size ?? 0) === 0)
  );
}

function createStateMap(seed?: WorkflowSpec | null): Map<string, StateSpec> {
  const stateMap = new Map<string, StateSpec>();

  seed?.states.forEach((state) => {
    stateMap.set(state.name, {
      name: state.name,
      onEvent: Object.fromEntries(
        Object.entries(state.onEvent ?? {}).map(([eventName, transition]) => [
          eventName,
          {
            target: transition.target,
            actions: [...(transition.actions ?? [])]
          } satisfies TransitionSpec
        ])
      )
    });
  });

  return stateMap;
}

function ensureState(stateMap: Map<string, StateSpec>, stateName: string): void {
  const trimmedStateName = stateName.trim();
  if (!trimmedStateName || stateMap.has(trimmedStateName)) {
    return;
  }

  stateMap.set(trimmedStateName, {
    name: trimmedStateName,
    onEvent: {}
  });
}

function buildTransitionKnowledgeKey(source: string, target: string): string {
  return `${source.trim()}::${target.trim()}`;
}

function compareKnowledge(left: TransitionKnowledge, right: TransitionKnowledge): number {
  const eventCompare = left.eventName.localeCompare(right.eventName);
  if (eventCompare !== 0) {
    return eventCompare;
  }

  return left.actions.join('|').localeCompare(right.actions.join('|'));
}
export function buildKnowledgeBase(presets: readonly WorkflowSpec[]): Map<string, TransitionKnowledge> {
  const knowledgeBase = new Map<string, TransitionKnowledge>();

  [...presets]
    .filter((preset): preset is WorkflowSpec => Boolean(preset?.states?.length))
    .sort((left, right) => {
      const workflowCompare = (left.workflowKey ?? '').localeCompare(right.workflowKey ?? '');
      if (workflowCompare !== 0) {
        return workflowCompare;
      }
      return left.states.length - right.states.length;
    })
    .forEach((preset) => {
      [...preset.states]
        .sort((left, right) => left.name.localeCompare(right.name))
        .forEach((state) => {
          Object.entries(state.onEvent ?? {})
            .sort(([left], [right]) => left.localeCompare(right))
            .forEach(([eventName, transition]) => {
              const source = state.name.trim();
              const target = transition.target.trim();
              if (!source || !target || !eventName.trim()) {
                return;
              }

              const candidate: TransitionKnowledge = {
                eventName: eventName.trim(),
                actions: normalizeActions(transition.actions ?? [])
              };
              const key = buildTransitionKnowledgeKey(source, target);
              const existing = knowledgeBase.get(key);
              if (!existing || compareKnowledge(candidate, existing) < 0) {
                knowledgeBase.set(key, candidate);
              }
            });
        });
    });

  return knowledgeBase;
}

function buildProxyNotificationAction(countryCode: string, direction: FlowDirection): string {
  return `notify-proxy-svc-${countryCode.trim().toLowerCase()}-${direction.toLowerCase()}`;
}

function buildFinalAckAction(direction: FlowDirection): string {
  return `notify-client-final-ack-${direction.toLowerCase()}`;
}

function buildFinalNackAction(direction: FlowDirection): string {
  return `notify-client-final-nack-${direction.toLowerCase()}`;
}

function buildFinalCancelAction(direction: FlowDirection): string {
  return `notify-client-final-cancel-${direction.toLowerCase()}`;
}

function resolveTerminalNotificationAction(target: string, direction: FlowDirection): string {
  if (/(Reject|Rejected|Duplicate|Seized|Cancelled|TxnRejected)/.test(target)) {
    return buildFinalNackAction(direction);
  }
  if (/Complete/.test(target)) {
    return buildFinalAckAction(direction);
  }
  return `notify-client-final-${direction.toLowerCase()}`;
}

function resolveEventName(
  source: string,
  target: string,
  terminalStates: ReadonlySet<string>,
  knowledgeBase: ReadonlyMap<string, TransitionKnowledge>
): string {
  const knowledge = knowledgeBase.get(buildTransitionKnowledgeKey(source, target));
  if (knowledge?.eventName.trim()) {
    return knowledge.eventName;
  }

  if (terminalStates.has(target)) {
    return `Reached${target}`;
  }

  return `Process${target}`;
}

function resolveActions(
  source: string,
  target: string,
  terminalStates: ReadonlySet<string>,
  countryCode: string,
  direction: FlowDirection,
  knowledgeBase: ReadonlyMap<string, TransitionKnowledge>
): string[] {
  const knowledge = knowledgeBase.get(buildTransitionKnowledgeKey(source, target));
  if (knowledge) {
    return [...knowledge.actions];
  }

  const targetToken = toKebabCase(target);
  if (terminalStates.has(target)) {
    return [
      'persist-txn',
      `mark-${targetToken}`,
      resolveTerminalNotificationAction(target, direction)
    ];
  }

  return ['persist-txn', `process-${targetToken}`, buildProxyNotificationAction(countryCode, direction)];
}

function buildUniqueEventName(
  onEvent: Record<string, TransitionSpec>,
  eventName: string,
  target: string
): string {
  const trimmedEventName = eventName.trim();
  const existing = onEvent[trimmedEventName];
  if (!existing || existing.target === target) {
    return trimmedEventName;
  }

  const suffix = `To${target}`;
  let nextEventName = `${trimmedEventName}${suffix}`;
  let counter = 2;
  while (onEvent[nextEventName] && onEvent[nextEventName].target !== target) {
    nextEventName = `${trimmedEventName}${suffix}${counter}`;
    counter += 1;
  }
  return nextEventName;
}

function addTx(
  stateMap: Map<string, StateSpec>,
  newTransitions: Set<string>,
  source: string,
  eventName: string,
  target: string,
  actions: readonly string[]
): void {
  const trimmedSource = source.trim();
  const trimmedTarget = target.trim();
  const trimmedEventName = eventName.trim();
  if (!trimmedSource || !trimmedTarget || !trimmedEventName) {
    return;
  }

  ensureState(stateMap, trimmedSource);
  ensureState(stateMap, trimmedTarget);

  const sourceState = stateMap.get(trimmedSource);
  if (!sourceState) {
    return;
  }

  const finalEventName = buildUniqueEventName(sourceState.onEvent, trimmedEventName, trimmedTarget);
  if (sourceState.onEvent[finalEventName]) {
    return;
  }

  sourceState.onEvent[finalEventName] = {
    target: trimmedTarget,
    actions: normalizeActions(actions)
  };
  newTransitions.add(`${trimmedSource}::${finalEventName}`);
}

function countRows(scenarios: readonly ScenarioCategory[]): number {
  return scenarios.reduce(
    (scenarioTotal, scenario) =>
      scenarioTotal +
      scenario.subFlows.reduce((subFlowTotal, subFlow) => subFlowTotal + subFlow.rows.length, 0),
    0
  );
}

function chooseBestStartState(stateMap: ReadonlyMap<string, StateSpec>, preferredStart?: string): string {
  const preferred = preferredStart?.trim();
  if (preferred && stateMap.has(preferred)) {
    return preferred;
  }

  if (stateMap.has('Init')) {
    return 'Init';
  }

  const inboundCounts = new Map<string, number>();
  const outboundCounts = new Map<string, number>();

  [...stateMap.keys()].forEach((stateName) => {
    inboundCounts.set(stateName, 0);
    outboundCounts.set(stateName, 0);
  });

  stateMap.forEach((state) => {
    outboundCounts.set(state.name, Object.keys(state.onEvent ?? {}).length);
    Object.values(state.onEvent ?? {}).forEach((transition) => {
      inboundCounts.set(transition.target, (inboundCounts.get(transition.target) ?? 0) + 1);
    });
  });

  const entryCandidates = [...stateMap.keys()]
    .filter((stateName) => (inboundCounts.get(stateName) ?? 0) === 0)
    .sort((left, right) => {
      const outboundCompare = (outboundCounts.get(right) ?? 0) - (outboundCounts.get(left) ?? 0);
      if (outboundCompare !== 0) {
        return outboundCompare;
      }
      return left.localeCompare(right);
    });

  return entryCandidates[0] ?? [...stateMap.keys()].sort((left, right) => left.localeCompare(right))[0] ?? 'Init';
}

export function previewConversion(scenarios: readonly ScenarioCategory[]): {
  scenarioCount: number;
  totalRows: number;
  discoveredStateCount: number;
} {
  const discoveredStates = new Set<string>();

  scenarios.forEach((scenario) => {
    scenario.subFlows.forEach((subFlow) => {
      subFlow.rows.forEach((row) => {
        const stateName = resolveStateName(row.msgStatus, row.msgSubStatus);
        if (stateName) {
          discoveredStates.add(stateName);
        }
      });
    });
  });

  return {
    scenarioCount: scenarios.length,
    totalRows: countRows(scenarios),
    discoveredStateCount: discoveredStates.size
  };
}
export function scenariosToWorkflowSpec(
  scenarios: readonly ScenarioCategory[],
  presetSpec: WorkflowSpec | null | undefined,
  allPresets: readonly WorkflowSpec[] = [],
  workflowKey?: string,
  countryCode = '',
  direction: FlowDirection = 'OUTGOING'
): { spec: WorkflowSpec; newTransitions: Set<string> } {
  const sequences = collectFlowSequences(scenarios);
  const discoveredStates = new Set<string>(sequences.flat());
  const rawAdjacency = buildAdjacency(sequences);
  const prunedAdjacency = pruneShortcutTransitions(rawAdjacency);
  const terminalStates = detectTerminalStates(sequences, prunedAdjacency);
  const knowledgeBase = buildKnowledgeBase(
    [presetSpec, ...allPresets].filter((preset): preset is WorkflowSpec => Boolean(preset))
  );

  const hasPresetBase = Boolean(presetSpec?.states.length);
  const stateMap = createStateMap(hasPresetBase ? presetSpec : null);
  const newTransitions = new Set<string>();

  if (hasPresetBase && presetSpec?.startState?.trim()) {
    ensureState(stateMap, presetSpec.startState);
  }

  discoveredStates.forEach((stateName) => ensureState(stateMap, stateName));

  const hasSpm =
    discoveredStates.has('SpmSent') || discoveredStates.has('SpmError') || discoveredStates.has('SpmFailed');
  const hasSanctions =
    discoveredStates.has('SanctionsSent') ||
    discoveredStates.has('OfacPossibleHit') ||
    discoveredStates.has('SanctionsReject') ||
    discoveredStates.has('SanctionsCancelled') ||
    discoveredStates.has('SanctionsSeized');
  const hasBalance =
    discoveredStates.has('BalanceCheckPending') ||
    discoveredStates.has('SendClearingPostingPending') ||
    discoveredStates.has('NormalPostingPending') ||
    discoveredStates.has('SendClearingPostingComplete') ||
    discoveredStates.has('FinalPostingComplete');
  const hasClearingPending = discoveredStates.has('SendClearingPostingPending');
  const hasNormalPostingPending = discoveredStates.has('NormalPostingPending');
  const hasClearingRejectPending = discoveredStates.has('ClrRejectedOrgPostingPending');

  const balanceTarget = hasBalance
    ? 'BalanceCheckPending'
    : hasClearingPending
      ? 'SendClearingPostingPending'
      : hasNormalPostingPending
        ? 'NormalPostingPending'
        : 'FinalPostingComplete';
  const postSanctionsTarget = balanceTarget;

  if (hasSpm || hasSanctions || hasBalance || discoveredStates.has('DuplicatePayment')) {
    ensureState(stateMap, 'Init');
  }
  if (hasSpm) {
    ensureState(stateMap, 'SpmCheck');
  }
  if (hasSpm && hasSanctions) {
    ensureState(stateMap, 'PreSanctionsResultCheck');
  }
  if (hasSanctions) {
    ensureState(stateMap, 'SanctionsRespRepair');
  }
  if (hasBalance) {
    ensureState(stateMap, 'TxnRejectedOnNSF');
    ensureState(stateMap, 'TxnRejectedOnGLSTechError');
    ensureState(stateMap, balanceTarget);
  }
  if (hasClearingRejectPending) {
    ensureState(stateMap, 'ClearingRejectPostingComplete');
  }

  [...prunedAdjacency.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([source, targets]) => {
      [...targets]
        .sort((left, right) => left.localeCompare(right))
        .forEach((target) => {
          addTx(
            stateMap,
            newTransitions,
            source,
            resolveEventName(source, target, terminalStates, knowledgeBase),
            target,
            resolveActions(source, target, terminalStates, countryCode, direction, knowledgeBase)
          );
        });
    });

  if (stateMap.has('Init')) {
    const nextAfterInit = hasSpm ? 'SpmCheck' : hasSanctions ? 'SanctionsSent' : 'BalanceCheckPending';
    ensureState(stateMap, nextAfterInit);
    addTx(stateMap, newTransitions, 'Init', 'DupCheckCompleted', 'Init', ['on-dup-check-completed']);
    addTx(stateMap, newTransitions, 'Init', 'DupCheckPassed', nextAfterInit, [
      'on-dup-check-passed',
      'do-spm-check',
      buildProxyNotificationAction(countryCode, direction)
    ]);
    if (stateMap.has('DuplicatePayment')) {
      addTx(stateMap, newTransitions, 'Init', 'DupCheckFailed', 'DuplicatePayment', [
        'on-dup-check-failed',
        buildFinalNackAction(direction),
        'persist-txn',
        'notify-bd-error'
      ]);
    }
  }

  if (hasSpm) {
    const disabledTarget = hasSanctions ? 'SanctionsSent' : balanceTarget;
    const preSanctionsTarget = hasSanctions ? 'PreSanctionsResultCheck' : balanceTarget;
    ensureState(stateMap, disabledTarget);
    ensureState(stateMap, preSanctionsTarget);
    addTx(stateMap, newTransitions, 'SpmCheck', 'SpmEnabled', 'SpmSent', [
      'do-pre-sanctions-enrichment',
      'persist-txn'
    ]);
    addTx(stateMap, newTransitions, 'SpmCheck', 'SpmDisabled', disabledTarget, [
      hasSanctions ? 'send-sanctions-request' : `process-${toKebabCase(disabledTarget)}`,
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    addTx(stateMap, newTransitions, 'SpmSent', 'SpmEnrichmentSuccessful', preSanctionsTarget, [
      'save-spm-result',
      'process-spm-result'
    ]);
    if (stateMap.has('SpmError')) {
      addTx(stateMap, newTransitions, 'SpmSent', 'SpmEnrichmentError', 'SpmError', [
        'save-spm-error-result',
        'persist-txn',
        'notify-bd-error'
      ]);
      addTx(stateMap, newTransitions, 'SpmError', 'OnRetry', 'SpmSent', [
        'reset-mtp',
        'do-pre-sanctions-enrichment',
        'persist-txn'
      ]);
    }
    if (stateMap.has('SpmFailed')) {
      addTx(stateMap, newTransitions, 'SpmSent', 'SpmEnrichmentFailed', 'SpmFailed', [
        'save-spm-failed-result',
        'persist-txn',
        'notify-bd-error'
      ]);
      addTx(stateMap, newTransitions, 'SpmFailed', 'OnRetry', 'SpmSent', [
        'reset-mtp',
        'do-pre-sanctions-enrichment',
        'persist-txn'
      ]);
    }
    addTx(stateMap, newTransitions, 'SpmSent', 'OnRetry', 'SpmSent', [
      'reset-mtp',
      'do-pre-sanctions-enrichment',
      'persist-txn'
    ]);
  }

  if (hasSpm && hasSanctions) {
    addTx(stateMap, newTransitions, 'PreSanctionsResultCheck', 'SkipSanctions', balanceTarget, [
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    addTx(stateMap, newTransitions, 'PreSanctionsResultCheck', 'NeedSanctions', 'SanctionsSent', [
      'send-sanctions-request',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
  }
  if (hasSanctions) {
    ensureState(stateMap, postSanctionsTarget);
    addTx(stateMap, newTransitions, 'SanctionsSent', 'SanctionsResponseReceived', 'SanctionsSent', [
      'persist-sanctions-response'
    ]);
    addTx(stateMap, newTransitions, 'SanctionsSent', 'SanctionsNoHit', postSanctionsTarget, [
      'process-sanctions-clearance',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    if (stateMap.has('OfacPossibleHit')) {
      addTx(stateMap, newTransitions, 'SanctionsSent', 'SanctionsOfacPossibleHit', 'OfacPossibleHit', [
        'persist-ofac-hit',
        'notify-compliance',
        'persist-txn'
      ]);
    }
    addTx(stateMap, newTransitions, 'SanctionsSent', 'SanctionsException', 'SanctionsRespRepair', [
      'persist-sanctions-exception',
      'notify-bd-error',
      'persist-txn'
    ]);
    addTx(stateMap, newTransitions, 'SanctionsSent', 'OnRetry', 'SanctionsSent', [
      'reset-mtp',
      'send-sanctions-request',
      'persist-txn'
    ]);
  }

  if (stateMap.has('OfacPossibleHit')) {
    ensureState(stateMap, postSanctionsTarget);
    addTx(stateMap, newTransitions, 'OfacPossibleHit', 'SanctionsException', 'OfacPossibleHit', [
      'persist-sanctions-exception',
      'notify-compliance',
      'persist-txn'
    ]);
    addTx(stateMap, newTransitions, 'OfacPossibleHit', 'SanctionsResponseReceived', 'OfacPossibleHit', [
      'persist-sanctions-response'
    ]);
    addTx(stateMap, newTransitions, 'OfacPossibleHit', 'SanctionsFalseMatch', postSanctionsTarget, [
      'resolve-ofac-case',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    if (stateMap.has('SanctionsReject')) {
      addTx(stateMap, newTransitions, 'OfacPossibleHit', 'SanctionsReject', 'SanctionsReject', [
        'reject-on-sanctions-hit',
        'persist-txn',
        buildFinalNackAction(direction)
      ]);
    }
    if (stateMap.has('SanctionsSeized')) {
      addTx(stateMap, newTransitions, 'OfacPossibleHit', 'SanctionsSeized', 'SanctionsSeized', [
        'seize-on-sanctions-hit',
        'persist-txn',
        'notify-compliance'
      ]);
    }
    if (stateMap.has('SanctionsCancelled')) {
      addTx(stateMap, newTransitions, 'OfacPossibleHit', 'SanctionsCancelled', 'SanctionsCancelled', [
        'cancel-on-sanctions-hit',
        'persist-txn',
        buildFinalCancelAction(direction)
      ]);
    }
  }

  if (stateMap.has('SanctionsRespRepair')) {
    addTx(stateMap, newTransitions, 'SanctionsRespRepair', 'OnRetry', 'SanctionsSent', [
      'reset-mtp',
      'send-sanctions-request',
      'persist-txn'
    ]);
  }

  if (hasBalance) {
    addTx(stateMap, newTransitions, 'BalanceCheckPending', 'BalanceCheckResult', 'BalanceCheckPending', [
      'persist-balance-check-result'
    ]);
    if (stateMap.has('SendClearingPostingPending')) {
      addTx(
        stateMap,
        newTransitions,
        'BalanceCheckPending',
        'BalanceCheckPassedForClearing',
        'SendClearingPostingPending',
        ['reserve-funds', 'initiate-clearing-posting', 'persist-txn']
      );
    }
    if (stateMap.has('NormalPostingPending')) {
      addTx(
        stateMap,
        newTransitions,
        'BalanceCheckPending',
        'BalanceCheckPassedForPosting',
        'NormalPostingPending',
        ['reserve-funds', 'initiate-posting', 'persist-txn']
      );
    }
    addTx(stateMap, newTransitions, 'BalanceCheckPending', 'BalanceCheckInsufficientFunds', 'TxnRejectedOnNSF', [
      'persist-txn',
      buildFinalNackAction(direction),
      'notify-bd-error'
    ]);
    addTx(stateMap, newTransitions, 'BalanceCheckPending', 'BalanceCheckTechError', 'TxnRejectedOnGLSTechError', [
      'persist-txn',
      'notify-bd-error',
      'reject-on-gls-tech-error'
    ]);
  }

  if (stateMap.has('SendClearingPostingPending')) {
    addTx(
      stateMap,
      newTransitions,
      'SendClearingPostingPending',
      'ClearingResponseReceived',
      'SendClearingPostingPending',
      ['persist-clearing-response', 'persist-txn']
    );
    addTx(
      stateMap,
      newTransitions,
      'SendClearingPostingPending',
      'PostingFailureRecoverable',
      'SendClearingPostingPending',
      ['reset-mtp', 'retry-posting', 'persist-txn']
    );
    if (stateMap.has('SendClearingPostingComplete')) {
      addTx(
        stateMap,
        newTransitions,
        'SendClearingPostingPending',
        'PostingSuccess',
        'SendClearingPostingComplete',
        ['persist-posting-success', 'notify-bd-intermediate', 'persist-txn']
      );
    }
    if (stateMap.has('FinalPostingComplete')) {
      addTx(
        stateMap,
        newTransitions,
        'SendClearingPostingPending',
        'ClearingResponseACCC',
        'FinalPostingComplete',
        ['persist-txn', buildFinalAckAction(direction), 'notify-bd-intermediate']
      );
    }
    if (stateMap.has('ClrRejectedOrgPostingPending')) {
      addTx(
        stateMap,
        newTransitions,
        'SendClearingPostingPending',
        'ClearingResponseRJCT',
        'ClrRejectedOrgPostingPending',
        ['persist-txn', 'notify-bd-error', 'persist-clearing-reject']
      );
    }
    if (stateMap.has('TxnRejectedOnGLSTechError')) {
      addTx(
        stateMap,
        newTransitions,
        'SendClearingPostingPending',
        'PostingFailure',
        'TxnRejectedOnGLSTechError',
        ['persist-txn', 'notify-bd-error', 'reject-on-gls-tech-error']
      );
    }
  }
  if (stateMap.has('SendClearingPostingComplete')) {
    if (stateMap.has('FinalPostingComplete')) {
      addTx(
        stateMap,
        newTransitions,
        'SendClearingPostingComplete',
        'ClearingResponseACCC',
        'FinalPostingComplete',
        ['persist-txn', buildFinalAckAction(direction), 'notify-bd-intermediate']
      );
    }
    if (stateMap.has('ClearingRejectPostingComplete')) {
      addTx(
        stateMap,
        newTransitions,
        'SendClearingPostingComplete',
        'ClearingResponseRJCT',
        'ClearingRejectPostingComplete',
        ['persist-txn', buildFinalNackAction(direction), 'notify-bd-error']
      );
    }
  }

  if (stateMap.has('NormalPostingPending')) {
    if (stateMap.has('FinalPostingComplete')) {
      addTx(stateMap, newTransitions, 'NormalPostingPending', 'PostingSuccess', 'FinalPostingComplete', [
        'persist-posting-success',
        'persist-txn',
        buildFinalAckAction(direction)
      ]);
    }
    addTx(
      stateMap,
      newTransitions,
      'NormalPostingPending',
      'PostingFailureRecoverable',
      'NormalPostingPending',
      ['reset-mtp', 'retry-posting', 'persist-txn']
    );
    if (stateMap.has('TxnRejectedOnGLSTechError')) {
      addTx(
        stateMap,
        newTransitions,
        'NormalPostingPending',
        'PostingFailure',
        'TxnRejectedOnGLSTechError',
        ['persist-txn', 'notify-bd-error', 'reject-on-gls-tech-error']
      );
    }
  }

  if (stateMap.has('ClrRejectedOrgPostingPending')) {
    addTx(
      stateMap,
      newTransitions,
      'ClrRejectedOrgPostingPending',
      'PostingFailureRecoverable',
      'ClrRejectedOrgPostingPending',
      ['reset-mtp', 'retry-rejection-posting', 'persist-txn']
    );
    addTx(
      stateMap,
      newTransitions,
      'ClrRejectedOrgPostingPending',
      'PostingSuccess',
      'ClearingRejectPostingComplete',
      ['persist-rejection-posting', 'persist-txn', buildFinalNackAction(direction)]
    );
    if (stateMap.has('TxnRejectedOnGLSTechError')) {
      addTx(
        stateMap,
        newTransitions,
        'ClrRejectedOrgPostingPending',
        'PostingFailure',
        'TxnRejectedOnGLSTechError',
        ['persist-txn', 'notify-bd-error', 'reject-on-gls-tech-error']
      );
    }
  }

  const preservedStartState = hasPresetBase ? presetSpec?.startState : undefined;
  const startState = chooseBestStartState(stateMap, preservedStartState);
  ensureState(stateMap, startState);

  const orderingTerminalStates = new Set<string>(terminalStates);
  stateMap.forEach((state) => {
    if (state.name !== startState && Object.keys(state.onEvent ?? {}).length === 0) {
      orderingTerminalStates.add(state.name);
    }
  });

  const orderedStateNames = [
    startState,
    ...[...stateMap.keys()]
      .filter((stateName) => stateName !== startState && !orderingTerminalStates.has(stateName))
      .sort((left, right) => left.localeCompare(right)),
    ...[...stateMap.keys()]
      .filter((stateName) => stateName !== startState && orderingTerminalStates.has(stateName))
      .sort((left, right) => left.localeCompare(right))
  ];

  const states = orderedStateNames
    .filter((stateName, index, values) => values.indexOf(stateName) === index)
    .map((stateName) => stateMap.get(stateName))
    .filter((state): state is StateSpec => Boolean(state))
    .map((state) => ({
      name: state.name,
      onEvent: Object.fromEntries(
        Object.entries(state.onEvent ?? {}).map(([eventName, transition]) => [
          eventName,
          {
            target: transition.target,
            actions: [...(transition.actions ?? [])]
          } satisfies TransitionSpec
        ])
      )
    }));

  const resolvedWorkflowKey =
    workflowKey?.trim() || `${countryCode.trim().toUpperCase()}_${direction.toUpperCase()}_PAYMENT`;

  return {
    spec: {
      workflowKey: resolvedWorkflowKey,
      statesClass: hasPresetBase ? presetSpec?.statesClass ?? DEFAULT_STATES_CLASS : DEFAULT_STATES_CLASS,
      eventsClass: hasPresetBase ? presetSpec?.eventsClass ?? DEFAULT_EVENTS_CLASS : DEFAULT_EVENTS_CLASS,
      startState: hasPresetBase ? presetSpec?.startState ?? startState : startState,
      states
    },
    newTransitions
  };
}
