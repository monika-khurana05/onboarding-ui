import type { FlowDirection } from '../types';

export type DirectionInput = FlowDirection | 'I' | 'O' | 'INCOMING' | 'OUTGOING' | null | undefined;

export type StateResolutionOptions = {
  preFsmRejections?: string[];
  customDirectMap?: Record<string, string>;
};

const FUTURE_DATED_SUBFLOW_PATTERN = /future[\s-]*dated/i;

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

export function normalizeToken(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function toPascalCase(value: string): string {
  return value
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

export function toKebabCase(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

export function normalizeActions(actions: readonly string[]): string[] {
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

export function normalizeDirection(direction?: DirectionInput): 'incoming' | 'outgoing' {
  const token = normalizeToken(direction ?? '');
  return token === 'INCOMING' || token === 'I' ? 'incoming' : 'outgoing';
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
