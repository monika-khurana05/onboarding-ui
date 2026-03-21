import type { AnalysisConflict, AnalysisEvidence, NormalizedRow } from './types';

export type SequenceEvidence = {
  sourceScenarioId: string;
  sourceSubFlowId: string;
  sourceSubFlowTitle: string;
  sequence: string[];
};

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

type InferenceResult = {
  value?: string;
  evidence: AnalysisEvidence[];
  conflicts: AnalysisConflict[];
  warnings: AnalysisConflict[];
};

const SPM_STATES = ['SpmSent', 'SpmFailed', 'SpmError'] as const;
const SANCTIONS_FOLLOWERS = ['BalanceCheckPending', 'NormalPostingPending', 'SendClearingPostingPending'] as const;
const BALANCE_FOLLOWERS = ['NormalPostingPending', 'SendClearingPostingPending'] as const;

function buildEvidence(
  decision: string,
  chosenValue: string,
  reason: string,
  sources: readonly string[],
  confidence: AnalysisEvidence['confidence']
): AnalysisEvidence {
  return {
    decision,
    chosenValue,
    reason,
    sources: [...new Set(sources)].sort((left, right) => left.localeCompare(right)),
    confidence
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function countImmediateFollowers(
  sequenceEvidence: readonly SequenceEvidence[],
  sourceState: string,
  allowedTargets?: readonly string[]
): Map<string, { count: number; sources: string[] }> {
  const result = new Map<string, { count: number; sources: string[] }>();
  const allowed = allowedTargets ? new Set(allowedTargets) : null;

  sequenceEvidence.forEach((entry) => {
    for (let index = 0; index < entry.sequence.length - 1; index += 1) {
      if (entry.sequence[index] !== sourceState) {
        continue;
      }

      const target = entry.sequence[index + 1];
      if (!target || target === sourceState || (allowed && !allowed.has(target))) {
        continue;
      }

      const bucket = result.get(target) ?? { count: 0, sources: [] };
      bucket.count += 1;
      bucket.sources.push(`${entry.sourceScenarioId}:${entry.sourceSubFlowId}`);
      result.set(target, bucket);
    }
  });

  return result;
}

function pickMostCommonTarget(
  counts: Map<string, { count: number; sources: string[] }>
): { target?: string; count: number; sources: string[]; tied: string[] } {
  const ranked = [...counts.entries()].sort((left, right) => {
    const countCompare = right[1].count - left[1].count;
    if (countCompare !== 0) {
      return countCompare;
    }
    return left[0].localeCompare(right[0]);
  });

  const winner = ranked[0];
  if (!winner) {
    return { count: 0, sources: [], tied: [] };
  }

  const tied = ranked.filter((entry) => entry[1].count === winner[1].count).map(([target]) => target);
  return {
    target: winner[0],
    count: winner[1].count,
    sources: uniqueSorted(winner[1].sources),
    tied
  };
}

function discoveredStateSources(discoveredStates: ReadonlySet<string>, states: readonly string[]): string[] {
  return states.filter((state) => discoveredStates.has(state)).map((state) => `state:${state}`);
}

export function inferLifecycleFlags(
  discoveredStates: ReadonlySet<string>,
  normalizedRows: readonly NormalizedRow[]
): LifecycleFlags {
  const hasTag = (tag: string) => normalizedRows.some((row) => row.semanticTags.includes(tag as never));
  const hasState = (...states: string[]) => states.some((state) => discoveredStates.has(state));

  return {
    hasSpm: hasState('SpmSent', 'SpmFailed', 'SpmError') || hasTag('SPM_LIFECYCLE'),
    hasSanctions:
      hasState('SanctionsSent', 'OfacPossibleHit', 'SanctionsReject', 'SanctionsCancelled', 'SanctionsSeized', 'SanctionsRespRepair') ||
      hasTag('SANCTIONS_LIFECYCLE'),
    hasBalanceCheck: hasState('BalanceCheckPending') || hasTag('BALANCE_CHECK'),
    hasClearing:
      hasState(
        'SendClearingPostingPending',
        'SendClearingPostingComplete',
        'ClrRejectedOrgPostingPending',
        'ClearingRejectPostingComplete',
        'IncomingClearingReceived'
      ) || hasTag('CLEARING_PHASE'),
    hasPosting:
      hasState(
        'NormalPostingPending',
        'FinalPostingComplete',
        'SendClearingPostingPending',
        'SendClearingPostingComplete',
        'ClrRejectedOrgPostingPending',
        'ClearingRejectPostingComplete'
      ) || hasTag('POSTING_PHASE'),
    hasWarehousing: hasState('Warehoused') || hasTag('WAREHOUSE_PARK'),
    hasBookTransfer: hasTag('BOOK_TRANSFER'),
    hasIncomingFlow: hasState('IncomingClearingReceived') || hasTag('INCOMING_FLOW'),
    hasOutgoingFlow: hasTag('OUTGOING_FLOW')
  };
}

export function inferNextAfterInit(input: {
  discoveredStates: ReadonlySet<string>;
  lifecycleFlags: LifecycleFlags;
}): InferenceResult {
  const { discoveredStates, lifecycleFlags } = input;

  if (lifecycleFlags.hasSpm) {
    const sources = discoveredStateSources(discoveredStates, SPM_STATES);
    return {
      value: 'SpmCheck',
      evidence: [
        buildEvidence(
          'nextAfterInit',
          'SpmCheck',
          'SPM lifecycle evidence takes priority over downstream paths.',
          sources.length > 0 ? sources : ['tag:SPM_LIFECYCLE'],
          sources.length > 0 ? 'HIGH' : 'MEDIUM'
        )
      ],
      conflicts: [],
      warnings: []
    };
  }

  if (lifecycleFlags.hasSanctions) {
    const sources = discoveredStateSources(discoveredStates, ['SanctionsSent', 'OfacPossibleHit']);
    return {
      value: 'SanctionsSent',
      evidence: [
        buildEvidence(
          'nextAfterInit',
          'SanctionsSent',
          'Sanctions lifecycle evidence was discovered without strong SPM evidence.',
          sources.length > 0 ? sources : ['tag:SANCTIONS_LIFECYCLE'],
          sources.length > 0 ? 'HIGH' : 'MEDIUM'
        )
      ],
      conflicts: [],
      warnings: []
    };
  }

  if (lifecycleFlags.hasBalanceCheck) {
    return {
      value: 'BalanceCheckPending',
      evidence: [
        buildEvidence(
          'nextAfterInit',
          'BalanceCheckPending',
          'Balance-check evidence was discovered and no earlier lifecycle took priority.',
          discoveredStates.has('BalanceCheckPending') ? ['state:BalanceCheckPending'] : ['tag:BALANCE_CHECK'],
          'HIGH'
        )
      ],
      conflicts: [],
      warnings: []
    };
  }

  return {
    value: 'NormalPostingPending',
    evidence: [
      buildEvidence(
        'nextAfterInit',
        'NormalPostingPending',
        'No stronger lifecycle evidence was found, so the posting path is used as the deterministic fallback.',
        ['fallback:posting-only'],
        'LOW'
      )
    ],
    conflicts: [],
    warnings: []
  };
}

export function inferPostSanctionsTarget(input: {
  discoveredStates: ReadonlySet<string>;
  lifecycleFlags: LifecycleFlags;
  sequenceEvidence: readonly SequenceEvidence[];
}): InferenceResult {
  const { discoveredStates, lifecycleFlags, sequenceEvidence } = input;
  const counts = new Map<string, { count: number; sources: string[] }>();

  ['SanctionsSent', 'OfacPossibleHit'].forEach((sourceState) => {
    countImmediateFollowers(sequenceEvidence, sourceState, SANCTIONS_FOLLOWERS).forEach((value, target) => {
      const bucket = counts.get(target) ?? { count: 0, sources: [] };
      bucket.count += value.count;
      bucket.sources.push(...value.sources);
      counts.set(target, bucket);
    });
  });

  const balance = counts.get('BalanceCheckPending')?.count ?? 0;
  const normal = counts.get('NormalPostingPending')?.count ?? 0;
  const clearing = counts.get('SendClearingPostingPending')?.count ?? 0;

  if (balance > 0) {
    return {
      value: 'BalanceCheckPending',
      evidence: [
        buildEvidence(
          'postSanctionsTarget',
          'BalanceCheckPending',
          `Balance-check followers were observed after sanctions states (${balance} occurrences).`,
          uniqueSorted(counts.get('BalanceCheckPending')?.sources ?? []),
          balance >= Math.max(normal, clearing) ? 'HIGH' : 'MEDIUM'
        )
      ],
      conflicts: [],
      warnings: []
    };
  }

  if (normal > 0) {
    return {
      value: 'NormalPostingPending',
      evidence: [
        buildEvidence(
          'postSanctionsTarget',
          'NormalPostingPending',
          `Posting-only followers were observed after sanctions states (${normal} occurrences).`,
          uniqueSorted(counts.get('NormalPostingPending')?.sources ?? []),
          normal >= clearing ? 'HIGH' : 'MEDIUM'
        )
      ],
      conflicts: [],
      warnings: []
    };
  }

  if (clearing > 0) {
    return {
      value: 'SendClearingPostingPending',
      evidence: [
        buildEvidence(
          'postSanctionsTarget',
          'SendClearingPostingPending',
          'Clearing-first followers were directly observed after sanctions states.',
          uniqueSorted(counts.get('SendClearingPostingPending')?.sources ?? []),
          'MEDIUM'
        )
      ],
      conflicts: [],
      warnings: []
    };
  }

  if (discoveredStates.has('BalanceCheckPending')) {
    return {
      value: 'BalanceCheckPending',
      evidence: [
        buildEvidence(
          'postSanctionsTarget',
          'BalanceCheckPending',
          'No direct post-sanctions transition was observed, but balance-check state discovery is the strongest fallback.',
          ['state:BalanceCheckPending'],
          'MEDIUM'
        )
      ],
      conflicts: [],
      warnings: []
    };
  }

  if (discoveredStates.has('NormalPostingPending')) {
    return {
      value: 'NormalPostingPending',
      evidence: [
        buildEvidence(
          'postSanctionsTarget',
          'NormalPostingPending',
          'No direct post-sanctions transition was observed, so the posting-only path is used as fallback.',
          ['state:NormalPostingPending'],
          'LOW'
        )
      ],
      conflicts: [],
      warnings: []
    };
  }

  if (discoveredStates.has('SendClearingPostingPending')) {
    return {
      value: 'SendClearingPostingPending',
      evidence: [
        buildEvidence(
          'postSanctionsTarget',
          'SendClearingPostingPending',
          'No downstream sanctions target was observed, so clearing-posting is used as the last supported fallback.',
          ['state:SendClearingPostingPending'],
          'LOW'
        )
      ],
      conflicts: [],
      warnings: []
    };
  }

  return {
    evidence: [],
    conflicts: [],
    warnings: lifecycleFlags.hasSanctions
      ? [
          {
            code: 'SANCTIONS_TARGET_MISSING',
            severity: 'WARN',
            message: 'Sanctions lifecycle was discovered but no downstream target could be inferred.'
          }
        ]
      : []
  };
}

export function inferBalanceTarget(input: {
  discoveredStates: ReadonlySet<string>;
  lifecycleFlags: LifecycleFlags;
  sequenceEvidence: readonly SequenceEvidence[];
}): InferenceResult {
  const { discoveredStates, lifecycleFlags, sequenceEvidence } = input;
  const counts = countImmediateFollowers(sequenceEvidence, 'BalanceCheckPending', BALANCE_FOLLOWERS);
  const normal = counts.get('NormalPostingPending')?.count ?? 0;
  const clearing = counts.get('SendClearingPostingPending')?.count ?? 0;

  if (normal > 0 || clearing > 0) {
    if (normal === clearing && normal > 0) {
      return {
        value: 'NormalPostingPending',
        evidence: [
          buildEvidence(
            'balanceTarget',
            'NormalPostingPending',
            'Balance-check evidence was evenly split between posting-only and clearing-posting paths; alphabetical tie-break was applied.',
            uniqueSorted([
              ...(counts.get('NormalPostingPending')?.sources ?? []),
              ...(counts.get('SendClearingPostingPending')?.sources ?? [])
            ]),
            'LOW'
          )
        ],
        conflicts: [
          {
            code: 'BALANCE_TARGET_AMBIGUOUS',
            severity: 'ERROR',
            message: 'Balance-check transitions are evenly split between NormalPostingPending and SendClearingPostingPending.',
            details: [`NormalPostingPending=${normal}`, `SendClearingPostingPending=${clearing}`]
          }
        ],
        warnings: []
      };
    }

    const winner = clearing > normal ? 'SendClearingPostingPending' : 'NormalPostingPending';
    return {
      value: winner,
      evidence: [
        buildEvidence(
          'balanceTarget',
          winner,
          `${winner} had the strongest direct balance-check evidence (${Math.max(normal, clearing)} occurrences).`,
          uniqueSorted(counts.get(winner)?.sources ?? []),
          'HIGH'
        )
      ],
      conflicts: [],
      warnings: []
    };
  }

  if (discoveredStates.has('SendClearingPostingPending') && lifecycleFlags.hasClearing && lifecycleFlags.hasOutgoingFlow) {
    return {
      value: 'SendClearingPostingPending',
      evidence: [
        buildEvidence(
          'balanceTarget',
          'SendClearingPostingPending',
          'Outgoing clearing evidence exists even though balance-check followers were not directly observed.',
          ['state:SendClearingPostingPending'],
          'MEDIUM'
        )
      ],
      conflicts: [],
      warnings: []
    };
  }

  if (discoveredStates.has('NormalPostingPending')) {
    return {
      value: 'NormalPostingPending',
      evidence: [
        buildEvidence(
          'balanceTarget',
          'NormalPostingPending',
          'Posting-only evidence exists and no clearing path outranked it.',
          ['state:NormalPostingPending'],
          'MEDIUM'
        )
      ],
      conflicts: [],
      warnings: []
    };
  }

  if (discoveredStates.has('SendClearingPostingPending')) {
    return {
      value: 'SendClearingPostingPending',
      evidence: [
        buildEvidence(
          'balanceTarget',
          'SendClearingPostingPending',
          'Clearing-posting state discovery is the only supported downstream balance target.',
          ['state:SendClearingPostingPending'],
          'LOW'
        )
      ],
      conflicts: [],
      warnings: []
    };
  }

  return {
    evidence: [],
    conflicts: [],
    warnings: lifecycleFlags.hasBalanceCheck
      ? [
          {
            code: 'BALANCE_TARGET_MISSING',
            severity: 'WARN',
            message: 'Balance-check lifecycle was discovered but no downstream posting target could be inferred.'
          }
        ]
      : []
  };
}

export function inferWarehousedReleaseTarget(input: {
  sequenceEvidence: readonly SequenceEvidence[];
}): InferenceResult {
  const counts = countImmediateFollowers(input.sequenceEvidence, 'Warehoused');
  const winner = pickMostCommonTarget(counts);

  if (!winner.target) {
    return {
      evidence: [],
      conflicts: [],
      warnings: [
        {
          code: 'WAREHOUSE_RELEASE_TARGET_MISSING',
          severity: 'WARN',
          message: 'Warehoused state was discovered but no release target could be inferred from the observed sequences.'
        }
      ]
    };
  }

  const isTie = winner.tied.length > 1;
  return {
    value: winner.target,
    evidence: [
      buildEvidence(
        'warehousedReleaseTarget',
        winner.target,
        isTie
          ? 'Multiple warehouse release targets were observed; the most common target won and alphabetical tie-break resolved any remaining tie.'
          : 'Observed sequences consistently continue from Warehoused into the selected release target.',
        winner.sources,
        isTie ? 'MEDIUM' : 'HIGH'
      )
    ],
    conflicts: [],
    warnings: []
  };
}
