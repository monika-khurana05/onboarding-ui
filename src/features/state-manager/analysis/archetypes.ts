import type { FlowArchetype, FlowArchetypeMatch, NormalizedRow } from './types';

type ArchetypeInput = {
  normalizedRows: readonly NormalizedRow[];
  discoveredStates: ReadonlySet<string>;
  rawSequences: readonly string[][];
  lifecycleFlags: {
    hasSpm: boolean;
    hasSanctions: boolean;
    hasBalanceCheck: boolean;
    hasClearing: boolean;
    hasPosting: boolean;
    hasWarehousing: boolean;
    hasBookTransfer: boolean;
    hasIncomingFlow: boolean;
    hasOutgoingFlow: boolean;
  };
  inferredTargets: {
    nextAfterInit?: string;
    postSanctionsTarget?: string;
    balanceTarget?: string;
    warehousedReleaseTarget?: string;
  };
  direction: 'incoming' | 'outgoing';
};

type ScoreAccumulator = {
  score: number;
  reasons: string[];
};

function makeAccumulator(): ScoreAccumulator {
  return { score: 0, reasons: [] };
}

function addReason(acc: ScoreAccumulator, points: number, reason: string): void {
  if (points <= 0) {
    return;
  }
  acc.score += points;
  acc.reasons.push(reason);
}

function hasText(rows: readonly NormalizedRow[], pattern: RegExp): boolean {
  return rows.some((row) => pattern.test(`${row.sourceScenarioName} ${row.sourceSubFlowTitle} ${row.scenario ?? ''}`));
}

function countRowsWithTag(rows: readonly NormalizedRow[], tag: string): number {
  return rows.filter((row) => row.semanticTags.includes(tag as never)).length;
}

function countRowsWithReason(rows: readonly NormalizedRow[], pattern: RegExp): number {
  return rows.filter((row) => pattern.test(row.transactionStatusReason)).length;
}

function pushMatch(matches: FlowArchetypeMatch[], archetype: FlowArchetype, acc: ScoreAccumulator): void {
  if (acc.score <= 0) {
    return;
  }
  matches.push({
    archetype,
    score: Number(acc.score.toFixed(2)),
    reasons: [...acc.reasons]
  });
}

export function detectArchetypes(input: ArchetypeInput): FlowArchetypeMatch[] {
  const matches: FlowArchetypeMatch[] = [];
  const { discoveredStates, lifecycleFlags, normalizedRows, direction, inferredTargets } = input;

  const outgoingComplex = makeAccumulator();
  if (direction === 'outgoing') {
    addReason(outgoingComplex, 1, 'Outgoing direction selected.');
  }
  if (discoveredStates.has('Init')) {
    addReason(outgoingComplex, 1.5, 'Init state discovered.');
  }
  if (lifecycleFlags.hasSpm) {
    addReason(outgoingComplex, 2, 'SPM lifecycle evidence discovered.');
  }
  if (lifecycleFlags.hasSanctions) {
    addReason(outgoingComplex, 2, 'Sanctions lifecycle evidence discovered.');
  }
  if (lifecycleFlags.hasBalanceCheck) {
    addReason(outgoingComplex, 1.5, 'Balance-check evidence discovered.');
  }
  if (discoveredStates.has('SendClearingPostingPending') || discoveredStates.has('SendClearingPostingComplete')) {
    addReason(outgoingComplex, 1.5, 'Clearing-posting states discovered.');
  }
  if (discoveredStates.has('FinalPostingComplete')) {
    addReason(outgoingComplex, 1, 'Final posting completion discovered.');
  }
  pushMatch(matches, 'OUTGOING_SPM_SANCTIONS_BALANCE_CLEARING', outgoingComplex);

  const simplePosting = makeAccumulator();
  if (direction === 'outgoing') {
    addReason(simplePosting, 1, 'Outgoing direction selected.');
  }
  if (discoveredStates.has('Init')) {
    addReason(simplePosting, 1.5, 'Init state discovered.');
  }
  if (discoveredStates.has('BalanceCheckPending') || discoveredStates.has('NormalPostingPending')) {
    addReason(simplePosting, 2, 'Posting-path states discovered.');
  }
  if (discoveredStates.has('FinalPostingComplete')) {
    addReason(simplePosting, 1.5, 'Final posting completion discovered.');
  }
  if (!lifecycleFlags.hasSanctions) {
    addReason(simplePosting, 1, 'No sanctions lifecycle evidence was found.');
  }
  if (!discoveredStates.has('SendClearingPostingPending') && !discoveredStates.has('SendClearingPostingComplete')) {
    addReason(simplePosting, 1, 'No clearing-posting states were found.');
  }
  pushMatch(matches, 'OUTGOING_SIMPLE_POSTING', simplePosting);

  const bookTransfer = makeAccumulator();
  if (direction === 'outgoing') {
    addReason(bookTransfer, 1, 'Outgoing direction selected.');
  }
  if (lifecycleFlags.hasBookTransfer) {
    addReason(bookTransfer, 2.5, 'Scenario or subflow text contains BOOK.');
  }
  if (lifecycleFlags.hasPosting) {
    addReason(bookTransfer, 1.5, 'Posting lifecycle evidence discovered.');
  }
  pushMatch(matches, 'OUTGOING_BOOK_TRANSFER', bookTransfer);

  const clearingReject = makeAccumulator();
  if (discoveredStates.has('ClrRejectedOrgPostingPending')) {
    addReason(clearingReject, 2.5, 'Clearing rejection posting-pending state discovered.');
  }
  if (discoveredStates.has('ClearingRejectPostingComplete')) {
    addReason(clearingReject, 2.5, 'Clearing rejection completion state discovered.');
  }
  const rejectReasonCount = countRowsWithReason(normalizedRows, /RJCT|REJECT/i);
  if (rejectReasonCount > 0) {
    addReason(clearingReject, 1, `Rows include rejection reasons (${rejectReasonCount}).`);
  }
  if (hasText(normalizedRows, /clearing\s+reject|rjct/i)) {
    addReason(clearingReject, 1, 'Scenario text references clearing rejection.');
  }
  pushMatch(matches, 'OUTGOING_CLEARING_REJECTION', clearingReject);

  const incomingClearing = makeAccumulator();
  if (direction === 'incoming') {
    addReason(incomingClearing, 1.5, 'Incoming direction selected.');
  }
  if (discoveredStates.has('IncomingClearingReceived')) {
    addReason(incomingClearing, 3, 'IncomingClearingReceived state discovered.');
  }
  if (discoveredStates.has('NormalPostingPending')) {
    addReason(incomingClearing, 1, 'Posting continuation discovered.');
  }
  if (discoveredStates.has('FinalPostingComplete')) {
    addReason(incomingClearing, 1, 'Immediate posted-complete target discovered.');
  }
  pushMatch(matches, 'INCOMING_CLEARING_THEN_POSTING', incomingClearing);

  const warehoused = makeAccumulator();
  if (lifecycleFlags.hasWarehousing) {
    addReason(warehoused, 2.5, 'Warehoused state discovered.');
  }
  if (countRowsWithTag(normalizedRows, 'WAREHOUSE_RELEASE') > 0) {
    addReason(warehoused, 1.5, 'Observed rows continue after Warehoused.');
  }
  if (inferredTargets.warehousedReleaseTarget) {
    addReason(warehoused, 1, `Release target inferred as ${inferredTargets.warehousedReleaseTarget}.`);
  }
  pushMatch(matches, 'WAREHOUSED_RELEASE_FLOW', warehoused);

  const stopPayment = makeAccumulator();
  if (hasText(normalizedRows, /stop\s*payment|stop\s*recall/i)) {
    addReason(stopPayment, 2, 'Scenario text references stop-payment or recall handling.');
  }
  if (discoveredStates.has('SanctionsCancelled') || normalizedRows.some((row) => row.msgSubStatus === 'STOP_RECALL_REQUEST')) {
    addReason(stopPayment, 2, 'Stop-payment style cancellation evidence discovered.');
  }
  pushMatch(matches, 'STOP_PAYMENT_FLOW', stopPayment);

  const validationFailure = makeAccumulator();
  const preFsmRejectCount = countRowsWithTag(normalizedRows, 'PRE_FSM_REJECTION');
  if (preFsmRejectCount > 0) {
    addReason(validationFailure, Math.min(4, preFsmRejectCount), `Pre-FSM rejection rows discovered (${preFsmRejectCount}).`);
  }
  pushMatch(matches, 'BUSINESS_VALIDATION_FAILURE', validationFailure);

  return matches.sort((left, right) => {
    const scoreCompare = right.score - left.score;
    if (scoreCompare !== 0) {
      return scoreCompare;
    }
    return left.archetype.localeCompare(right.archetype);
  });
}
