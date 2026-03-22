import { describe, expect, it } from 'vitest';
import type { WorkflowSpec } from '../../../models/snapshot';
import type { AnalysisModel } from '../analysis/types';
import { validateGeneratedWorkflow } from './graphValidation';

function makeAnalysisStub(partial: Partial<AnalysisModel> = {}): AnalysisModel {
  return {
    normalizedRows: [],
    discoveredStates: new Set<string>(),
    rawSequences: [],
    prunedTransitions: new Map<string, Set<string>>(),
    lifecycleFlags: {
      hasSpm: false,
      hasSanctions: false,
      hasBalanceCheck: false,
      hasClearing: false,
      hasPosting: false,
      hasWarehousing: false,
      hasBookTransfer: false,
      hasIncomingFlow: false,
      hasOutgoingFlow: true
    },
    inferredTargets: {},
    additionalTerminals: new Set<string>(),
    conflicts: [],
    warnings: [],
    evidence: [],
    archetypeMatches: [],
    ...partial
  };
}

describe('validateGeneratedWorkflow', () => {
  it('detects missing target states', () => {
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'Init',
          onEvent: {
            Go: { target: 'MissingState', actions: [] }
          }
        }
      ]
    };

    const report = validateGeneratedWorkflow(spec);
    expect(report.hasErrors).toBe(true);
    expect(report.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_TARGET_STATE', severity: 'ERROR' })])
    );
  });

  it('detects unreachable non-terminal states unless they are preset-retained', () => {
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'Init',
          onEvent: {
            Go: { target: 'A', actions: [] }
          }
        },
        {
          name: 'A',
          onEvent: {
            Done: { target: 'Done', actions: [] }
          }
        },
        {
          name: 'Done',
          onEvent: {}
        },
        {
          name: 'Detached',
          onEvent: {
            Stay: { target: 'Detached', actions: [] }
          }
        }
      ]
    };

    const report = validateGeneratedWorkflow(spec);
    expect(report.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'UNREACHABLE_STATE', severity: 'ERROR' })])
    );

    const retainedReport = validateGeneratedWorkflow(spec, {
      presetRetainedStates: new Set(['Detached'])
    });
    expect(retainedReport.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'UNREACHABLE_STATE', severity: 'WARN' })])
    );
  });

  it('detects terminal state violations', () => {
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'Init',
          onEvent: {
            Finish: { target: 'Final', actions: [] }
          }
        },
        {
          name: 'Final',
          onEvent: {
            Retry: { target: 'Init', actions: [] }
          }
        }
      ]
    };

    const report = validateGeneratedWorkflow(spec, {
      terminalStates: new Set(['Final'])
    });
    expect(report.hasErrors).toBe(true);
    expect(report.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'TERMINAL_HAS_OUTGOING', severity: 'ERROR' })])
    );
  });

  it('validates warehousing requirements when the lifecycle is present', () => {
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'Init',
          onEvent: {
            Park: { target: 'Warehoused', actions: [] }
          }
        },
        {
          name: 'Warehoused',
          onEvent: {
            OnCancel: { target: 'WarehousedCancelled', actions: [] }
          }
        },
        {
          name: 'WarehousedCancelled',
          onEvent: {}
        }
      ]
    };

    const report = validateGeneratedWorkflow(spec, {
      analysis: makeAnalysisStub({
        discoveredStates: new Set(['Warehoused']),
        lifecycleFlags: {
          hasSpm: false,
          hasSanctions: false,
          hasBalanceCheck: false,
          hasClearing: false,
          hasPosting: false,
          hasWarehousing: true,
          hasBookTransfer: false,
          hasIncomingFlow: false,
          hasOutgoingFlow: true
        }
      }),
      terminalStates: new Set(['WarehousedCancelled'])
    });

    expect(report.hasErrors).toBe(true);
    expect(report.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'WAREHOUSED_RELEASE_MISSING', severity: 'ERROR' })])
    );
  });

  it('keeps warehousing validation dormant until Warehoused is explicitly discovered', () => {
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'Init',
          onEvent: {
            Continue: { target: 'Final', actions: [] }
          }
        },
        {
          name: 'Final',
          onEvent: {}
        }
      ]
    };

    const report = validateGeneratedWorkflow(spec, {
      analysis: makeAnalysisStub({
        lifecycleFlags: {
          hasSpm: false,
          hasSanctions: false,
          hasBalanceCheck: false,
          hasClearing: false,
          hasPosting: false,
          hasWarehousing: true,
          hasBookTransfer: false,
          hasIncomingFlow: false,
          hasOutgoingFlow: true
        }
      }),
      terminalStates: new Set(['Final'])
    });

    expect(report.issues.some((issue) => issue.code.startsWith('WAREHOUSED_'))).toBe(false);
  });
});

