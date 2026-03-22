import { describe, expect, it } from 'vitest';
import type { WorkflowSpec } from '../../../../src/models/snapshot';
import type { ScenarioCategory, StatusRow, SubFlow } from '../../../../src/features/state-manager/types';
import { replayScenariosAgainstWorkflow } from '../../../../src/features/state-manager/validation/replayScenarios';

let nextId = 0;

function makeRow(msgStatus: string, msgSubStatus: string): StatusRow {
  nextId += 1;
  return {
    id: `row-${nextId}`,
    msgStatus,
    msgSubStatus,
    channelPushNotification: false,
    cdmNotification: false,
    transactionStatus: 'PDNG',
    transactionStatusReason: 'TEST',
    reasonDescription: 'test'
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
      hasScenarioColumn: false,
      hasResponsibleColumn: false,
      hasTriggerReversalColumn: false
    }
  ];
}

describe('replayScenariosAgainstWorkflow', () => {
  it('replays a direct happy path successfully', () => {
    const scenarios = makeScenario('Happy path', [
      makeSubFlow('Current', [
        makeRow('PENDING', 'VALIDATED'),
        makeRow('PENDING', 'BALANCE_CHECK_PENDING'),
        makeRow('PENDING', 'POSTING_PENDING')
      ])
    ]);
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'Init',
          onEvent: {
            Go: { target: 'BalanceCheckPending', actions: [] }
          }
        },
        {
          name: 'BalanceCheckPending',
          onEvent: {
            Continue: { target: 'NormalPostingPending', actions: [] }
          }
        },
        {
          name: 'NormalPostingPending',
          onEvent: {}
        }
      ]
    };

    const report = replayScenariosAgainstWorkflow(scenarios, spec);
    expect(report.failedCount).toBe(0);
    expect(report.results[0]).toMatchObject({
      matched: true,
      expectedStates: ['Init', 'BalanceCheckPending', 'NormalPostingPending']
    });
  });

  it('allows bounded indirect replay through technical expansion states', () => {
    const scenarios = makeScenario('SPM path', [
      makeSubFlow('Current', [makeRow('PENDING', 'VALIDATED'), makeRow('PENDING', 'SPM_SENT')])
    ]);
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'Init',
          onEvent: {
            DupCheckPassed: { target: 'SpmCheck', actions: [] }
          }
        },
        {
          name: 'SpmCheck',
          onEvent: {
            SpmEnabled: { target: 'SpmSent', actions: [] }
          }
        },
        {
          name: 'SpmSent',
          onEvent: {}
        }
      ]
    };

    const report = replayScenariosAgainstWorkflow(scenarios, spec);
    expect(report.failedCount).toBe(0);
    expect(report.results[0]?.matched).toBe(true);
    expect(report.results[0]?.missingTransitions).toEqual([]);
  });

  it('fails replay when a key transition is missing', () => {
    const scenarios = makeScenario('Posting failure', [
      makeSubFlow('Current', [
        makeRow('PENDING', 'VALIDATED'),
        makeRow('PENDING', 'BALANCE_CHECK_PENDING'),
        makeRow('PENDING', 'POSTING_PENDING')
      ])
    ]);
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'Init',
          onEvent: {
            Go: { target: 'BalanceCheckPending', actions: [] }
          }
        },
        {
          name: 'BalanceCheckPending',
          onEvent: {
            Stay: { target: 'BalanceCheckPending', actions: [] }
          }
        }
      ]
    };

    const report = replayScenariosAgainstWorkflow(scenarios, spec);
    expect(report.failedCount).toBe(1);
    expect(report.results[0]).toMatchObject({
      matched: false,
      missingTransitions: ['BalanceCheckPending->NormalPostingPending'],
      unexpectedStates: ['NormalPostingPending']
    });
  });

  it('treats trimmed state names in the workflow as replayable', () => {
    const scenarios = makeScenario('Trimmed names', [
      makeSubFlow('Current', [
        makeRow('PENDING', 'VALIDATED'),
        makeRow('PENDING', 'BALANCE_CHECK_PENDING'),
        makeRow('PENDING', 'POSTING_PENDING')
      ])
    ]);
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      startState: ' Init ',
      states: [
        {
          name: ' Init ',
          onEvent: {
            Go: { target: ' BalanceCheckPending ', actions: [] }
          }
        },
        {
          name: ' BalanceCheckPending ',
          onEvent: {
            Continue: { target: ' NormalPostingPending ', actions: [] }
          }
        },
        {
          name: ' NormalPostingPending ',
          onEvent: {}
        }
      ]
    };

    const report = replayScenariosAgainstWorkflow(scenarios, spec);
    expect(report.failedCount).toBe(0);
    expect(report.results[0]).toMatchObject({
      matched: true,
      missingTransitions: [],
      unexpectedStates: []
    });
  });
});

