import { describe, expect, it } from 'vitest';
import type { ScenarioCategory, StatusRow, SubFlow } from '../../../../src/features/state-manager/types';
import { analyzeScenarios } from '../../../../src/features/state-manager/analysis/analyzeScenarios';
import { detectArchetypes } from '../../../../src/features/state-manager/analysis/archetypes';
import { detectConflicts } from '../../../../src/features/state-manager/analysis/conflicts';
import {
  inferBalanceTarget,
  inferLifecycleFlags,
  inferNextAfterInit,
  inferPostSanctionsTarget,
  inferWarehousedReleaseTarget,
  type SequenceEvidence
} from '../../../../src/features/state-manager/analysis/inference';
import type { NormalizedRow } from '../../../../src/features/state-manager/analysis/types';

let nextId = 0;

function makeRow(
  msgStatus: string,
  msgSubStatus: string,
  overrides: Partial<StatusRow> = {}
): StatusRow {
  nextId += 1;
  return {
    id: `row-${nextId}`,
    msgStatus,
    msgSubStatus,
    channelPushNotification: false,
    cdmNotification: false,
    transactionStatus: 'PDNG',
    transactionStatusReason: 'TEST',
    reasonDescription: 'test',
    ...overrides
  };
}

function makeSubFlow(title: string, rows: StatusRow[]): SubFlow {
  nextId += 1;
  return {
    id: `subflow-${nextId}`,
    title,
    rows
  };
}

function makeScenario(name: string, subFlows: SubFlow[]): ScenarioCategory[] {
  nextId += 1;
  return [
    {
      id: `scenario-${nextId}`,
      name,
      description: name,
      subFlows,
      hasScenarioColumn: true,
      hasResponsibleColumn: true,
      hasTriggerReversalColumn: true
    }
  ];
}

function makeSequenceEvidence(entries: Array<{ id: string; title?: string; sequence: string[] }>): SequenceEvidence[] {
  return entries.map((entry, index) => ({
    sourceScenarioId: `scenario-${index + 1}`,
    sourceSubFlowId: entry.id,
    sourceSubFlowTitle: entry.title ?? entry.id,
    sequence: entry.sequence
  }));
}

function makeNormalizedRow(
  resolvedState: string | null,
  semanticTags: NormalizedRow['semanticTags'],
  overrides: Partial<NormalizedRow> = {}
): NormalizedRow {
  nextId += 1;
  return {
    sourceScenarioId: 'scenario',
    sourceScenarioName: 'Scenario',
    sourceSubFlowId: 'subflow',
    sourceSubFlowTitle: 'Subflow',
    rowId: `normalized-${nextId}`,
    msgStatus: 'PENDING',
    msgSubStatus: resolvedState ? resolvedState.toUpperCase() : 'ACCOUNT_INVALID',
    transactionStatus: 'PDNG',
    transactionStatusReason: 'TEST',
    resolvedState,
    semanticTags,
    ...overrides
  };
}

describe('analyzeScenarios normalization', () => {
  it('normalizes rows, applies semantic tags, and marks warehouse release evidence', () => {
    const scenarios = makeScenario('Book Transfer Scenario', [
      makeSubFlow('Warehouse release', [
        makeRow(' pending ', ' validated ', {
          transactionStatus: ' pdng ',
          transactionStatusReason: ' accc ',
          scenario: 'Book payment'
        }),
        makeRow(' rejected ', ' account_invalid ', {
          triggerReversal: true
        }),
        makeRow(' pending ', ' warehoused '),
        makeRow(' pending ', ' spm_sent ')
      ])
    ]);

    const analysis = analyzeScenarios(scenarios, 'BR', 'OUTGOING');
    const [initRow, rejectionRow, warehousedRow, releaseRow] = analysis.normalizedRows;

    expect(initRow.msgStatus).toBe('PENDING');
    expect(initRow.msgSubStatus).toBe('VALIDATED');
    expect(initRow.transactionStatus).toBe('PDNG');
    expect(initRow.transactionStatusReason).toBe('ACCC');
    expect(initRow.resolvedState).toBe('Init');
    expect(initRow.semanticTags).toEqual(expect.arrayContaining(['INIT_ENTRY', 'BOOK_TRANSFER', 'OUTGOING_FLOW']));

    expect(rejectionRow.resolvedState).toBeNull();
    expect(rejectionRow.semanticTags).toEqual(
      expect.arrayContaining(['PRE_FSM_REJECTION', 'FINAL_FAILURE', 'CLIENT_NACK', 'REVERSAL_REQUIRED'])
    );

    expect(warehousedRow.resolvedState).toBe('Warehoused');
    expect(warehousedRow.semanticTags).toContain('WAREHOUSE_PARK');
    expect(releaseRow.resolvedState).toBe('SpmSent');
    expect(releaseRow.semanticTags).toEqual(expect.arrayContaining(['SPM_LIFECYCLE', 'WAREHOUSE_RELEASE']));
  });
});

describe('analysis inference helpers', () => {
  it('infers lifecycle flags and nextAfterInit deterministically', () => {
    const rows = [
      makeNormalizedRow('Init', ['INIT_ENTRY', 'OUTGOING_FLOW']),
      makeNormalizedRow('SpmSent', ['SPM_LIFECYCLE', 'OUTGOING_FLOW'])
    ];
    const discoveredStates = new Set(['Init', 'SpmSent']);
    const lifecycleFlags = inferLifecycleFlags(discoveredStates, rows);
    const result = inferNextAfterInit({ discoveredStates, lifecycleFlags });

    expect(lifecycleFlags.hasSpm).toBe(true);
    expect(lifecycleFlags.hasOutgoingFlow).toBe(true);
    expect(result.value).toBe('SpmCheck');
    expect(result.evidence[0]).toMatchObject({
      decision: 'nextAfterInit',
      chosenValue: 'SpmCheck',
      confidence: 'HIGH'
    });
  });

  it('infers post-sanctions and balance targets from direct sequence evidence', () => {
    const sequenceEvidence = makeSequenceEvidence([
      { id: 'sf-1', sequence: ['SanctionsSent', 'BalanceCheckPending', 'SendClearingPostingPending'] },
      { id: 'sf-2', sequence: ['OfacPossibleHit', 'BalanceCheckPending', 'SendClearingPostingPending'] }
    ]);
    const discoveredStates = new Set(['SanctionsSent', 'OfacPossibleHit', 'BalanceCheckPending', 'SendClearingPostingPending']);
    const lifecycleFlags = {
      hasSpm: false,
      hasSanctions: true,
      hasBalanceCheck: true,
      hasClearing: true,
      hasPosting: true,
      hasWarehousing: false,
      hasBookTransfer: false,
      hasIncomingFlow: false,
      hasOutgoingFlow: true
    };

    expect(
      inferPostSanctionsTarget({
        discoveredStates,
        lifecycleFlags,
        sequenceEvidence
      }).value
    ).toBe('BalanceCheckPending');

    expect(
      inferBalanceTarget({
        discoveredStates,
        lifecycleFlags,
        sequenceEvidence
      }).value
    ).toBe('SendClearingPostingPending');
  });

  it('surfaces an error on equal balance-target evidence and still chooses deterministically', () => {
    const sequenceEvidence = makeSequenceEvidence([
      { id: 'sf-1', sequence: ['BalanceCheckPending', 'NormalPostingPending'] },
      { id: 'sf-2', sequence: ['BalanceCheckPending', 'SendClearingPostingPending'] }
    ]);
    const lifecycleFlags = {
      hasSpm: false,
      hasSanctions: false,
      hasBalanceCheck: true,
      hasClearing: true,
      hasPosting: true,
      hasWarehousing: false,
      hasBookTransfer: false,
      hasIncomingFlow: false,
      hasOutgoingFlow: true
    };
    const result = inferBalanceTarget({
      discoveredStates: new Set(['BalanceCheckPending', 'NormalPostingPending', 'SendClearingPostingPending']),
      lifecycleFlags,
      sequenceEvidence
    });

    expect(result.value).toBe('NormalPostingPending');
    expect(result.conflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'BALANCE_TARGET_AMBIGUOUS', severity: 'ERROR' })])
    );
  });

  it('infers the most common warehoused release target with deterministic tie-breaking', () => {
    const result = inferWarehousedReleaseTarget({
      sequenceEvidence: makeSequenceEvidence([
        { id: 'sf-1', sequence: ['Init', 'Warehoused', 'SpmSent'] },
        { id: 'sf-2', sequence: ['Init', 'Warehoused', 'SpmSent'] },
        { id: 'sf-3', sequence: ['Init', 'Warehoused', 'SanctionsSent'] }
      ])
    });

    expect(result.value).toBe('SpmSent');
    expect(result.evidence[0]).toMatchObject({
      decision: 'warehousedReleaseTarget',
      chosenValue: 'SpmSent',
      confidence: 'HIGH'
    });
  });
});

describe('analysis archetypes and conflicts', () => {
  it('scores complex outgoing clearing flows ahead of simpler archetypes', () => {
    const normalizedRows = [
      makeNormalizedRow('Init', ['INIT_ENTRY', 'OUTGOING_FLOW']),
      makeNormalizedRow('SpmSent', ['SPM_LIFECYCLE', 'OUTGOING_FLOW']),
      makeNormalizedRow('SanctionsSent', ['SANCTIONS_LIFECYCLE', 'OUTGOING_FLOW']),
      makeNormalizedRow('BalanceCheckPending', ['BALANCE_CHECK', 'OUTGOING_FLOW']),
      makeNormalizedRow('SendClearingPostingPending', ['CLEARING_PHASE', 'POSTING_PHASE', 'OUTGOING_FLOW']),
      makeNormalizedRow('FinalPostingComplete', ['FINAL_SUCCESS', 'POSTING_PHASE', 'OUTGOING_FLOW'])
    ];
    const discoveredStates = new Set([
      'Init',
      'SpmSent',
      'SanctionsSent',
      'BalanceCheckPending',
      'SendClearingPostingPending',
      'FinalPostingComplete'
    ]);
    const lifecycleFlags = inferLifecycleFlags(discoveredStates, normalizedRows);

    const matches = detectArchetypes({
      normalizedRows,
      discoveredStates,
      rawSequences: [
        ['Init', 'SpmSent', 'SanctionsSent', 'BalanceCheckPending', 'SendClearingPostingPending', 'FinalPostingComplete']
      ],
      lifecycleFlags,
      inferredTargets: {
        nextAfterInit: 'SpmCheck',
        postSanctionsTarget: 'BalanceCheckPending',
        balanceTarget: 'SendClearingPostingPending'
      },
      direction: 'outgoing'
    });

    expect(matches[0]).toMatchObject({ archetype: 'OUTGOING_SPM_SANCTIONS_BALANCE_CLEARING' });
    expect(matches[0]?.reasons.length).toBeGreaterThan(2);
  });

  it('detects missing warehouse release and terminal continuation as warnings', () => {
    const rows = [
      makeNormalizedRow('Warehoused', ['WAREHOUSE_PARK', 'OUTGOING_FLOW']),
      makeNormalizedRow('FinalPostingComplete', ['FINAL_SUCCESS', 'OUTGOING_FLOW'])
    ];
    const result = detectConflicts({
      normalizedRows: rows,
      rawSequences: [
        ['Init', 'FinalPostingComplete'],
        ['FinalPostingComplete', 'BalanceCheckPending']
      ],
      discoveredStates: new Set(['Warehoused', 'FinalPostingComplete', 'BalanceCheckPending']),
      lifecycleFlags: {
        hasSpm: false,
        hasSanctions: false,
        hasBalanceCheck: false,
        hasClearing: false,
        hasPosting: true,
        hasWarehousing: true,
        hasBookTransfer: false,
        hasIncomingFlow: false,
        hasOutgoingFlow: true
      },
      inferredTargets: {},
      archetypeMatches: [],
      direction: 'outgoing'
    });

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'WAREHOUSE_RELEASE_TARGET_MISSING' }),
        expect.objectContaining({ code: 'TERMINAL_CONTINUES' })
      ])
    );
  });
});

describe('analyzeScenarios integration', () => {
  it('produces evidence, inferred targets, archetypes, and hard conflicts for ambiguous balance paths', () => {
    const scenarios = makeScenario('Ambiguous balance path', [
      makeSubFlow('Posting path', [
        makeRow('PENDING', 'VALIDATED'),
        makeRow('PENDING', 'BALANCE_CHECK_PENDING'),
        makeRow('PENDING', 'POSTING_PENDING')
      ]),
      makeSubFlow('Clearing path', [
        makeRow('PENDING', 'VALIDATED'),
        makeRow('PENDING', 'BALANCE_CHECK_PENDING'),
        makeRow('SENT_TO_CLEARING', 'POSTING_PENDING_CLEARING_INFORMED')
      ])
    ]);

    const analysis = analyzeScenarios(scenarios, 'BR', 'OUTGOING');

    expect(analysis.inferredTargets.nextAfterInit).toBe('BalanceCheckPending');
    expect(analysis.inferredTargets.balanceTarget).toBe('NormalPostingPending');
    expect(analysis.additionalTerminals).toEqual(new Set(['TxnRejectedOnGLSTechError', 'TxnRejectedOnNSF']));
    expect(analysis.conflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'BALANCE_TARGET_AMBIGUOUS', severity: 'ERROR' })])
    );
    expect(analysis.evidence.map((entry) => entry.decision)).toEqual(
      expect.arrayContaining(['balanceTarget', 'nextAfterInit'])
    );
    expect(analysis.archetypeMatches[0]?.archetype).toBe('OUTGOING_SIMPLE_POSTING');
  });
});
