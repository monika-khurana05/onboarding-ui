import type { NormalizedRow, SemanticTag } from './types';

const FAILURE_STATES = new Set([
  'SanctionsReject',
  'SanctionsCancelled',
  'SanctionsSeized',
  'ClearingRejectPostingComplete',
  'TxnRejectedOnNSF',
  'TxnRejectedOnGLSTechError',
  'WarehousedCancelled'
]);

const SANCTIONS_STATES = new Set([
  'SanctionsSent',
  'OfacPossibleHit',
  'SanctionsReject',
  'SanctionsCancelled',
  'SanctionsSeized',
  'SanctionsRespRepair'
]);

const CLEARING_STATES = new Set([
  'SendClearingPostingPending',
  'SendClearingPostingComplete',
  'ClrRejectedOrgPostingPending',
  'ClearingRejectPostingComplete',
  'IncomingClearingReceived'
]);

const POSTING_STATES = new Set([
  'NormalPostingPending',
  'FinalPostingComplete',
  'SendClearingPostingPending',
  'SendClearingPostingComplete',
  'ClrRejectedOrgPostingPending',
  'ClearingRejectPostingComplete'
]);

const TAG_ORDER: readonly SemanticTag[] = [
  'PRE_FSM_REJECTION',
  'INIT_ENTRY',
  'SPM_LIFECYCLE',
  'SANCTIONS_LIFECYCLE',
  'BALANCE_CHECK',
  'CLEARING_PHASE',
  'POSTING_PHASE',
  'WAREHOUSE_PARK',
  'WAREHOUSE_RELEASE',
  'FINAL_SUCCESS',
  'FINAL_FAILURE',
  'CLIENT_NACK',
  'REVERSAL_REQUIRED',
  'BOOK_TRANSFER',
  'INCOMING_FLOW',
  'OUTGOING_FLOW',
  'UNKNOWN'
];

type ClassifyOptions = {
  direction: 'incoming' | 'outgoing';
  isPreFsmRejection: boolean;
};

function hasBookEvidence(row: NormalizedRow): boolean {
  return [row.sourceScenarioName, row.sourceSubFlowTitle, row.scenario ?? ''].some((value) => /\bBOOK\b/i.test(value));
}

export function classifyNormalizedRow(row: NormalizedRow, options: ClassifyOptions): SemanticTag[] {
  const tags = new Set<SemanticTag>();
  const resolvedState = row.resolvedState ?? '';

  if (options.direction === 'incoming') {
    tags.add('INCOMING_FLOW');
  } else {
    tags.add('OUTGOING_FLOW');
  }

  if (options.isPreFsmRejection) {
    tags.add('PRE_FSM_REJECTION');
    tags.add('FINAL_FAILURE');
    tags.add('CLIENT_NACK');
  }

  if (resolvedState === 'Init' || row.msgSubStatus === 'VALIDATED' || row.msgSubStatus === 'RECEIVED_FOR_PROCESSING') {
    tags.add('INIT_ENTRY');
  }

  if (row.msgSubStatus.startsWith('SPM_') || resolvedState === 'SpmSent' || resolvedState === 'SpmError' || resolvedState === 'SpmFailed') {
    tags.add('SPM_LIFECYCLE');
  }

  if (row.msgSubStatus.includes('SANCTION') || row.msgSubStatus.includes('OFAC') || SANCTIONS_STATES.has(resolvedState)) {
    tags.add('SANCTIONS_LIFECYCLE');
  }

  if (row.msgSubStatus === 'BALANCE_CHECK_PENDING' || resolvedState === 'BalanceCheckPending') {
    tags.add('BALANCE_CHECK');
  }

  if (CLEARING_STATES.has(resolvedState) || row.msgStatus === 'SENT_TO_CLEARING' || row.msgSubStatus.includes('CLEARING')) {
    tags.add('CLEARING_PHASE');
  }

  if (POSTING_STATES.has(resolvedState) || row.msgSubStatus.includes('POSTING')) {
    tags.add('POSTING_PHASE');
  }

  if (resolvedState === 'Warehoused' || row.msgSubStatus === 'WAREHOUSED') {
    tags.add('WAREHOUSE_PARK');
  }

  if (resolvedState === 'FinalPostingComplete') {
    tags.add('FINAL_SUCCESS');
  }

  if (row.msgStatus === 'REJECTED' || FAILURE_STATES.has(resolvedState)) {
    tags.add('FINAL_FAILURE');
  }

  if (row.msgStatus === 'REJECTED' || options.isPreFsmRejection || row.triggerReversal) {
    tags.add('CLIENT_NACK');
  }

  if (
    row.triggerReversal ||
    resolvedState === 'ClrRejectedOrgPostingPending' ||
    resolvedState === 'ClearingRejectPostingComplete' ||
    row.transactionStatusReason.includes('RJCT')
  ) {
    tags.add('REVERSAL_REQUIRED');
  }

  if (hasBookEvidence(row)) {
    tags.add('BOOK_TRANSFER');
  }

  const hasSpecificTag = [...tags].some((tag) => tag !== 'INCOMING_FLOW' && tag !== 'OUTGOING_FLOW');
  if (!hasSpecificTag) {
    tags.add('UNKNOWN');
  }

  return TAG_ORDER.filter((tag) => tags.has(tag));
}

export function withSemanticTag(row: NormalizedRow, tag: SemanticTag): NormalizedRow {
  const tagSet = new Set(row.semanticTags);
  tagSet.delete('UNKNOWN');
  tagSet.add(tag);
  return {
    ...row,
    semanticTags: TAG_ORDER.filter((entry) => tagSet.has(entry))
  };
}
