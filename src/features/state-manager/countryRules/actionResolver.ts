import { defaultCountryPolicy, getDefaultSemanticActions, getGenericFallbackActions } from './defaultCountryPolicy';
import type {
  CountryActionContext,
  CountryActionPolicy,
  CountryTransitionOverride,
  NormalizedDirection,
  TransitionSemantic
} from './types';

export type ResolvedTransitionDefinition = {
  eventName: string;
  actions: string[];
  semantic: TransitionSemantic;
  sourceKind: 'preset' | 'countryOverride' | 'countrySemantic' | 'defaultSemantic' | 'genericFallback';
};

export type TransitionKnowledgeEntry = {
  eventName: string;
  actions: string[];
};

export type ResolveTransitionDefinitionInput = {
  countryCode: string;
  direction: NormalizedDirection;
  source: string;
  target: string;
  eventName: string;
  isTerminal: boolean;
  policy?: CountryActionPolicy;
  semantic?: TransitionSemantic;
  knowledgeBySourceTarget?: ReadonlyMap<string, TransitionKnowledgeEntry>;
  knowledgeBySourceEventTarget?: ReadonlyMap<string, TransitionKnowledgeEntry>;
};

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

function normalizeEventKey(eventName: string): string {
  return eventName.trim().toUpperCase();
}

export function buildKnowledgeLookupKey(source: string, target: string): string {
  return `${source.trim()}->${target.trim()}`;
}

export function buildExactKnowledgeLookupKey(source: string, eventName: string, target: string): string {
  return `${source.trim()}::${normalizeEventKey(eventName)}->${target.trim()}`;
}

export function buildTransitionOverrideKeys(source: string, eventName: string, target: string): string[] {
  const trimmedSource = source.trim();
  const trimmedTarget = target.trim();
  const trimmedEventName = eventName.trim();
  const normalizedEventName = normalizeEventKey(eventName);

  return [...new Set([
    `${trimmedSource}::${trimmedEventName}::${trimmedTarget}`,
    `${trimmedSource}::${normalizedEventName}::${trimmedTarget}`,
    `${trimmedSource}->${trimmedTarget}`
  ])];
}

function resolveTransitionOverride(
  transitionOverrides: Record<string, CountryTransitionOverride> | undefined,
  source: string,
  eventName: string,
  target: string
): CountryTransitionOverride | undefined {
  if (!transitionOverrides) {
    return undefined;
  }

  const keys = buildTransitionOverrideKeys(source, eventName, target);
  const matchedKey = keys.find((key) => transitionOverrides[key]);
  return matchedKey ? transitionOverrides[matchedKey] : undefined;
}

export function inferTransitionSemantic(source: string, eventName: string, target: string): TransitionSemantic {
  const normalizedSource = source.trim();
  const normalizedTarget = target.trim();
  const normalizedEventName = normalizeEventKey(eventName);

  switch (normalizedEventName) {
    case 'DUPCHECKCOMPLETED':
      return 'DUP_CHECK_COMPLETED';
    case 'DUPCHECKPASSED':
      return 'DUP_CHECK_PASSED';
    case 'DUPCHECKFAILED':
      return 'DUP_CHECK_FAILED';
    case 'SPMENABLED':
      return 'SPM_ENABLED';
    case 'SPMDISABLED':
      return 'SPM_DISABLED';
    case 'SPMENRICHMENTSUCCESSFUL':
      return 'SPM_ENRICHMENT_SUCCESS';
    case 'SPMENRICHMENTERROR':
      return 'SPM_ENRICHMENT_ERROR';
    case 'SPMENRICHMENTFAILED':
      return 'SPM_ENRICHMENT_FAILED';
    case 'ONRETRY':
      return 'RETRY';
    case 'SKIPSANCTIONS':
      return 'SKIP_SANCTIONS';
    case 'NEEDSANCTIONS':
      return 'NEED_SANCTIONS';
    case 'SANCTIONSRESPONSERECEIVED':
      return 'SANCTIONS_RESPONSE_RECEIVED';
    case 'SANCTIONSNOHIT':
      return 'SANCTIONS_NO_HIT';
    case 'SANCTIONSOFACPOSSIBLEHIT':
      return 'SANCTIONS_OFAC_POSSIBLE_HIT';
    case 'SANCTIONSEXCEPTION':
      return 'SANCTIONS_EXCEPTION';
    case 'SANCTIONSFALSEMATCH':
      return 'SANCTIONS_FALSE_MATCH';
    case 'SANCTIONSREJECTREPORT':
      return 'SANCTIONS_REJECT';
    case 'SANCTIONSBLOCKREPORT':
      return 'SANCTIONS_SEIZE';
    case 'SANCTIONSCANCELLED':
      return 'SANCTIONS_CANCEL';
    case 'BALANCECHECKRESULT':
      return 'BALANCE_CHECK_RESULT';
    case 'OUTGOINGSENDTOCLEARINGWITHACKANDPOSTING':
      return 'SEND_TO_CLEARING_AND_POST';
    case 'NOTIFYB2BTOCLEARINGANDPOSTING':
      return 'NOTIFY_B2B_AND_POST';
    case 'BALANCECHECKNSFERRORTIMEOUT':
      return 'BALANCE_CHECK_NSF';
    case 'BALANCECHECKGLSTECHERRORTIMEOUT':
      return 'BALANCE_CHECK_GLS_ERROR';
    case 'CLEARINGRESPONSERECEIVED':
      return 'CLEARING_RESPONSE_RECEIVED';
    case 'CLEARINGRESPONSEACCC':
      return 'CLEARING_RESPONSE_ACCC';
    case 'CLEARINGRESPONSERJCT':
      return 'CLEARING_RESPONSE_RJCT';
    case 'POSTINGSUCCESS':
      return 'POSTING_SUCCESS';
    case 'POSTINGFAILURE':
      return 'POSTING_FAILURE';
    case 'POSTINGFAILURERECOVERABLE':
      return 'POSTING_FAILURE_RECOVERABLE';
    case 'ONRELEASE':
      return normalizedSource === 'Warehoused' ? 'WAREHOUSE_RELEASE' : 'GENERIC_PROCESS';
    case 'ONCANCEL':
      return normalizedSource === 'Warehoused' ? 'WAREHOUSE_CANCEL' : 'GENERIC_PROCESS';
    default:
      break;
  }

  if (normalizedSource === 'Warehoused' && normalizedTarget === 'WarehousedCancelled') {
    return 'WAREHOUSE_CANCEL';
  }

  return 'GENERIC_PROCESS';
}

export function resolveTransitionDefinition(input: ResolveTransitionDefinitionInput): ResolvedTransitionDefinition {
  const policy = input.policy ?? defaultCountryPolicy;
  const exactKnowledge = input.knowledgeBySourceEventTarget?.get(
    buildExactKnowledgeLookupKey(input.source, input.eventName, input.target)
  );
  if (exactKnowledge) {
    return {
      eventName: exactKnowledge.eventName.trim(),
      actions: normalizeActions(exactKnowledge.actions),
      semantic: input.semantic ?? inferTransitionSemantic(input.source, exactKnowledge.eventName, input.target),
      sourceKind: 'preset'
    };
  }

  const knowledge = input.knowledgeBySourceTarget?.get(buildKnowledgeLookupKey(input.source, input.target));
  if (knowledge) {
    return {
      eventName: knowledge.eventName.trim(),
      actions: normalizeActions(knowledge.actions),
      semantic: input.semantic ?? inferTransitionSemantic(input.source, knowledge.eventName, input.target),
      sourceKind: 'preset'
    };
  }

  const override = resolveTransitionOverride(policy.transitionOverrides, input.source, input.eventName, input.target);
  const resolvedEventName = override?.eventName?.trim() || input.eventName.trim();
  const semantic = input.semantic ?? inferTransitionSemantic(input.source, resolvedEventName, input.target);

  if (override?.actions?.length) {
    return {
      eventName: resolvedEventName,
      actions: normalizeActions(override.actions),
      semantic,
      sourceKind: 'countryOverride'
    };
  }

  const actionContext: CountryActionContext = {
    countryCode: input.countryCode.trim().toUpperCase(),
    direction: input.direction,
    source: input.source.trim(),
    target: input.target.trim(),
    eventName: resolvedEventName,
    semantic,
    isTerminal: input.isTerminal
  };

  const countryBuilder = policy.semanticActionBuilders?.[semantic];
  if (countryBuilder) {
    const countryActions = normalizeActions(countryBuilder(actionContext));
    if (countryActions.length > 0) {
      return {
        eventName: resolvedEventName,
        actions: countryActions,
        semantic,
        sourceKind: 'countrySemantic'
      };
    }
  }

  const defaultActions = getDefaultSemanticActions(actionContext);
  if (defaultActions) {
    return {
      eventName: resolvedEventName,
      actions: defaultActions,
      semantic,
      sourceKind: 'defaultSemantic'
    };
  }

  return {
    eventName: resolvedEventName,
    actions: getGenericFallbackActions(actionContext),
    semantic,
    sourceKind: 'genericFallback'
  };
}
