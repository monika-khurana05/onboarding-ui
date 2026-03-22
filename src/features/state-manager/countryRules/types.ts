export type NormalizedDirection = 'incoming' | 'outgoing';

export type TransitionSemantic =
  | 'DUP_CHECK_COMPLETED'
  | 'DUP_CHECK_PASSED'
  | 'DUP_CHECK_FAILED'
  | 'SPM_ENABLED'
  | 'SPM_DISABLED'
  | 'SPM_ENRICHMENT_SUCCESS'
  | 'SPM_ENRICHMENT_ERROR'
  | 'SPM_ENRICHMENT_FAILED'
  | 'RETRY'
  | 'SKIP_SANCTIONS'
  | 'NEED_SANCTIONS'
  | 'SANCTIONS_RESPONSE_RECEIVED'
  | 'SANCTIONS_NO_HIT'
  | 'SANCTIONS_OFAC_POSSIBLE_HIT'
  | 'SANCTIONS_EXCEPTION'
  | 'SANCTIONS_FALSE_MATCH'
  | 'SANCTIONS_REJECT'
  | 'SANCTIONS_SEIZE'
  | 'SANCTIONS_CANCEL'
  | 'BALANCE_CHECK_RESULT'
  | 'SEND_TO_CLEARING_AND_POST'
  | 'NOTIFY_B2B_AND_POST'
  | 'BALANCE_CHECK_NSF'
  | 'BALANCE_CHECK_GLS_ERROR'
  | 'CLEARING_RESPONSE_RECEIVED'
  | 'CLEARING_RESPONSE_ACCC'
  | 'CLEARING_RESPONSE_RJCT'
  | 'POSTING_SUCCESS'
  | 'POSTING_FAILURE'
  | 'POSTING_FAILURE_RECOVERABLE'
  | 'WAREHOUSE_RELEASE'
  | 'WAREHOUSE_CANCEL'
  | 'GENERIC_PROCESS';

export type CountryTransitionOverride = {
  eventName?: string;
  actions?: string[];
};

export type CountryActionContext = {
  countryCode: string;
  direction: NormalizedDirection;
  source: string;
  target: string;
  eventName: string;
  semantic: TransitionSemantic;
  isTerminal: boolean;
};

export type CountryActionPolicy = {
  countryCode: string;
  enabledRuleIds?: string[];
  disabledRuleIds?: string[];
  preFsmRejections?: string[];
  directMapOverrides?: Record<string, string>;
  transitionOverrides?: Record<string, CountryTransitionOverride>;
  semanticActionBuilders?: Partial<Record<TransitionSemantic, (ctx: CountryActionContext) => string[]>>;
};
