import { describe, expect, it } from 'vitest';
import type { WorkflowSpec } from '../../../src/models/snapshot';
import { scenariosToWorkflowSpec } from '../../../src/features/state-manager/scenariosToFsm';
import type { ScenarioCategory, StatusRow, SubFlow } from '../../../src/features/state-manager/types';

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

function makeScenario(subFlows: SubFlow[]): ScenarioCategory[] {
  nextId += 1;
  return [
    {
      id: `scenario-${nextId}`,
      name: 'Scenario',
      description: 'Scenario',
      subFlows,
      hasScenarioColumn: false,
      hasResponsibleColumn: false,
      hasTriggerReversalColumn: false
    }
  ];
}

function getState(spec: WorkflowSpec, name: string) {
  const state = spec.states.find((candidate) => candidate.name === name);
  if (!state) {
    throw new Error(`Missing state ${name}`);
  }
  return state;
}

function buildClearingScenario(): ScenarioCategory[] {
  return makeScenario([
    makeSubFlow('Clearing path', [
      makeRow('PENDING', 'VALIDATED'),
      makeRow('PENDING', 'BALANCE_CHECK_PENDING'),
      makeRow('SENT_TO_CLEARING', 'POSTING_PENDING_CLEARING_INFORMED'),
      makeRow('SENT_TO_CLEARING', 'POSTING_COMPLETE_CLEARING_INFORMED')
    ])
  ]);
}

function buildBrKnowledgePreset(workflowKey = 'BR_OUTGOING_BASELINE'): WorkflowSpec {
  return {
    workflowKey,
    states: [
      {
        name: 'SendClearingPostingPending',
        onEvent: {
          ClearingResponseReceived: { target: 'SendClearingPostingPending', actions: ['process-clearing-response-br'] },
          PostingFailure: { target: 'SendClearingPostingPending', actions: ['process-posting-error-br'] }
        }
      }
    ]
  };
}

describe('scenariosToWorkflowSpec country action policies', () => {
  it('keeps topology shared while resolving actions per country and direction', () => {
    const scenarios = buildClearingScenario();
    const br = scenariosToWorkflowSpec(scenarios, null, [], 'BR_OUTGOING_PAYMENT', 'BR', 'OUTGOING').spec;
    const ar = scenariosToWorkflowSpec(buildClearingScenario(), null, [], 'AR_OUTGOING_PAYMENT', 'AR', 'OUTGOING').spec;
    const cl = scenariosToWorkflowSpec(buildClearingScenario(), null, [], 'CL_OUTGOING_PAYMENT', 'CL', 'OUTGOING').spec;

    expect(br.startState).toBe('Init');
    expect(ar.startState).toBe('Init');
    expect(cl.startState).toBe('Init');
    expect(br.states.map((state) => state.name)).toEqual(ar.states.map((state) => state.name));
    expect(br.states.map((state) => state.name)).toEqual(cl.states.map((state) => state.name));
    expect(Object.keys(getState(br, 'BalanceCheckPending').onEvent)).toEqual(Object.keys(getState(ar, 'BalanceCheckPending').onEvent));
    expect(Object.keys(getState(br, 'SendClearingPostingPending').onEvent)).toEqual(
      Object.keys(getState(ar, 'SendClearingPostingPending').onEvent)
    );

    expect(getState(br, 'BalanceCheckPending').onEvent.OutgoingSendToClearingWithAckAndPosting.actions).toEqual([
      'send-to-clearing-for-br-outgoing',
      'do-normal-outgoing-posting',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    expect(getState(ar, 'BalanceCheckPending').onEvent.OutgoingSendToClearingWithAckAndPosting.actions).toEqual([
      'send-to-clearing-for-ar-outgoing',
      'do-normal-outgoing-posting',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    expect(getState(cl, 'BalanceCheckPending').onEvent.OutgoingSendToClearingWithAckAndPosting.actions).toEqual([
      'send-to-clearing-for-cl-outgoing',
      'do-normal-outgoing-posting',
      'persist-txn',
      'notify-bd-intermediate'
    ]);

    expect(getState(br, 'SendClearingPostingPending').onEvent.ClearingResponseReceived.actions).toEqual([
      'process-clearing-response-br'
    ]);
    expect(getState(ar, 'SendClearingPostingPending').onEvent.ClearingResponseReceived.actions).toEqual([
      'process-clearing-response-ar-outgoing'
    ]);
    expect(getState(cl, 'SendClearingPostingPending').onEvent.ClearingResponseReceived.actions).toEqual([
      'process-clearing-response-cl-outgoing'
    ]);

    expect(getState(br, 'SendClearingPostingPending').onEvent.PostingFailure.actions).toEqual(['process-posting-error-br']);
    expect(getState(ar, 'SendClearingPostingPending').onEvent.PostingFailure.actions).toEqual([
      'process-posting-error-ar-outgoing'
    ]);
    expect(getState(cl, 'SendClearingPostingPending').onEvent.PostingFailure.actions).toEqual([
      'process-posting-error-cl-outgoing'
    ]);
  });

  it('filters out BR-scoped preset knowledge when generating AR outgoing workflows', () => {
    const result = scenariosToWorkflowSpec(
      buildClearingScenario(),
      null,
      [buildBrKnowledgePreset()],
      'AR_OUTGOING_PAYMENT',
      'AR',
      'OUTGOING'
    ).spec;

    expect(getState(result, 'SendClearingPostingPending').onEvent.ClearingResponseReceived.actions).toEqual([
      'process-clearing-response-ar-outgoing'
    ]);
    expect(getState(result, 'SendClearingPostingPending').onEvent.PostingFailure.actions).toEqual([
      'process-posting-error-ar-outgoing'
    ]);
    expect(getState(result, 'SendClearingPostingPending').onEvent.ClearingResponseReceived.actions).not.toContain(
      'process-clearing-response-br'
    );
    expect(getState(result, 'SendClearingPostingPending').onEvent.PostingFailure.actions).not.toContain(
      'process-posting-error-br'
    );
  });

  it('filters out registered-country presets even when the workflow key is country-scoped without direction', () => {
    const result = scenariosToWorkflowSpec(
      buildClearingScenario(),
      null,
      [buildBrKnowledgePreset('BR_BASELINE')],
      'AR_OUTGOING_PAYMENT',
      'AR',
      'OUTGOING'
    ).spec;

    expect(getState(result, 'SendClearingPostingPending').onEvent.ClearingResponseReceived.actions).toEqual([
      'process-clearing-response-ar-outgoing'
    ]);
    expect(getState(result, 'SendClearingPostingPending').onEvent.PostingFailure.actions).toEqual([
      'process-posting-error-ar-outgoing'
    ]);
  });
});
