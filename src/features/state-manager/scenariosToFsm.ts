import {
  lintWorkflowSpec,
  orderWorkflowStates,
  type StateSpec,
  type TransitionSpec,
  type WorkflowLintResult,
  type WorkflowSpec
} from '../../models/snapshot';
import type { FlowDirection, ScenarioCategory } from './types';
import { analyzeScenarios } from './analysis/analyzeScenarios';
import type { AnalysisModel, FlowArchetype } from './analysis/types';
import { validateGeneratedWorkflow } from './validation/graphValidation';
import { replayScenariosAgainstWorkflow } from './validation/replayScenarios';
import type { GraphValidationReport, ScenarioReplayReport } from './validation/types';
import { getCountryPolicy, REGISTERED_COUNTRY_POLICY_CODES } from './countryRules/countryRuleRegistry';
import { inferTransitionSemantic, resolveTransitionDefinition } from './countryRules/actionResolver';
import type { CountryActionPolicy } from './countryRules/types';

const DEFAULT_STATES_CLASS = 'com.citi.cpx.statemanager.fsm.State';
const DEFAULT_EVENTS_CLASS = 'com.citi.cpx.statemanager.fsm.Event';
const FUTURE_DATED_SUBFLOW_PATTERN = /future[\s-]*dated/i;

type DirectionInput = FlowDirection | 'I' | 'O' | 'INCOMING' | 'OUTGOING' | null | undefined;
type StateResolutionOptions = Pick<FsmGenerationOptions, 'preFsmRejections' | 'customDirectMap'>;
type TransitionSourceKind = 'preset' | 'fallback';
type TransitionResolution = KnowledgeEntry & { sourceKind: TransitionSourceKind };
type FsmGenerationErrorDetails = Partial<FsmGenerationResult> & { spec?: WorkflowSpec };

export type KnowledgeEntry = {
  eventName: string;
  actions: string[];
};

export type ExpandedTransition = {
  target: string;
  actions: string[];
};

export type FsmGenerationOptions = {
  preFsmRejections?: string[];
  customDirectMap?: Record<string, string>;
  enabledRuleIds?: string[];
  disabledRuleIds?: string[];
  skipObservedTransitions?: boolean;
};

export type FsmGenerationResult = {
  spec: WorkflowSpec;
  newTransitions: Set<string>;
  lint: WorkflowLintResult;
  analysis?: AnalysisModel;
  graphValidation?: GraphValidationReport;
  scenarioReplay?: ScenarioReplayReport;
  presetBackedTransitionKeys?: Set<string>;
  fallbackTransitionKeys?: Set<string>;
};

export type ExpansionContext = {
  discovered: Set<string>;
  prunedTransitions: Map<string, Set<string>>;
  sequences: string[][];
  kb: Map<string, KnowledgeEntry>;
  kbBySourceEventTarget: Map<string, KnowledgeEntry>;
  countryCode: string;
  direction: 'incoming' | 'outgoing';
  countryPolicy: CountryActionPolicy;
  topArchetype?: FlowArchetype;
  inferredTargets: {
    nextAfterInit?: string;
    postSanctionsTarget?: string;
    balanceTarget?: string;
    warehousedReleaseTarget?: string;
  };
  additionalTerminals: Set<string>;
  expandedTransitions: Map<string, Record<string, ExpandedTransition>>;
  newTransitions: Set<string>;
  presetBackedTransitionKeys: Set<string>;
  fallbackTransitionKeys: Set<string>;
  terminalStates: Set<string>;
};

export type ExpansionRule = {
  id: string;
  triggers: (ctx: ExpansionContext) => boolean;
  apply: (ctx: ExpansionContext) => void;
};

export const DEFAULT_PRE_FSM_REJECTIONS = [
  'ACCOUNT_INVALID',
  'ACCOUNT_CLOSED',
  'INVALID_ACCOUNT_CLASS',
  'TAX_INFO_MISSING',
  'INVALID_TAX_ID',
  'ALIAS_NOT_RESOLVED',
  'CREDITOR_MEMBERSHIP_INVALID'
];

export const DEFAULT_DIRECT_MAP: Record<string, string> = {
  VALIDATED: 'Init',
  RECEIVED_FOR_PROCESSING: 'Init',
  SPM_SENT: 'SpmSent',
  SPM_FAILED: 'SpmFailed',
  SPM_ERROR: 'SpmError',
  SANCTIONS_SENT: 'SanctionsSent',
  BALANCE_CHECK_PENDING: 'BalanceCheckPending',
  OFAC_POSSIBLE_HIT: 'OfacPossibleHit',
  CLEARING_REJECT_POSTING_PENDING: 'ClrRejectedOrgPostingPending',
  CLEARING_REJECT_POSTING_COMPLETE: 'ClearingRejectPostingComplete',
  DUPLICATE: 'DuplicatePayment',
  SANCTION_REJECTED: 'SanctionsReject',
  SANCTION_CANCELLED: 'SanctionsCancelled',
  SANCTIONS_SEIZED: 'SanctionsSeized',
  STOP_RECALL_REQUEST: 'SanctionsCancelled'
};

function normalizeToken(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function toPascalCase(value: string): string {
  return value
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
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

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function buildKnowledgeKey(source: string, target: string): string {
  return `${source.trim()}->${target.trim()}`;
}

function buildSourceEventTargetKnowledgeKey(source: string, eventName: string, target: string): string {
  return `${source.trim()}::${normalizeEventKey(eventName)}->${target.trim()}`;
}

function normalizeEventKey(eventName: string): string {
  return eventName.trim().toUpperCase();
}

function findExistingEventName(
  onEvent: Record<string, ExpandedTransition>,
  eventName: string
): string | null {
  const normalizedEventName = normalizeEventKey(eventName);
  if (!normalizedEventName) {
    return null;
  }

  return (
    Object.keys(onEvent).find((candidate) => normalizeEventKey(candidate) === normalizedEventName) ?? null
  );
}

function normalizePreFsmRejections(preFsmRejections?: string[]): Set<string> {
  const source = preFsmRejections ?? DEFAULT_PRE_FSM_REJECTIONS;
  return new Set(source.map((entry) => normalizeToken(entry)).filter(Boolean));
}

function normalizeDirectMap(customDirectMap?: Record<string, string>): Map<string, string> {
  const directMap = new Map<string, string>();

  const applyEntries = (entries: Record<string, string>) => {
    Object.entries(entries).forEach(([key, value]) => {
      const normalizedKey = normalizeToken(key);
      const normalizedValue = value.trim();
      if (!normalizedKey || !normalizedValue) {
        return;
      }
      directMap.set(normalizedKey, normalizedValue);
    });
  };

  applyEntries(DEFAULT_DIRECT_MAP);
  if (customDirectMap) {
    applyEntries(customDirectMap);
  }

  return directMap;
}

export function normalizeDirection(direction?: DirectionInput): 'incoming' | 'outgoing' {
  const token = normalizeToken(direction ?? '');
  return token === 'INCOMING' || token === 'I' ? 'incoming' : 'outgoing';
}

function isSanctionsDiscovered(discovered: ReadonlySet<string>): boolean {
  return (
    discovered.has('SanctionsSent') ||
    discovered.has('OfacPossibleHit') ||
    discovered.has('SanctionsReject') ||
    discovered.has('SanctionsCancelled') ||
    discovered.has('SanctionsSeized')
  );
}

function resolveBalanceTarget(discovered: ReadonlySet<string>): string {
  return discovered.has('BalanceCheckPending') ? 'BalanceCheckPending' : 'NormalPostingPending';
}

function resolveNextAfterInit(discovered: ReadonlySet<string>): string {
  if (discovered.has('SpmSent')) {
    return 'SpmCheck';
  }
  if (isSanctionsDiscovered(discovered)) {
    return 'SanctionsSent';
  }
  return 'BalanceCheckPending';
}

function resolveDisabledSpmTarget(discovered: ReadonlySet<string>): string {
  return isSanctionsDiscovered(discovered) ? 'SanctionsSent' : 'BalanceCheckPending';
}

function resolvePreSanctionsTarget(discovered: ReadonlySet<string>): string {
  return discovered.has('SanctionsSent') ? 'PreSanctionsResultCheck' : 'BalanceCheckPending';
}

function resolveAnalysisBalanceTarget(
  ctx: Pick<ExpansionContext, 'discovered' | 'inferredTargets'>
): string {
  return ctx.inferredTargets.balanceTarget?.trim() || resolveBalanceTarget(ctx.discovered);
}

function resolveAnalysisNextAfterInit(
  ctx: Pick<ExpansionContext, 'discovered' | 'inferredTargets'>
): string {
  return ctx.inferredTargets.nextAfterInit?.trim() || resolveNextAfterInit(ctx.discovered);
}

function resolveAnalysisPostSanctionsTarget(
  ctx: Pick<ExpansionContext, 'discovered' | 'inferredTargets'>
): string {
  return ctx.inferredTargets.postSanctionsTarget?.trim() || resolveAnalysisBalanceTarget(ctx);
}

function resolveAnalysisWarehousedReleaseTarget(
  ctx: Pick<ExpansionContext, 'inferredTargets' | 'sequences'>
): string | null {
  return ctx.inferredTargets.warehousedReleaseTarget?.trim() || selectWarehousedReleaseTarget(ctx.sequences);
}

function hasObservedTransition(ctx: Pick<ExpansionContext, 'prunedTransitions'>, source: string, target: string): boolean {
  return ctx.prunedTransitions.get(source)?.has(target) ?? false;
}

function isClearingDominantArchetype(topArchetype: FlowArchetype | undefined): boolean {
  return (
    topArchetype === 'OUTGOING_SPM_SANCTIONS_BALANCE_CLEARING' ||
    topArchetype === 'OUTGOING_CLEARING_REJECTION'
  );
}

function shouldAddBalanceBranch(ctx: ExpansionContext, target: 'SendClearingPostingPending' | 'NormalPostingPending'): boolean {
  if (!ctx.discovered.has(target)) {
    return false;
  }

  if (hasObservedTransition(ctx, 'BalanceCheckPending', target)) {
    return true;
  }

  if (target === 'SendClearingPostingPending' && isClearingDominantArchetype(ctx.topArchetype)) {
    return true;
  }

  return ctx.inferredTargets.balanceTarget === target;
}

function countRows(scenarios: readonly ScenarioCategory[]): number {
  return scenarios.reduce(
    (scenarioTotal, scenario) =>
      scenarioTotal + scenario.subFlows.reduce((subFlowTotal, subFlow) => subFlowTotal + subFlow.rows.length, 0),
    0
  );
}

function ensureExpandedState(
  expandedTransitions: Map<string, Record<string, ExpandedTransition>>,
  stateName: string
): void {
  const trimmedStateName = stateName.trim();
  if (!trimmedStateName || expandedTransitions.has(trimmedStateName)) {
    return;
  }

  expandedTransitions.set(trimmedStateName, {});
}

function createExpandedTransitions(seed?: WorkflowSpec | null): Map<string, Record<string, ExpandedTransition>> {
  const expandedTransitions = new Map<string, Record<string, ExpandedTransition>>();

  seed?.states.forEach((state) => {
    const stateName = typeof state?.name === 'string' ? state.name.trim() : '';
    if (!stateName) {
      return;
    }

    const onEvent: Record<string, ExpandedTransition> = {};
    Object.entries(state.onEvent ?? {}).forEach(([eventName, transition]) => {
      const trimmedEventName = eventName.trim();
      const target = typeof transition?.target === 'string' ? transition.target.trim() : '';
      if (!trimmedEventName || !target) {
        return;
      }

      const finalEventName = buildUniqueEventName(onEvent, trimmedEventName, target);
      if (!finalEventName || onEvent[finalEventName]) {
        return;
      }

      onEvent[finalEventName] = {
        target,
        actions: normalizeActions(transition.actions ?? [])
      };
    });

    expandedTransitions.set(stateName, onEvent);
  });

  return expandedTransitions;
}

function buildUniqueEventName(
  onEvent: Record<string, ExpandedTransition>,
  eventName: string,
  target: string
): string {
  const trimmedEventName = eventName.trim();
  if (!trimmedEventName) {
    return '';
  }

  const existingEventName = findExistingEventName(onEvent, trimmedEventName);
  if (existingEventName) {
    const existing = onEvent[existingEventName];
    if (!existing || existing.target === target) {
      return existingEventName;
    }
  } else {
    return trimmedEventName;
  }

  const suffix = `To${target}`;
  let nextEventName = `${trimmedEventName}${suffix}`;
  let counter = 2;

  while (true) {
    const conflictingEventName = findExistingEventName(onEvent, nextEventName);
    if (!conflictingEventName) {
      return nextEventName;
    }

    if (onEvent[conflictingEventName]?.target === target) {
      return conflictingEventName;
    }

    nextEventName = `${trimmedEventName}${suffix}${counter}`;
    counter += 1;
  }
}

function addTx(
  ctx: ExpansionContext,
  source: string,
  eventName: string,
  target: string,
  actions: readonly string[],
  sourceKind: TransitionSourceKind
): string | null {
  const trimmedSource = source.trim();
  const trimmedTarget = target.trim();
  const trimmedEventName = eventName.trim();
  if (!trimmedSource || !trimmedTarget || !trimmedEventName) {
    return null;
  }

  ensureExpandedState(ctx.expandedTransitions, trimmedSource);
  ensureExpandedState(ctx.expandedTransitions, trimmedTarget);

  const sourceTransitions = ctx.expandedTransitions.get(trimmedSource);
  if (!sourceTransitions) {
    return null;
  }

  const finalEventName = buildUniqueEventName(sourceTransitions, trimmedEventName, trimmedTarget);
  if (!finalEventName) {
    return null;
  }

  const normalizedActions = normalizeActions(actions);
  const existing = sourceTransitions[finalEventName];
  const transitionKey = `${trimmedSource}::${finalEventName}`;
  if (existing) {
    if (existing.target === trimmedTarget) {
      if (sourceKind === 'preset') {
        if (!arraysEqual(existing.actions, normalizedActions)) {
          sourceTransitions[finalEventName] = {
            target: trimmedTarget,
            actions: normalizedActions
          };
        }
        ctx.presetBackedTransitionKeys.add(transitionKey);
        ctx.fallbackTransitionKeys.delete(transitionKey);
      }
      return finalEventName;
    }
    return finalEventName;
  }

  sourceTransitions[finalEventName] = {
    target: trimmedTarget,
    actions: normalizedActions
  };

  ctx.newTransitions.add(transitionKey);
  if (sourceKind === 'preset') {
    ctx.presetBackedTransitionKeys.add(transitionKey);
  } else {
    ctx.fallbackTransitionKeys.add(transitionKey);
  }

  return finalEventName;
}

function resolveFromKbOrFallback(
  ctx: ExpansionContext,
  source: string,
  target: string,
  fallbackEventName: string,
  fallbackActions: readonly string[]
): TransitionResolution {
  const resolved = resolveTransitionDefinition({
    countryCode: ctx.countryCode,
    direction: ctx.direction,
    source,
    target,
    eventName: fallbackEventName,
    isTerminal: ctx.terminalStates.has(target),
    policy: ctx.countryPolicy,
    semantic: inferTransitionSemantic(source, fallbackEventName, target),
    knowledgeBySourceTarget: ctx.kb,
    knowledgeBySourceEventTarget: ctx.kbBySourceEventTarget
  });

  if (resolved.sourceKind === 'genericFallback' && fallbackActions.length > 0) {
    return {
      eventName: resolved.eventName,
      actions: normalizeActions(fallbackActions),
      sourceKind: 'fallback'
    };
  }

  return {
    eventName: resolved.eventName,
    actions: [...resolved.actions],
    sourceKind: resolved.sourceKind === 'preset' ? 'preset' : 'fallback'
  };
}

function selectWarehousedReleaseTarget(sequences: readonly string[][]): string | null {
  const counts = new Map<string, number>();

  sequences.forEach((sequence) => {
    for (let index = 0; index < sequence.length - 1; index += 1) {
      if (sequence[index] !== 'Warehoused') {
        continue;
      }
      const releaseTarget = sequence[index + 1];
      if (!releaseTarget || releaseTarget === 'Warehoused') {
        continue;
      }
      counts.set(releaseTarget, (counts.get(releaseTarget) ?? 0) + 1);
    }
  });

  return [...counts.entries()].sort((left, right) => {
    const countCompare = right[1] - left[1];
    if (countCompare !== 0) {
      return countCompare;
    }
    return left[0].localeCompare(right[0]);
  })[0]?.[0] ?? null;
}

function markTerminalState(ctx: ExpansionContext, stateName: string): void {
  const trimmedStateName = stateName.trim();
  if (!trimmedStateName) {
    return;
  }
  ctx.additionalTerminals.add(trimmedStateName);
  ctx.terminalStates.add(trimmedStateName);
  ensureExpandedState(ctx.expandedTransitions, trimmedStateName);
}
const RULE_A_INIT_DUP_CHECK: ExpansionRule = {
  id: 'A',
  triggers: (ctx) => ctx.discovered.has('Init'),
  apply: (ctx) => {
    const ccToken = ctx.countryCode.toLowerCase();
    const dirToken = ctx.direction;
    const nextAfterInit = resolveAnalysisNextAfterInit(ctx);

    let resolved = resolveFromKbOrFallback(ctx, 'Init', 'Init', 'DupCheckCompleted', ['on-dup-check-completed']);
    addTx(ctx, 'Init', resolved.eventName, 'Init', resolved.actions, resolved.sourceKind);

    resolved = resolveFromKbOrFallback(ctx, 'Init', nextAfterInit, 'DupCheckPassed', [
      'on-dup-check-passed',
      'do-spm-check',
      `notify-proxy-svc-${ccToken}-${dirToken}`
    ]);
    addTx(ctx, 'Init', resolved.eventName, nextAfterInit, resolved.actions, resolved.sourceKind);

    if (ctx.discovered.has('DuplicatePayment')) {
      resolved = resolveFromKbOrFallback(ctx, 'Init', 'DuplicatePayment', 'DupCheckFailed', [
        'on-dup-check-failed',
        `notify-client-final-nack-${dirToken}`,
        'persist-txn',
        'notify-bd-error'
      ]);
      addTx(ctx, 'Init', resolved.eventName, 'DuplicatePayment', resolved.actions, resolved.sourceKind);
    }
  }
};

const RULE_B_SPM_LIFECYCLE: ExpansionRule = {
  id: 'B',
  triggers: (ctx) => ctx.discovered.has('SpmSent'),
  apply: (ctx) => {
    const disabledTarget = resolveDisabledSpmTarget(ctx.discovered);
    const preSanctionsTarget = resolvePreSanctionsTarget(ctx.discovered);

    let resolved = resolveFromKbOrFallback(ctx, 'SpmCheck', 'SpmSent', 'SpmEnabled', [
      'do-pre-sanctions-enrichment',
      'persist-txn'
    ]);
    addTx(ctx, 'SpmCheck', resolved.eventName, 'SpmSent', resolved.actions, resolved.sourceKind);

    resolved = resolveFromKbOrFallback(ctx, 'SpmCheck', disabledTarget, 'SpmDisabled', [
      'send-sanctions-request',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    addTx(ctx, 'SpmCheck', resolved.eventName, disabledTarget, resolved.actions, resolved.sourceKind);

    resolved = resolveFromKbOrFallback(ctx, 'SpmSent', preSanctionsTarget, 'SpmEnrichmentSuccessful', [
      'save-spm-result',
      'process-spm-result'
    ]);
    addTx(ctx, 'SpmSent', resolved.eventName, preSanctionsTarget, resolved.actions, resolved.sourceKind);

    resolved = resolveFromKbOrFallback(ctx, 'SpmSent', 'SpmError', 'SpmEnrichmentError', [
      'save-spm-error-result',
      'persist-txn',
      'notify-bd-error'
    ]);
    addTx(ctx, 'SpmSent', resolved.eventName, 'SpmError', resolved.actions, resolved.sourceKind);

    resolved = resolveFromKbOrFallback(ctx, 'SpmSent', 'SpmFailed', 'SpmEnrichmentFailed', [
      'save-spm-failed-result',
      'persist-txn',
      'notify-bd-error'
    ]);
    addTx(ctx, 'SpmSent', resolved.eventName, 'SpmFailed', resolved.actions, resolved.sourceKind);

    const retryActions = ['reset-mtp', 'do-pre-sanctions-enrichment', 'persist-txn'];
    const retryPairs: Array<[string, string]> = [
      ['SpmSent', 'SpmSent'],
      ['SpmError', 'SpmSent'],
      ['SpmFailed', 'SpmSent']
    ];

    retryPairs.forEach(([source, target]) => {
      const retryTransition = resolveFromKbOrFallback(ctx, source, target, 'OnRetry', retryActions);
      addTx(ctx, source, retryTransition.eventName, target, retryTransition.actions, retryTransition.sourceKind);
    });
  }
};

const RULE_C_PRE_SANCTIONS_RESULT_CHECK: ExpansionRule = {
  id: 'C',
  triggers: (ctx) => ctx.discovered.has('SpmSent') && ctx.discovered.has('SanctionsSent'),
  apply: (ctx) => {
    let resolved = resolveFromKbOrFallback(ctx, 'PreSanctionsResultCheck', 'BalanceCheckPending', 'SkipSanctions', [
      'do-balance-check',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    addTx(ctx, 'PreSanctionsResultCheck', resolved.eventName, 'BalanceCheckPending', resolved.actions, resolved.sourceKind);

    resolved = resolveFromKbOrFallback(ctx, 'PreSanctionsResultCheck', 'SanctionsSent', 'NeedSanctions', [
      'send-sanctions-request',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    addTx(ctx, 'PreSanctionsResultCheck', resolved.eventName, 'SanctionsSent', resolved.actions, resolved.sourceKind);
  }
};

const RULE_D_SANCTIONS_LIFECYCLE: ExpansionRule = {
  id: 'D',
  triggers: (ctx) => ctx.discovered.has('SanctionsSent'),
  apply: (ctx) => {
    const balanceTarget = resolveAnalysisPostSanctionsTarget(ctx);

    let resolved = resolveFromKbOrFallback(ctx, 'SanctionsSent', 'SanctionsSent', 'SanctionsResponseReceived', [
      'process-sanctions-response'
    ]);
    addTx(ctx, 'SanctionsSent', resolved.eventName, 'SanctionsSent', resolved.actions, resolved.sourceKind);

    resolved = resolveFromKbOrFallback(ctx, 'SanctionsSent', balanceTarget, 'SanctionsNoHit', [
      'do-balance-check',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    addTx(ctx, 'SanctionsSent', resolved.eventName, balanceTarget, resolved.actions, resolved.sourceKind);

    if (ctx.discovered.has('OfacPossibleHit')) {
      resolved = resolveFromKbOrFallback(ctx, 'SanctionsSent', 'OfacPossibleHit', 'SanctionsOfacPossibleHit', [
        'persist-txn',
        'notify-bd-intermediate'
      ]);
      addTx(ctx, 'SanctionsSent', resolved.eventName, 'OfacPossibleHit', resolved.actions, resolved.sourceKind);
    }

    resolved = resolveFromKbOrFallback(ctx, 'SanctionsSent', 'SanctionsRespRepair', 'SanctionsException', [
      'process-sanctions-error',
      'persist-txn'
    ]);
    addTx(ctx, 'SanctionsSent', resolved.eventName, 'SanctionsRespRepair', resolved.actions, resolved.sourceKind);

    resolved = resolveFromKbOrFallback(ctx, 'SanctionsSent', 'SanctionsSent', 'OnRetry', [
      'reset-mtp',
      'send-sanctions-request',
      'persist-txn'
    ]);
    addTx(ctx, 'SanctionsSent', resolved.eventName, 'SanctionsSent', resolved.actions, resolved.sourceKind);
  }
};

const RULE_E_OFAC_POSSIBLE_HIT: ExpansionRule = {
  id: 'E',
  triggers: (ctx) => ctx.discovered.has('OfacPossibleHit'),
  apply: (ctx) => {
    const ccToken = ctx.countryCode.toLowerCase();
    const dirToken = ctx.direction;
    const balanceTarget = resolveAnalysisPostSanctionsTarget(ctx);

    const sanctionsException = resolveFromKbOrFallback(ctx, 'OfacPossibleHit', 'OfacPossibleHit', 'SanctionsException', [
      'process-sanctions-error',
      'notify-bd-error'
    ]);
    addTx(
      ctx,
      'OfacPossibleHit',
      sanctionsException.eventName,
      'OfacPossibleHit',
      sanctionsException.actions,
      sanctionsException.sourceKind
    );

    const sanctionsResponse = resolveFromKbOrFallback(
      ctx,
      'OfacPossibleHit',
      'OfacPossibleHit',
      'SanctionsResponseReceived',
      ['process-sanctions-final-response']
    );
    if (sanctionsResponse.eventName !== sanctionsException.eventName) {
      addTx(
        ctx,
        'OfacPossibleHit',
        sanctionsResponse.eventName,
        'OfacPossibleHit',
        sanctionsResponse.actions,
        sanctionsResponse.sourceKind
      );
    }

    let resolved = resolveFromKbOrFallback(ctx, 'OfacPossibleHit', balanceTarget, 'SanctionsFalseMatch', [
      `process-false-match-${ccToken}-${dirToken}`,
      'do-balance-check',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    addTx(ctx, 'OfacPossibleHit', resolved.eventName, balanceTarget, resolved.actions, resolved.sourceKind);

    if (ctx.discovered.has('SanctionsReject')) {
      resolved = resolveFromKbOrFallback(ctx, 'OfacPossibleHit', 'SanctionsReject', 'SanctionsRejectReport', [
        'do-sanctions-reject',
        `notify-client-final-nack-${dirToken}`,
        'persist-txn',
        'notify-bd-final'
      ]);
      addTx(ctx, 'OfacPossibleHit', resolved.eventName, 'SanctionsReject', resolved.actions, resolved.sourceKind);
    }

    if (ctx.discovered.has('SanctionsSeized')) {
      resolved = resolveFromKbOrFallback(ctx, 'OfacPossibleHit', 'SanctionsSeized', 'SanctionsBlockReport', [
        'do-sanctions-seize',
        `notify-client-final-nack-${dirToken}`,
        'persist-txn',
        'notify-bd-final'
      ]);
      addTx(ctx, 'OfacPossibleHit', resolved.eventName, 'SanctionsSeized', resolved.actions, resolved.sourceKind);
    }

    if (ctx.discovered.has('SanctionsCancelled')) {
      resolved = resolveFromKbOrFallback(ctx, 'OfacPossibleHit', 'SanctionsCancelled', 'SanctionsCancelled', [
        'do-sanctions-cancel',
        `notify-client-final-nack-${dirToken}`,
        'persist-txn',
        'notify-bd-final'
      ]);
      addTx(ctx, 'OfacPossibleHit', resolved.eventName, 'SanctionsCancelled', resolved.actions, resolved.sourceKind);
    }
  }
};

const RULE_F_SANCTIONS_RESP_REPAIR: ExpansionRule = {
  id: 'F',
  triggers: (ctx) => ctx.discovered.has('SanctionsRespRepair') || ctx.discovered.has('SanctionsSent'),
  apply: (ctx) => {
    const resolved = resolveFromKbOrFallback(ctx, 'SanctionsRespRepair', 'SanctionsSent', 'OnRetry', [
      'reset-mtp',
      'send-sanctions-request',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    addTx(ctx, 'SanctionsRespRepair', resolved.eventName, 'SanctionsSent', resolved.actions, resolved.sourceKind);
  }
};

const RULE_G_BALANCE_CHECK: ExpansionRule = {
  id: 'G',
  triggers: (ctx) => ctx.discovered.has('BalanceCheckPending'),
  apply: (ctx) => {
    const ccToken = ctx.countryCode.toLowerCase();
    const dirToken = ctx.direction;

    let resolved = resolveFromKbOrFallback(ctx, 'BalanceCheckPending', 'BalanceCheckPending', 'BalanceCheckResult', [
      `process-balance-check-result-${ccToken}-${dirToken}`
    ]);
    addTx(ctx, 'BalanceCheckPending', resolved.eventName, 'BalanceCheckPending', resolved.actions, resolved.sourceKind);

    if (shouldAddBalanceBranch(ctx, 'SendClearingPostingPending')) {
      resolved = resolveFromKbOrFallback(
        ctx,
        'BalanceCheckPending',
        'SendClearingPostingPending',
        'OutgoingSendToClearingWithAckAndPosting',
        [
          `send-to-clearing-for-${ccToken}-${dirToken}`,
          'do-normal-outgoing-posting',
          'persist-txn',
          'notify-bd-intermediate'
        ]
      );
      addTx(
        ctx,
        'BalanceCheckPending',
        resolved.eventName,
        'SendClearingPostingPending',
        resolved.actions,
        resolved.sourceKind
      );
    }

    if (shouldAddBalanceBranch(ctx, 'NormalPostingPending')) {
      resolved = resolveFromKbOrFallback(
        ctx,
        'BalanceCheckPending',
        'NormalPostingPending',
        'NotifyB2BToClearingAndPosting',
        [
          `notify-client-final-ack-${dirToken}`,
          `notify-b2b-to-clearing-for-${ccToken}-${dirToken}`,
          'do-normal-b2b-posting',
          'persist-txn',
          'notify-bd-intermediate'
        ]
      );
      addTx(ctx, 'BalanceCheckPending', resolved.eventName, 'NormalPostingPending', resolved.actions, resolved.sourceKind);
    }

    resolved = resolveFromKbOrFallback(ctx, 'BalanceCheckPending', 'TxnRejectedOnNSF', 'BalanceCheckNSFErrorTimeOut', [
      `notify-client-final-nack-${dirToken}`,
      'persist-txn',
      'notify-bd-error'
    ]);
    addTx(ctx, 'BalanceCheckPending', resolved.eventName, 'TxnRejectedOnNSF', resolved.actions, resolved.sourceKind);
    markTerminalState(ctx, 'TxnRejectedOnNSF');

    resolved = resolveFromKbOrFallback(
      ctx,
      'BalanceCheckPending',
      'TxnRejectedOnGLSTechError',
      'BalanceCheckGLSTechErrorTimeOut',
      [`notify-client-final-nack-${dirToken}`, 'persist-txn', 'notify-bd-error']
    );
    addTx(ctx, 'BalanceCheckPending', resolved.eventName, 'TxnRejectedOnGLSTechError', resolved.actions, resolved.sourceKind);
    markTerminalState(ctx, 'TxnRejectedOnGLSTechError');
  }
};

const RULE_H_CLEARING_AND_POSTING: ExpansionRule = {
  id: 'H',
  triggers: (ctx) => ctx.discovered.has('SendClearingPostingPending'),
  apply: (ctx) => {
    const dirToken = ctx.direction;

    let resolved = resolveFromKbOrFallback(
      ctx,
      'SendClearingPostingPending',
      'SendClearingPostingPending',
      'ClearingResponseReceived',
      []
    );
    addTx(
      ctx,
      'SendClearingPostingPending',
      resolved.eventName,
      'SendClearingPostingPending',
      resolved.actions,
      resolved.sourceKind
    );

    resolved = resolveFromKbOrFallback(ctx, 'SendClearingPostingPending', 'NormalPostingPending', 'ClearingResponseACCC', [
      `notify-client-final-ack-${dirToken}`,
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    addTx(ctx, 'SendClearingPostingPending', resolved.eventName, 'NormalPostingPending', resolved.actions, resolved.sourceKind);

    resolved = resolveFromKbOrFallback(
      ctx,
      'SendClearingPostingPending',
      'ClrRejectedOrgPostingPending',
      'ClearingResponseRJCT',
      [`notify-client-final-nack-${dirToken}`, `reverse-${dirToken}-payment`, 'persist-txn', 'notify-bd-intermediate']
    );
    addTx(
      ctx,
      'SendClearingPostingPending',
      resolved.eventName,
      'ClrRejectedOrgPostingPending',
      resolved.actions,
      resolved.sourceKind
    );

    resolved = resolveFromKbOrFallback(ctx, 'SendClearingPostingPending', 'SendClearingPostingComplete', 'PostingSuccess', [
      'process-normal-outgoing-posting-success',
      'persist-txn'
    ]);
    addTx(
      ctx,
      'SendClearingPostingPending',
      resolved.eventName,
      'SendClearingPostingComplete',
      resolved.actions,
      resolved.sourceKind
    );

    const postingFailure = resolveFromKbOrFallback(
      ctx,
      'SendClearingPostingPending',
      'SendClearingPostingPending',
      'PostingFailure',
      []
    );
    addTx(
      ctx,
      'SendClearingPostingPending',
      postingFailure.eventName,
      'SendClearingPostingPending',
      postingFailure.actions,
      postingFailure.sourceKind
    );

    const postingRecoverable = resolveFromKbOrFallback(
      ctx,
      'SendClearingPostingPending',
      'SendClearingPostingPending',
      'PostingFailureRecoverable',
      ['persist-txn']
    );
    if (postingRecoverable.eventName !== postingFailure.eventName) {
      addTx(
        ctx,
        'SendClearingPostingPending',
        postingRecoverable.eventName,
        'SendClearingPostingPending',
        postingRecoverable.actions,
        postingRecoverable.sourceKind
      );
    }

    if (ctx.discovered.has('SendClearingPostingComplete')) {
      resolved = resolveFromKbOrFallback(
        ctx,
        'SendClearingPostingComplete',
        'SendClearingPostingComplete',
        'ClearingResponseReceived',
        []
      );
      addTx(
        ctx,
        'SendClearingPostingComplete',
        resolved.eventName,
        'SendClearingPostingComplete',
        resolved.actions,
        resolved.sourceKind
      );

      resolved = resolveFromKbOrFallback(ctx, 'SendClearingPostingComplete', 'FinalPostingComplete', 'ClearingResponseACCC', [
        `notify-client-final-ack-${dirToken}`,
        'persist-txn',
        'notify-bd-final'
      ]);
      addTx(ctx, 'SendClearingPostingComplete', resolved.eventName, 'FinalPostingComplete', resolved.actions, resolved.sourceKind);

      resolved = resolveFromKbOrFallback(
        ctx,
        'SendClearingPostingComplete',
        'ClearingRejectPostingComplete',
        'ClearingResponseRJCT',
        [`notify-client-final-nack-${dirToken}`, `reverse-${dirToken}-payment`, 'persist-txn', 'notify-bd-final']
      );
      addTx(
        ctx,
        'SendClearingPostingComplete',
        resolved.eventName,
        'ClearingRejectPostingComplete',
        resolved.actions,
        resolved.sourceKind
      );
    }
  }
};

const RULE_I_POSTING_ONLY: ExpansionRule = {
  id: 'I',
  triggers: (ctx) => ctx.discovered.has('NormalPostingPending'),
  apply: (ctx) => {
    let resolved = resolveFromKbOrFallback(ctx, 'NormalPostingPending', 'FinalPostingComplete', 'PostingSuccess', [
      'process-normal-outgoing-posting-success',
      'persist-txn',
      'notify-bd-final'
    ]);
    addTx(ctx, 'NormalPostingPending', resolved.eventName, 'FinalPostingComplete', resolved.actions, resolved.sourceKind);

    const postingFailure = resolveFromKbOrFallback(ctx, 'NormalPostingPending', 'NormalPostingPending', 'PostingFailure', []);
    addTx(
      ctx,
      'NormalPostingPending',
      postingFailure.eventName,
      'NormalPostingPending',
      postingFailure.actions,
      postingFailure.sourceKind
    );

    const postingRecoverable = resolveFromKbOrFallback(
      ctx,
      'NormalPostingPending',
      'NormalPostingPending',
      'PostingFailureRecoverable',
      ['persist-txn']
    );
    if (postingRecoverable.eventName !== postingFailure.eventName) {
      addTx(
        ctx,
        'NormalPostingPending',
        postingRecoverable.eventName,
        'NormalPostingPending',
        postingRecoverable.actions,
        postingRecoverable.sourceKind
      );
    }
  }
};

const RULE_J_REJECTION_POSTING: ExpansionRule = {
  id: 'J',
  triggers: (ctx) => ctx.discovered.has('ClrRejectedOrgPostingPending'),
  apply: (ctx) => {
    let resolved = resolveFromKbOrFallback(
      ctx,
      'ClrRejectedOrgPostingPending',
      'ClearingRejectPostingComplete',
      'PostingSuccess',
      ['persist-txn', 'notify-bd-final']
    );
    addTx(
      ctx,
      'ClrRejectedOrgPostingPending',
      resolved.eventName,
      'ClearingRejectPostingComplete',
      resolved.actions,
      resolved.sourceKind
    );

    const postingFailure = resolveFromKbOrFallback(
      ctx,
      'ClrRejectedOrgPostingPending',
      'ClrRejectedOrgPostingPending',
      'PostingFailure',
      []
    );
    addTx(
      ctx,
      'ClrRejectedOrgPostingPending',
      postingFailure.eventName,
      'ClrRejectedOrgPostingPending',
      postingFailure.actions,
      postingFailure.sourceKind
    );

    const postingRecoverable = resolveFromKbOrFallback(
      ctx,
      'ClrRejectedOrgPostingPending',
      'ClrRejectedOrgPostingPending',
      'PostingFailureRecoverable',
      ['persist-txn']
    );
    if (postingRecoverable.eventName !== postingFailure.eventName) {
      addTx(
        ctx,
        'ClrRejectedOrgPostingPending',
        postingRecoverable.eventName,
        'ClrRejectedOrgPostingPending',
        postingRecoverable.actions,
        postingRecoverable.sourceKind
      );
    }
  }
};

const RULE_K_INCOMING_FLOW: ExpansionRule = {
  id: 'K',
  triggers: (ctx) => ctx.direction === 'incoming' && ctx.discovered.has('IncomingClearingReceived'),
  apply: (ctx) => {
    const ccToken = ctx.countryCode.toLowerCase();
    const dirToken = ctx.direction;

    let resolved = resolveFromKbOrFallback(
      ctx,
      'IncomingClearingReceived',
      'NormalPostingPending',
      'IncomingClearingAccepted',
      [`process-incoming-clearing-accept-${ccToken}-${dirToken}`, 'persist-txn', 'notify-bd-intermediate']
    );
    addTx(
      ctx,
      'IncomingClearingReceived',
      resolved.eventName,
      'NormalPostingPending',
      resolved.actions,
      resolved.sourceKind
    );

    resolved = resolveFromKbOrFallback(
      ctx,
      'IncomingClearingReceived',
      'ClrRejectedOrgPostingPending',
      'IncomingClearingRejected',
      [`notify-client-final-nack-${dirToken}`, `reverse-${dirToken}-payment`, 'persist-txn', 'notify-bd-intermediate']
    );
    addTx(
      ctx,
      'IncomingClearingReceived',
      resolved.eventName,
      'ClrRejectedOrgPostingPending',
      resolved.actions,
      resolved.sourceKind
    );

    resolved = resolveFromKbOrFallback(
      ctx,
      'IncomingClearingReceived',
      'FinalPostingComplete',
      'IncomingClearingPosted',
      ['process-incoming-posting-success', 'persist-txn', 'notify-bd-final']
    );
    addTx(
      ctx,
      'IncomingClearingReceived',
      resolved.eventName,
      'FinalPostingComplete',
      resolved.actions,
      resolved.sourceKind
    );
  }
};

const RULE_WAREHOUSED_SUPPORT: ExpansionRule = {
  id: 'WAREHOUSED',
  triggers: (ctx) => ctx.discovered.has('Warehoused'),
  apply: (ctx) => {
    const dirToken = ctx.direction;
    const releaseTarget = resolveAnalysisWarehousedReleaseTarget(ctx);

    if (releaseTarget) {
      const releaseTransition = resolveFromKbOrFallback(ctx, 'Warehoused', releaseTarget, 'OnRelease', [
        'release-from-warehouse',
        'persist-txn',
        'notify-bd-intermediate'
      ]);
      addTx(
        ctx,
        'Warehoused',
        releaseTransition.eventName,
        releaseTarget,
        releaseTransition.actions,
        releaseTransition.sourceKind
      );
    }

    const cancelTransition = resolveFromKbOrFallback(ctx, 'Warehoused', 'WarehousedCancelled', 'OnCancel', [
      'cancel-warehoused-payment',
      `notify-client-final-nack-${dirToken}`,
      'persist-txn',
      'notify-bd-final'
    ]);
    addTx(
      ctx,
      'Warehoused',
      cancelTransition.eventName,
      'WarehousedCancelled',
      cancelTransition.actions,
      cancelTransition.sourceKind
    );
    markTerminalState(ctx, 'WarehousedCancelled');
  }
};

const EXPANSION_RULES: readonly ExpansionRule[] = [
  RULE_A_INIT_DUP_CHECK,
  RULE_B_SPM_LIFECYCLE,
  RULE_C_PRE_SANCTIONS_RESULT_CHECK,
  RULE_D_SANCTIONS_LIFECYCLE,
  RULE_E_OFAC_POSSIBLE_HIT,
  RULE_F_SANCTIONS_RESP_REPAIR,
  RULE_G_BALANCE_CHECK,
  RULE_H_CLEARING_AND_POSTING,
  RULE_I_POSTING_ONLY,
  RULE_J_REJECTION_POSTING,
  RULE_K_INCOMING_FLOW,
  RULE_WAREHOUSED_SUPPORT
];

function selectExpansionRules(options?: FsmGenerationOptions): ExpansionRule[] {
  if (options?.enabledRuleIds?.length) {
    const enabledRuleIds = new Set(options.enabledRuleIds);
    return EXPANSION_RULES.filter((rule) => enabledRuleIds.has(rule.id));
  }

  const disabledRuleIds = new Set(options?.disabledRuleIds ?? []);
  return EXPANSION_RULES.filter((rule) => !disabledRuleIds.has(rule.id));
}

function mergeUniqueStrings(primary?: readonly string[], secondary?: readonly string[]): string[] | undefined {
  const merged = [...new Set([...(primary ?? []), ...(secondary ?? [])].map((value) => value.trim()).filter(Boolean))];
  return merged.length > 0 ? merged : undefined;
}

function mergeGenerationOptionsWithCountryPolicy(
  countryPolicy: CountryActionPolicy,
  options?: FsmGenerationOptions
): FsmGenerationOptions | undefined {
  const mergedDirectMap = {
    ...(countryPolicy.directMapOverrides ?? {}),
    ...(options?.customDirectMap ?? {})
  };
  const mergedEnabledRuleIds = mergeUniqueStrings(countryPolicy.enabledRuleIds, options?.enabledRuleIds);
  const mergedDisabledRuleIds = mergeUniqueStrings(countryPolicy.disabledRuleIds, options?.disabledRuleIds);
  const hasDirectMap = Object.keys(mergedDirectMap).length > 0;

  const mergedOptions: FsmGenerationOptions = {
    ...options,
    ...(hasDirectMap ? { customDirectMap: mergedDirectMap } : {}),
    ...(options?.preFsmRejections
      ? { preFsmRejections: [...options.preFsmRejections] }
      : countryPolicy.preFsmRejections
        ? { preFsmRejections: [...countryPolicy.preFsmRejections] }
        : {}),
    ...(mergedEnabledRuleIds ? { enabledRuleIds: mergedEnabledRuleIds } : {}),
    ...(mergedDisabledRuleIds ? { disabledRuleIds: mergedDisabledRuleIds } : {})
  };

  return Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined;
}

function isDirectionScopedWorkflowKey(workflowKey: string): boolean {
  return /^[A-Z]{2,3}_(INCOMING|OUTGOING)(_|$)/.test(workflowKey.trim().toUpperCase());
}

function extractRegisteredCountryCodeFromWorkflowKey(workflowKey: string): string | null {
  const normalizedWorkflowKey = workflowKey.trim().toUpperCase();
  const prefix = normalizedWorkflowKey.split('_')[0] ?? '';
  return REGISTERED_COUNTRY_POLICY_CODES.includes(prefix) ? prefix : null;
}

function filterPresetKnowledgeByCountryAndDirection(
  presets: readonly WorkflowSpec[],
  countryCode: string,
  direction: 'incoming' | 'outgoing'
): WorkflowSpec[] {
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  if (!normalizedCountryCode) {
    return [...presets];
  }

  const expectedPrefix = `${normalizedCountryCode}_${direction.toUpperCase()}`;
  return presets.filter((preset) => {
    const normalizedWorkflowKey = preset.workflowKey?.trim().toUpperCase() ?? '';
    if (!normalizedWorkflowKey) {
      return true;
    }

    const scopedCountryCode = extractRegisteredCountryCodeFromWorkflowKey(normalizedWorkflowKey);
    if (scopedCountryCode && scopedCountryCode !== normalizedCountryCode) {
      return false;
    }

    if (!isDirectionScopedWorkflowKey(normalizedWorkflowKey)) {
      return true;
    }

    return normalizedWorkflowKey === expectedPrefix || normalizedWorkflowKey.startsWith(`${expectedPrefix}_`);
  });
}

function resolveWorkflowKey(
  workflowKey: string | undefined,
  countryCode: string,
  direction: 'incoming' | 'outgoing'
): string {
  const trimmedWorkflowKey = workflowKey?.trim();
  if (trimmedWorkflowKey) {
    return trimmedWorkflowKey;
  }

  return `${countryCode.trim().toUpperCase()}_${direction.toUpperCase()}_PAYMENT`;
}

function buildStateSpec(
  stateName: string,
  expandedTransitions: Map<string, Record<string, ExpandedTransition>>
): StateSpec {
  const onEvent = expandedTransitions.get(stateName) ?? {};

  return {
    name: stateName,
    onEvent: Object.fromEntries(
      Object.entries(onEvent)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([eventName, transition]) => [
          eventName,
          {
            target: transition.target,
            actions: [...transition.actions]
          } satisfies TransitionSpec
        ])
    )
  };
}

export function resolveStateName(
  msgStatus: string,
  msgSubStatus: string,
  options?: StateResolutionOptions
): string | null {
  const status = normalizeToken(msgStatus);
  const subStatus = normalizeToken(msgSubStatus);

  if (!subStatus) {
    return null;
  }

  if (status === 'NON_PAY_COMPLETE' || status === 'NON_PAY_REJECTED' || subStatus === 'NON_PAY_RECEIVED_FOR_PROCESSING') {
    return null;
  }

  const preFsmRejections = normalizePreFsmRejections(options?.preFsmRejections);
  if (status === 'REJECTED' && preFsmRejections.has(subStatus)) {
    return null;
  }

  if (subStatus === 'WAREHOUSED') {
    return 'Warehoused';
  }

  if (subStatus === 'POSTING_PENDING' || subStatus === 'POSTING_PENDING_CLEARING_INFORMED') {
    return status === 'SENT_TO_CLEARING' ? 'SendClearingPostingPending' : 'NormalPostingPending';
  }

  if (subStatus === 'POSTING_COMPLETE' || subStatus === 'POSTING_COMPLETE_CLEARING_INFORMED') {
    if (status === 'SENT_TO_CLEARING') {
      return 'SendClearingPostingComplete';
    }
    if (status === 'COMPLETE') {
      return 'FinalPostingComplete';
    }
    if (status === 'REJECTED') {
      return 'ClearingRejectPostingComplete';
    }
  }

  const directMap = normalizeDirectMap(options?.customDirectMap);
  const directState = directMap.get(subStatus);
  if (directState) {
    return directState;
  }

  return toPascalCase(subStatus);
}

export function shouldSkipSubFlow(title: string): boolean {
  return FUTURE_DATED_SUBFLOW_PATTERN.test(title);
}

export function extractFlowSequences(
  scenarios: ScenarioCategory[],
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
        if (!stateName) {
          return;
        }
        if (sequence[sequence.length - 1] === stateName) {
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
  scenarios: ScenarioCategory[],
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

      if (!transitions.has(source)) {
        transitions.set(source, new Set<string>());
      }
      transitions.get(source)?.add(target);
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

      pruned.set(
        source,
        new Set(sortedTargets.filter((target) => !removedTargets.has(target)))
      );
    });

  return pruned;
}

export function detectTerminalStates(
  transitions: Map<string, Set<string>>,
  sequences: string[][],
  allStates: Set<string>
): Set<string> {
  const endOfFlow = new Set<string>();
  sequences.forEach((sequence) => {
    const lastState = sequence[sequence.length - 1];
    if (lastState) {
      endOfFlow.add(lastState);
    }
  });

  return new Set(
    [...allStates].filter((stateName) => endOfFlow.has(stateName) && (transitions.get(stateName)?.size ?? 0) === 0)
  );
}

export function buildKnowledgeBase(presets: readonly WorkflowSpec[]): Map<string, KnowledgeEntry> {
  const knowledgeBase = new Map<string, KnowledgeEntry>();

  presets.forEach((preset) => {
    if (!preset || !Array.isArray(preset.states)) {
      return;
    }

    preset.states.forEach((state) => {
      const source = typeof state?.name === 'string' ? state.name.trim() : '';
      if (!source || !state.onEvent || typeof state.onEvent !== 'object') {
        return;
      }

      Object.entries(state.onEvent).forEach(([eventName, transition]) => {
        const trimmedEventName = eventName.trim();
        const target = typeof transition?.target === 'string' ? transition.target.trim() : '';
        if (!trimmedEventName || !target) {
          return;
        }

        const key = buildKnowledgeKey(source, target);
        if (knowledgeBase.has(key)) {
          return;
        }

        knowledgeBase.set(key, {
          eventName: trimmedEventName,
          actions: normalizeActions(transition.actions ?? [])
        });
      });
    });
  });

  return knowledgeBase;
}

function buildSourceEventTargetKnowledgeBase(presets: readonly WorkflowSpec[]): Map<string, KnowledgeEntry> {
  const knowledgeBase = new Map<string, KnowledgeEntry>();

  presets.forEach((preset) => {
    if (!preset || !Array.isArray(preset.states)) {
      return;
    }

    preset.states.forEach((state) => {
      const source = typeof state?.name === 'string' ? state.name.trim() : '';
      if (!source || !state.onEvent || typeof state.onEvent !== 'object') {
        return;
      }

      Object.entries(state.onEvent).forEach(([eventName, transition]) => {
        const trimmedEventName = eventName.trim();
        const target = typeof transition?.target === 'string' ? transition.target.trim() : '';
        if (!trimmedEventName || !target) {
          return;
        }

        const key = buildSourceEventTargetKnowledgeKey(source, trimmedEventName, target);
        if (knowledgeBase.has(key)) {
          return;
        }

        knowledgeBase.set(key, {
          eventName: trimmedEventName,
          actions: normalizeActions(transition.actions ?? [])
        });
      });
    });
  });

  return knowledgeBase;
}

export function resolveEventName(
  source: string,
  target: string,
  terminalStates: Set<string>,
  kb: Map<string, KnowledgeEntry>
): string {
  const knowledge = kb.get(buildKnowledgeKey(source, target));
  if (knowledge) {
    return knowledge.eventName;
  }

  if (terminalStates.has(target)) {
    return `Reached${target}`;
  }

  return `Process${target}`;
}

export function resolveActions(
  source: string,
  target: string,
  terminalStates: Set<string>,
  countryCode: string,
  direction: 'incoming' | 'outgoing',
  kb: Map<string, KnowledgeEntry>,
  eventName?: string,
  countryPolicy?: CountryActionPolicy,
  kbBySourceEventTarget?: ReadonlyMap<string, KnowledgeEntry>
): string[] {
  const resolvedEventName = eventName?.trim() || resolveEventName(source, target, terminalStates, kb);
  const resolved = resolveTransitionDefinition({
    countryCode,
    direction,
    source,
    target,
    eventName: resolvedEventName,
    isTerminal: terminalStates.has(target),
    policy: countryPolicy ?? getCountryPolicy(countryCode),
    semantic: inferTransitionSemantic(source, resolvedEventName, target),
    knowledgeBySourceTarget: kb,
    knowledgeBySourceEventTarget: kbBySourceEventTarget
  });

  return [...resolved.actions];
}

export function selectStartState(
  sequences: readonly string[][],
  allStates?: ReadonlySet<string> | readonly string[]
): string {
  const includesInit =
    allStates instanceof Set ? allStates.has('Init') : Array.isArray(allStates) ? allStates.includes('Init') : false;
  if (includesInit) {
    return 'Init';
  }

  const counts = new Map<string, number>();

  sequences.forEach((sequence) => {
    const firstState = sequence[0];
    if (!firstState) {
      return;
    }
    counts.set(firstState, (counts.get(firstState) ?? 0) + 1);
  });

  return (
    [...counts.entries()].sort((left, right) => {
      const countCompare = right[1] - left[1];
      if (countCompare !== 0) {
        return countCompare;
      }
      return left[0].localeCompare(right[0]);
    })[0]?.[0] ?? 'Init'
  );
}

function buildTerminalStatesForValidation(
  spec: WorkflowSpec,
  additionalTerminals: ReadonlySet<string>
): Set<string> {
  const terminalStates = new Set<string>(additionalTerminals);

  spec.states.forEach((state) => {
    if (Object.keys(state.onEvent ?? {}).length === 0) {
      terminalStates.add(state.name);
    }
  });

  return terminalStates;
}

function normalizeMessageParts(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function formatAnalysisConflicts(
  conflicts: ReadonlyArray<{ code: string; message: string; details?: readonly string[] }>
): string {
  return [...conflicts]
    .sort((left, right) => {
      const codeCompare = left.code.localeCompare(right.code);
      if (codeCompare !== 0) {
        return codeCompare;
      }
      const messageCompare = left.message.localeCompare(right.message);
      if (messageCompare !== 0) {
        return messageCompare;
      }
      return normalizeMessageParts(left.details).join('|').localeCompare(normalizeMessageParts(right.details).join('|'));
    })
    .map((conflict) => {
      const details = normalizeMessageParts(conflict.details);
      return `${conflict.code}: ${conflict.message}${details.length ? ` (${details.join(', ')})` : ''}`;
    })
    .join(' | ');
}

function formatLintErrors(lint: WorkflowLintResult): string {
  return [...new Set(lint.errors.map((issue) => issue.message.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .join(' | ');
}

function formatGraphValidationErrors(graphValidation: GraphValidationReport): string {
  return graphValidation.issues
    .filter((issue) => issue.severity === 'ERROR')
    .sort((left, right) => {
      const codeCompare = left.code.localeCompare(right.code);
      if (codeCompare !== 0) {
        return codeCompare;
      }
      const messageCompare = left.message.localeCompare(right.message);
      if (messageCompare !== 0) {
        return messageCompare;
      }
      return normalizeMessageParts(left.details).join('|').localeCompare(normalizeMessageParts(right.details).join('|'));
    })
    .map((issue) => {
      const details = normalizeMessageParts(issue.details);
      return `${issue.code}: ${issue.message}${details.length ? ` (${details.join(', ')})` : ''}`;
    })
    .join(' | ');
}

function formatScenarioReplayFailures(scenarioReplay: ScenarioReplayReport): string {
  return scenarioReplay.results
    .filter((result) => !result.matched)
    .sort((left, right) => {
      const scenarioCompare = left.scenarioName.localeCompare(right.scenarioName);
      if (scenarioCompare !== 0) {
        return scenarioCompare;
      }
      return left.subFlowTitle.localeCompare(right.subFlowTitle);
    })
    .map((result) => {
      const details = normalizeMessageParts([
        ...result.missingTransitions,
        ...result.unexpectedStates.map((stateName) => `missing-state:${stateName}`)
      ]);
      return `${result.scenarioName} / ${result.subFlowTitle}: ${details.join(', ')}`;
    })
    .join(' | ');
}

function createFsmGenerationError(message: string, details: FsmGenerationErrorDetails): Error {
  return Object.assign(new Error(message), details);
}

export function previewConversion(
  scenarios: readonly ScenarioCategory[],
  analysisOptions?: {
    includeAnalysisSummary?: boolean;
    countryCode?: string;
    direction?: DirectionInput;
    options?: StateResolutionOptions;
  }
): {
  discoveredStateCount: number;
  scenarioCount: number;
  totalRows: number;
  topArchetype?: string;
  warningCount?: number;
  conflictCount?: number;
} {
  const base = {
    discoveredStateCount: discoverStates(scenarios, analysisOptions?.options).size,
    scenarioCount: scenarios.length,
    totalRows: countRows(scenarios)
  };

  if (!analysisOptions?.includeAnalysisSummary) {
    return base;
  }

  const analysis = analyzeScenarios(
    scenarios,
    analysisOptions.countryCode,
    analysisOptions.direction,
    analysisOptions.options
  );

  return {
    ...base,
    topArchetype: analysis.archetypeMatches[0]?.archetype,
    warningCount: analysis.warnings.length,
    conflictCount: analysis.conflicts.length
  };
}

export function scenariosToWorkflowSpec(
  scenarios: readonly ScenarioCategory[],
  presetSpec: WorkflowSpec | null | undefined = null,
  allPresets: readonly WorkflowSpec[] = [],
  workflowKey?: string,
  countryCode?: string,
  direction?: 'INCOMING' | 'OUTGOING' | 'I' | 'O',
  options?: FsmGenerationOptions
): FsmGenerationResult {
  const normalizedDirection = normalizeDirection(direction);
  const normalizedCountryCode = countryCode?.trim().toUpperCase() ?? '';
  const countryPolicy = getCountryPolicy(normalizedCountryCode);
  const resolvedOptions = mergeGenerationOptionsWithCountryPolicy(countryPolicy, options);
  const analysis = analyzeScenarios(scenarios, normalizedCountryCode, direction, resolvedOptions);
  const blockingConflicts = analysis.conflicts.filter((conflict) => conflict.severity === 'ERROR');
  if (blockingConflicts.length > 0) {
    throw createFsmGenerationError(`FSM analysis failed: ${formatAnalysisConflicts(blockingConflicts)}`, {
      analysis
    });
  }

  const sequences = analysis.rawSequences;
  const discovered = analysis.discoveredStates;
  const prunedTransitions = analysis.prunedTransitions;
  const terminalStates = detectTerminalStates(prunedTransitions, sequences, discovered);
  const presetKnowledge = filterPresetKnowledgeByCountryAndDirection(
    presetSpec ? [presetSpec, ...allPresets] : [...allPresets],
    normalizedCountryCode,
    normalizedDirection
  );
  const kb = buildKnowledgeBase(presetKnowledge);
  const kbBySourceEventTarget = buildSourceEventTargetKnowledgeBase(presetKnowledge);
  const expandedTransitions = createExpandedTransitions(presetSpec);
  const newTransitions = new Set<string>();
  const presetBackedTransitionKeys = new Set<string>();
  const fallbackTransitionKeys = new Set<string>();

  discovered.forEach((stateName) => ensureExpandedState(expandedTransitions, stateName));

  const ctx: ExpansionContext = {
    discovered,
    prunedTransitions,
    sequences,
    kb,
    kbBySourceEventTarget,
    countryCode: normalizedCountryCode,
    direction: normalizedDirection,
    countryPolicy,
    topArchetype: analysis.archetypeMatches[0]?.archetype,
    inferredTargets: { ...analysis.inferredTargets },
    additionalTerminals: new Set<string>(analysis.additionalTerminals),
    expandedTransitions,
    newTransitions,
    presetBackedTransitionKeys,
    fallbackTransitionKeys,
    terminalStates: new Set([...terminalStates, ...analysis.additionalTerminals])
  };

  if (!resolvedOptions?.skipObservedTransitions) {
    [...prunedTransitions.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([source, targets]) => {
        [...targets]
          .sort((left, right) => left.localeCompare(right))
          .forEach((target) => {
            const resolvedEventName = resolveEventName(source, target, ctx.terminalStates, ctx.kb);
            const resolvedTransition = resolveTransitionDefinition({
              countryCode: normalizedCountryCode,
              direction: normalizedDirection,
              source,
              target,
              eventName: resolvedEventName,
              isTerminal: ctx.terminalStates.has(target),
              policy: ctx.countryPolicy,
              semantic: inferTransitionSemantic(source, resolvedEventName, target),
              knowledgeBySourceTarget: ctx.kb,
              knowledgeBySourceEventTarget: ctx.kbBySourceEventTarget
            });
            addTx(
              ctx,
              source,
              resolvedTransition.eventName,
              target,
              resolvedTransition.actions,
              resolvedTransition.sourceKind === 'preset' ? 'preset' : 'fallback'
            );
          });
      });
  }

  selectExpansionRules(resolvedOptions)
    .filter((rule) => rule.triggers(ctx))
    .forEach((rule) => rule.apply(ctx));

  const hasPresetBase = Boolean(presetSpec?.states.length);
  const presetStateOrder = hasPresetBase
    ? presetSpec?.states
        .map((state) => state.name.trim())
        .filter((stateName, index, values) => Boolean(stateName) && values.indexOf(stateName) === index) ?? []
    : [];
  const presetRetainedStates = new Set<string>(
    hasPresetBase ? presetStateOrder.filter((stateName) => !analysis.discoveredStates.has(stateName)) : []
  );
  const allStateNames = [...ctx.expandedTransitions.keys()];
  const fallbackStartState = selectStartState(sequences, allStateNames);
  const preservedStartState = presetSpec?.startState?.trim();
  const resolvedGeneratedStartState = allStateNames.includes(fallbackStartState)
    ? fallbackStartState
    : allStateNames[0] ?? fallbackStartState;
  const startState =
    resolvedGeneratedStartState === 'Init' && allStateNames.includes('Init')
      ? 'Init'
      : hasPresetBase && preservedStartState && allStateNames.includes(preservedStartState)
        ? preservedStartState
        : resolvedGeneratedStartState;

  ensureExpandedState(ctx.expandedTransitions, startState);

  const specBase: WorkflowSpec = {
    workflowKey: resolveWorkflowKey(workflowKey, normalizedCountryCode, normalizedDirection),
    statesClass: hasPresetBase ? presetSpec?.statesClass ?? DEFAULT_STATES_CLASS : DEFAULT_STATES_CLASS,
    eventsClass: hasPresetBase ? presetSpec?.eventsClass ?? DEFAULT_EVENTS_CLASS : DEFAULT_EVENTS_CLASS,
    startState,
    states: [...ctx.expandedTransitions.keys()].map((stateName) => buildStateSpec(stateName, ctx.expandedTransitions))
  };
  const spec: WorkflowSpec = {
    ...specBase,
    states: orderWorkflowStates(specBase, { sortWithinGroups: true })
  };

  const lint = lintWorkflowSpec(spec);
  const validationAllowedStates = new Set<string>(presetRetainedStates);
  if (resolvedOptions?.enabledRuleIds?.length || resolvedOptions?.disabledRuleIds?.length) {
    spec.states.forEach((state) => {
      if (state.name !== startState && !analysis.discoveredStates.has(state.name)) {
        validationAllowedStates.add(state.name);
      }
    });
  }
  const graphValidation = validateGeneratedWorkflow(spec, {
    analysis,
    terminalStates: buildTerminalStatesForValidation(spec, analysis.additionalTerminals),
    presetRetainedStates: validationAllowedStates
  });
  const scenarioReplay = replayScenariosAgainstWorkflow(scenarios, spec, {
    preFsmRejections: resolvedOptions?.preFsmRejections,
    customDirectMap: resolvedOptions?.customDirectMap
  });

  const failureMessages: string[] = [];
  if (lint.errors.length > 0) {
    failureMessages.push(`lint: ${formatLintErrors(lint)}`);
  }
  if (graphValidation.hasErrors) {
    failureMessages.push(`graph: ${formatGraphValidationErrors(graphValidation)}`);
  }
  if (scenarioReplay.failedCount > 0) {
    failureMessages.push(`replay: ${formatScenarioReplayFailures(scenarioReplay)}`);
  }

  if (failureMessages.length > 0) {
    throw createFsmGenerationError(`FSM validation failed: ${failureMessages.join(' | ')}`, {
      spec,
      newTransitions,
      lint,
      analysis,
      graphValidation,
      scenarioReplay,
      presetBackedTransitionKeys,
      fallbackTransitionKeys
    });
  }

  return {
    spec,
    newTransitions,
    lint,
    analysis,
    graphValidation,
    scenarioReplay,
    presetBackedTransitionKeys,
    fallbackTransitionKeys
  };
}

export { analyzeScenarios };


