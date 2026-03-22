import type { CountryActionContext, CountryActionPolicy } from './types';

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

function ack(direction: CountryActionContext['direction']): string {
  return `notify-client-final-ack-${direction}`;
}

function nack(direction: CountryActionContext['direction']): string {
  return `notify-client-final-nack-${direction}`;
}

function reverse(direction: CountryActionContext['direction']): string {
  return `reverse-${direction}-payment`;
}

function ccToken(countryCode: string): string {
  const normalized = countryCode.trim().toLowerCase();
  return normalized || 'generic';
}

function genericProcessAction(target: string, countryCode: string, direction: CountryActionContext['direction']): string {
  return `process-${toKebabCase(target)}-${ccToken(countryCode)}-${direction}`;
}

function buildGenericFallbackActions(ctx: CountryActionContext): string[] {
  const primaryAction = genericProcessAction(ctx.target, ctx.countryCode, ctx.direction);
  if (ctx.isTerminal) {
    return [primaryAction, 'persist-txn', 'notify-bd-final'];
  }

  return [primaryAction, 'persist-txn', 'notify-bd-intermediate'];
}

function buildRetryActions(ctx: CountryActionContext): string[] {
  if (ctx.source === 'SanctionsRespRepair') {
    return ['reset-mtp', 'send-sanctions-request', 'persist-txn', 'notify-bd-intermediate'];
  }

  if (ctx.source === 'SpmSent' || ctx.source === 'SpmError' || ctx.source === 'SpmFailed') {
    return ['reset-mtp', 'do-pre-sanctions-enrichment', 'persist-txn'];
  }

  if (ctx.target === 'SanctionsSent') {
    return ['reset-mtp', 'send-sanctions-request', 'persist-txn'];
  }

  return ['reset-mtp', ...buildGenericFallbackActions(ctx)];
}

function buildSanctionsResponseActions(ctx: CountryActionContext): string[] {
  if (ctx.source === 'OfacPossibleHit') {
    return ['process-sanctions-final-response'];
  }

  return ['process-sanctions-response'];
}

function buildSanctionsExceptionActions(ctx: CountryActionContext): string[] {
  if (ctx.source === 'OfacPossibleHit' && ctx.target === 'OfacPossibleHit') {
    return ['process-sanctions-error', 'notify-bd-error'];
  }

  return ['process-sanctions-error', 'persist-txn'];
}

function buildClearingResponseAcccActions(ctx: CountryActionContext): string[] {
  return ctx.isTerminal
    ? [ack(ctx.direction), 'persist-txn', 'notify-bd-final']
    : [ack(ctx.direction), 'persist-txn', 'notify-bd-intermediate'];
}

function buildClearingResponseRjctActions(ctx: CountryActionContext): string[] {
  return ctx.isTerminal
    ? [nack(ctx.direction), reverse(ctx.direction), 'persist-txn', 'notify-bd-final']
    : [nack(ctx.direction), reverse(ctx.direction), 'persist-txn', 'notify-bd-intermediate'];
}

function buildPostingSuccessActions(ctx: CountryActionContext): string[] {
  if (ctx.target === 'SendClearingPostingComplete') {
    return ['process-normal-outgoing-posting-success', 'persist-txn'];
  }

  if (ctx.target === 'ClearingRejectPostingComplete') {
    return ['persist-txn', 'notify-bd-final'];
  }

  return ['process-normal-outgoing-posting-success', 'persist-txn', 'notify-bd-final'];
}

function buildPostingFailureActions(ctx: CountryActionContext): string[] {
  return [`process-posting-error-${ccToken(ctx.countryCode)}-${ctx.direction}`];
}

export const defaultCountryPolicy: CountryActionPolicy = {
  countryCode: 'DEFAULT',
  semanticActionBuilders: {
    DUP_CHECK_COMPLETED: () => ['on-dup-check-completed'],
    DUP_CHECK_PASSED: (ctx) => [
      'on-dup-check-passed',
      'do-spm-check',
      `notify-proxy-svc-${ccToken(ctx.countryCode)}-${ctx.direction}`
    ],
    DUP_CHECK_FAILED: (ctx) => ['on-dup-check-failed', nack(ctx.direction), 'persist-txn', 'notify-bd-error'],
    SPM_ENABLED: () => ['do-pre-sanctions-enrichment', 'persist-txn'],
    SPM_DISABLED: () => ['send-sanctions-request', 'persist-txn', 'notify-bd-intermediate'],
    SPM_ENRICHMENT_SUCCESS: () => ['save-spm-result', 'process-spm-result'],
    SPM_ENRICHMENT_ERROR: () => ['save-spm-error-result', 'persist-txn', 'notify-bd-error'],
    SPM_ENRICHMENT_FAILED: () => ['save-spm-failed-result', 'persist-txn', 'notify-bd-error'],
    RETRY: (ctx) => buildRetryActions(ctx),
    SKIP_SANCTIONS: () => ['do-balance-check', 'persist-txn', 'notify-bd-intermediate'],
    NEED_SANCTIONS: () => ['send-sanctions-request', 'persist-txn', 'notify-bd-intermediate'],
    SANCTIONS_RESPONSE_RECEIVED: (ctx) => buildSanctionsResponseActions(ctx),
    SANCTIONS_NO_HIT: () => ['do-balance-check', 'persist-txn', 'notify-bd-intermediate'],
    SANCTIONS_OFAC_POSSIBLE_HIT: () => ['persist-txn', 'notify-bd-intermediate'],
    SANCTIONS_EXCEPTION: (ctx) => buildSanctionsExceptionActions(ctx),
    SANCTIONS_FALSE_MATCH: (ctx) => [
      `process-false-match-${ccToken(ctx.countryCode)}-${ctx.direction}`,
      'do-balance-check',
      'persist-txn',
      'notify-bd-intermediate'
    ],
    SANCTIONS_REJECT: (ctx) => ['do-sanctions-reject', nack(ctx.direction), 'persist-txn', 'notify-bd-final'],
    SANCTIONS_SEIZE: (ctx) => ['do-sanctions-seize', nack(ctx.direction), 'persist-txn', 'notify-bd-final'],
    SANCTIONS_CANCEL: (ctx) => ['do-sanctions-cancel', nack(ctx.direction), 'persist-txn', 'notify-bd-final'],
    BALANCE_CHECK_RESULT: (ctx) => [`process-balance-check-result-${ccToken(ctx.countryCode)}-${ctx.direction}`],
    SEND_TO_CLEARING_AND_POST: (ctx) => [
      `send-to-clearing-for-${ccToken(ctx.countryCode)}-${ctx.direction}`,
      'do-normal-outgoing-posting',
      'persist-txn',
      'notify-bd-intermediate'
    ],
    NOTIFY_B2B_AND_POST: (ctx) => [
      ack(ctx.direction),
      `notify-b2b-to-clearing-for-${ccToken(ctx.countryCode)}-${ctx.direction}`,
      'do-normal-b2b-posting',
      'persist-txn',
      'notify-bd-intermediate'
    ],
    BALANCE_CHECK_NSF: (ctx) => [nack(ctx.direction), 'persist-txn', 'notify-bd-error'],
    BALANCE_CHECK_GLS_ERROR: (ctx) => [nack(ctx.direction), 'persist-txn', 'notify-bd-error'],
    CLEARING_RESPONSE_RECEIVED: (ctx) => [`process-clearing-response-${ccToken(ctx.countryCode)}-${ctx.direction}`],
    CLEARING_RESPONSE_ACCC: (ctx) => buildClearingResponseAcccActions(ctx),
    CLEARING_RESPONSE_RJCT: (ctx) => buildClearingResponseRjctActions(ctx),
    POSTING_SUCCESS: (ctx) => buildPostingSuccessActions(ctx),
    POSTING_FAILURE: (ctx) => buildPostingFailureActions(ctx),
    POSTING_FAILURE_RECOVERABLE: () => ['persist-txn'],
    WAREHOUSE_RELEASE: () => ['release-from-warehouse', 'persist-txn', 'notify-bd-intermediate'],
    WAREHOUSE_CANCEL: (ctx) => ['cancel-warehoused-payment', nack(ctx.direction), 'persist-txn', 'notify-bd-final']
  }
};

export function getDefaultSemanticActions(ctx: CountryActionContext): string[] | null {
  const builder = defaultCountryPolicy.semanticActionBuilders?.[ctx.semantic];
  if (!builder) {
    return null;
  }

  const actions = normalizeActions(builder(ctx));
  return actions.length > 0 ? actions : null;
}

export function getGenericFallbackActions(ctx: CountryActionContext): string[] {
  return normalizeActions(buildGenericFallbackActions(ctx));
}
