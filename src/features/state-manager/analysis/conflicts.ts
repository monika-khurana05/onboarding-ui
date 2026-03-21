import type { AnalysisConflict, FlowArchetypeMatch, NormalizedRow } from './types';

type LifecycleFlags = {
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

type ConflictInput = {
  normalizedRows: readonly NormalizedRow[];
  rawSequences: readonly string[][];
  discoveredStates: ReadonlySet<string>;
  lifecycleFlags: LifecycleFlags;
  inferredTargets: {
    nextAfterInit?: string;
    postSanctionsTarget?: string;
    balanceTarget?: string;
    warehousedReleaseTarget?: string;
  };
  archetypeMatches: readonly FlowArchetypeMatch[];
  direction: 'incoming' | 'outgoing';
  seedConflicts?: readonly AnalysisConflict[];
  seedWarnings?: readonly AnalysisConflict[];
};

function normalizeDetails(details: readonly string[] | undefined): string[] | undefined {
  if (!details?.length) {
    return undefined;
  }

  return [...new Set(details.map((detail) => detail.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function dedupeConflicts(items: readonly AnalysisConflict[]): AnalysisConflict[] {
  const map = new Map<string, AnalysisConflict>();
  items.forEach((item) => {
    const normalizedItem: AnalysisConflict = {
      ...item,
      ...(item.details?.length ? { details: normalizeDetails(item.details) } : {})
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

function countImmediateFollowers(sequences: readonly string[][], sourceState: string, targetState: string): number {
  let count = 0;
  sequences.forEach((sequence) => {
    for (let index = 0; index < sequence.length - 1; index += 1) {
      if (sequence[index] === sourceState && sequence[index + 1] === targetState) {
        count += 1;
      }
    }
  });
  return count;
}

function countIncomingEvidence(rows: readonly NormalizedRow[]): number {
  return rows.filter(
    (row) =>
      row.resolvedState === 'IncomingClearingReceived' ||
      row.msgSubStatus.includes('INCOMING') ||
      /\bincoming\b/i.test(`${row.sourceScenarioName} ${row.sourceSubFlowTitle} ${row.scenario ?? ''}`)
  ).length;
}

function countOutgoingEvidence(rows: readonly NormalizedRow[]): number {
  return rows.filter(
    (row) =>
      row.msgStatus === 'SENT_TO_CLEARING' ||
      row.msgSubStatus.includes('CLEARING_INFORMED') ||
      row.resolvedState === 'SendClearingPostingPending' ||
      row.resolvedState === 'SendClearingPostingComplete'
  ).length;
}

export function detectConflicts(input: ConflictInput): {
  conflicts: AnalysisConflict[];
  warnings: AnalysisConflict[];
} {
  const conflicts: AnalysisConflict[] = [...(input.seedConflicts ?? [])];
  const warnings: AnalysisConflict[] = [...(input.seedWarnings ?? [])];

  const normalFollowers = countImmediateFollowers(input.rawSequences, 'BalanceCheckPending', 'NormalPostingPending');
  const clearingFollowers = countImmediateFollowers(input.rawSequences, 'BalanceCheckPending', 'SendClearingPostingPending');
  if (normalFollowers > 0 && normalFollowers === clearingFollowers) {
    conflicts.push({
      code: 'BALANCE_TARGET_AMBIGUOUS',
      severity: 'ERROR',
      message: 'Balance-check transitions are evenly split between NormalPostingPending and SendClearingPostingPending.',
      details: [`NormalPostingPending=${normalFollowers}`, `SendClearingPostingPending=${clearingFollowers}`]
    });
  }

  if (input.lifecycleFlags.hasWarehousing && !input.inferredTargets.warehousedReleaseTarget) {
    warnings.push({
      code: 'WAREHOUSE_RELEASE_TARGET_MISSING',
      severity: 'WARN',
      message: 'Warehoused state exists but no release target could be inferred.'
    });
  }

  if (input.lifecycleFlags.hasSanctions && !input.inferredTargets.postSanctionsTarget) {
    warnings.push({
      code: 'SANCTIONS_TARGET_MISSING',
      severity: 'WARN',
      message: 'Sanctions lifecycle was discovered but no apparent downstream target was inferred.'
    });
  }

  const incomingEvidence = countIncomingEvidence(input.normalizedRows);
  const outgoingEvidence = countOutgoingEvidence(input.normalizedRows);
  if (input.direction === 'incoming' && outgoingEvidence > incomingEvidence * 3 && outgoingEvidence >= 3) {
    conflicts.push({
      code: 'DIRECTION_MISMATCH',
      severity: 'ERROR',
      message: 'Incoming direction was selected, but the observed scenario evidence is overwhelmingly outgoing-oriented.',
      details: [`incomingEvidence=${incomingEvidence}`, `outgoingEvidence=${outgoingEvidence}`]
    });
  }
  if (input.direction === 'outgoing' && incomingEvidence > outgoingEvidence * 3 && incomingEvidence >= 2) {
    conflicts.push({
      code: 'DIRECTION_MISMATCH',
      severity: 'ERROR',
      message: 'Outgoing direction was selected, but incoming-only states dominate the observed scenarios.',
      details: [`incomingEvidence=${incomingEvidence}`, `outgoingEvidence=${outgoingEvidence}`]
    });
  }

  const endStates = new Set<string>();
  const continuedStates = new Set<string>();
  input.rawSequences.forEach((sequence) => {
    sequence.forEach((state, index) => {
      if (!state) {
        return;
      }
      if (index === sequence.length - 1) {
        endStates.add(state);
      } else {
        continuedStates.add(state);
      }
    });
  });
  const continuingTerminalCandidates = [...endStates].filter((state) => continuedStates.has(state)).sort((left, right) => left.localeCompare(right));
  if (continuingTerminalCandidates.length > 0) {
    warnings.push({
      code: 'TERMINAL_CONTINUES',
      severity: 'WARN',
      message: 'Some apparent terminal states also continue in other observed sequences.',
      details: continuingTerminalCandidates
    });
  }

  const nullStateRows = input.normalizedRows.filter((row) => row.resolvedState === null).length;
  if (input.normalizedRows.length > 0 && nullStateRows / input.normalizedRows.length > 0.5 && input.discoveredStates.size < 3) {
    warnings.push({
      code: 'NULL_STATE_RATIO_HIGH',
      severity: 'WARN',
      message: 'Too many rows resolved to null states to infer lifecycle with high confidence.',
      details: [`nullRows=${nullStateRows}`, `totalRows=${input.normalizedRows.length}`]
    });
  }

  const simplePosting = input.archetypeMatches.find((match) => match.archetype === 'OUTGOING_SIMPLE_POSTING');
  const complexPosting = input.archetypeMatches.find(
    (match) => match.archetype === 'OUTGOING_SPM_SANCTIONS_BALANCE_CLEARING'
  );
  if (simplePosting && complexPosting && simplePosting.score >= 4 && complexPosting.score >= 4 && Math.abs(simplePosting.score - complexPosting.score) <= 0.5) {
    warnings.push({
      code: 'ARCHETYPE_TIE',
      severity: 'WARN',
      message: 'Posting-only and clearing-posting archetypes scored almost identically.',
      details: [`OUTGOING_SIMPLE_POSTING=${simplePosting.score}`, `OUTGOING_SPM_SANCTIONS_BALANCE_CLEARING=${complexPosting.score}`]
    });
  }

  return {
    conflicts: dedupeConflicts(conflicts),
    warnings: dedupeConflicts(warnings)
  };
}

