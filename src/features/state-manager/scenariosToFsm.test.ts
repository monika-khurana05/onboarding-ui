import { describe, expect, it } from 'vitest';
import { lintWorkflowSpec, listAllTransitions, type WorkflowSpec } from '../../models/snapshot';
import { createDefaultScenarios } from './defaultScenarios';
import {
  DEFAULT_DIRECT_MAP,
  DEFAULT_PRE_FSM_REJECTIONS,
  buildKnowledgeBase,
  detectTerminalStates,
  deriveRawTransitions,
  discoverStates,
  extractFlowSequences,
  previewConversion,
  pruneSubsumedTransitions,
  resolveActions,
  resolveEventName,
  resolveStateName,
  scenariosToWorkflowSpec,
  selectStartState,
  shouldSkipSubFlow
} from './scenariosToFsm';
import type { ScenarioCategory, StatusRow, SubFlow } from './types';

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
  return spec.states.find((state) => state.name === name);
}

function expectTransition(spec: WorkflowSpec, from: string, eventName: string, target: string, actions?: string[]) {
  const transition = getState(spec, from)?.onEvent[eventName];
  expect(transition?.target).toBe(target);
  if (actions) {
    expect(transition?.actions).toEqual(actions);
  }
}

function mapTargets(transitions: Map<string, Set<string>>, source: string): string[] {
  return [...(transitions.get(source) ?? new Set<string>())].sort();
}

function makeBrOutgoingKnowledgePreset(): WorkflowSpec {
  return {
    workflowKey: 'BR_OUTGOING_BASELINE',
    states: [
      {
        name: 'SanctionsSent',
        onEvent: {
          SanctionsResponseReceived: { target: 'SanctionsSent', actions: ['process-sanctions-response'] },
          OnRetry: { target: 'SanctionsSent', actions: ['reset-mtp', 'send-sanctions-request', 'persist-txn'] }
        }
      },
      {
        name: 'SanctionsRespRepair',
        onEvent: {
          OnRetry: {
            target: 'SanctionsSent',
            actions: ['reset-mtp', 'send-sanctions-request', 'persist-txn', 'notify-bd-intermediate']
          }
        }
      },
      {
        name: 'BalanceCheckPending',
        onEvent: {
          BalanceCheckResult: { target: 'BalanceCheckPending', actions: ['process-balance-check-result-br-outgoing'] }
        }
      },
      {
        name: 'OfacPossibleHit',
        onEvent: {
          SanctionsFalseMatch: {
            target: 'BalanceCheckPending',
            actions: ['process-false-match-br-outgoing', 'do-balance-check', 'persist-txn', 'notify-bd-intermediate']
          }
        }
      },
      {
        name: 'SendClearingPostingPending',
        onEvent: {
          ClearingResponseReceived: { target: 'SendClearingPostingPending', actions: ['process-clearing-response-br'] },
          PostingFailure: { target: 'SendClearingPostingPending', actions: ['process-posting-error-br'] }
        }
      },
      {
        name: 'SendClearingPostingComplete',
        onEvent: {
          ClearingResponseReceived: { target: 'SendClearingPostingComplete', actions: ['process-clearing-response-br'] }
        }
      }
    ]
  };
}

describe('buildKnowledgeBase', () => {
  it('keeps first-seen entries across presets and ignores malformed transitions safely', () => {
    const presets: WorkflowSpec[] = [
      {
        workflowKey: 'ONE',
        states: [
          {
            name: 'Alpha',
            onEvent: {
              FirstSeen: { target: 'Beta', actions: ['a', 'a'] }
            }
          },
          {
            name: '',
            onEvent: {
              Broken: { target: '', actions: ['x'] }
            }
          } as unknown as WorkflowSpec['states'][number]
        ]
      },
      {
        workflowKey: 'TWO',
        states: [
          {
            name: 'Alpha',
            onEvent: {
              LaterSeen: { target: 'Beta', actions: ['b'] },
              IgnoreEmpty: { target: '', actions: ['c'] }
            }
          }
        ]
      }
    ];

    expect(buildKnowledgeBase(presets).get('Alpha->Beta')).toEqual({
      eventName: 'FirstSeen',
      actions: ['a']
    });
  });
});

describe('resolveStateName', () => {
  it('maps all default direct-map entries', () => {
    Object.entries(DEFAULT_DIRECT_MAP).forEach(([token, expected]) => {
      expect(resolveStateName('PENDING', token)).toBe(expected);
    });
  });

  it('drops all default pre-FSM rejection states', () => {
    DEFAULT_PRE_FSM_REJECTIONS.forEach((token) => {
      expect(resolveStateName('REJECTED', token)).toBeNull();
    });
  });

  it('handles posting variants, warehoused, fallbacks, and empty sub-status', () => {
    expect(resolveStateName('SENT_TO_CLEARING', 'POSTING_PENDING')).toBe('SendClearingPostingPending');
    expect(resolveStateName('COMPLETE', 'POSTING_PENDING')).toBe('NormalPostingPending');
    expect(resolveStateName('SENT_TO_CLEARING', 'POSTING_COMPLETE_CLEARING_INFORMED')).toBe('SendClearingPostingComplete');
    expect(resolveStateName('COMPLETE', 'POSTING_COMPLETE')).toBe('FinalPostingComplete');
    expect(resolveStateName('REJECTED', 'POSTING_COMPLETE')).toBe('ClearingRejectPostingComplete');
    expect(resolveStateName('PENDING', 'WAREHOUSED')).toBe('Warehoused');
    expect(resolveStateName('PENDING', 'COMPLIANCE_REVIEW')).toBe('ComplianceReview');
    expect(resolveStateName('PENDING', 'UNKNOWN_STATUS')).toBe('UnknownStatus');
    expect(resolveStateName('PENDING', '')).toBeNull();
    expect(resolveStateName('', '')).toBeNull();
    expect(resolveStateName('NON_PAY_COMPLETE', 'ANYTHING')).toBeNull();
    expect(resolveStateName('PENDING', 'NON_PAY_RECEIVED_FOR_PROCESSING')).toBeNull();
  });

  it('supports custom direct-map overrides and rejection lists', () => {
    expect(
      resolveStateName('PENDING', 'SPM_SENT', {
        customDirectMap: { SPM_SENT: 'CustomSpmSent' }
      })
    ).toBe('CustomSpmSent');

    expect(
      resolveStateName('REJECTED', 'ACCOUNT_INVALID', {
        preFsmRejections: []
      })
    ).toBe('AccountInvalid');
  });
});

describe('shouldSkipSubFlow', () => {
  it('skips future-dated titles and keeps other titles', () => {
    expect(shouldSkipSubFlow('Future dated payment')).toBe(true);
    expect(shouldSkipSubFlow('future-dated payment')).toBe(true);
    expect(shouldSkipSubFlow('FUTUREDATED payment')).toBe(true);
    expect(shouldSkipSubFlow('Current dated payment')).toBe(false);
    expect(shouldSkipSubFlow('Warehouse release')).toBe(false);
  });
});

describe('sequence extraction and preview', () => {
  it('deduplicates consecutive states, skips null rows and future-dated subflows, and preserves warehoused', () => {
    const scenarios = makeScenario([
      makeSubFlow('Current dated', [
        makeRow('PENDING', 'VALIDATED'),
        makeRow('PENDING', 'VALIDATED'),
        makeRow('REJECTED', 'ACCOUNT_INVALID'),
        makeRow('PENDING', 'WAREHOUSED'),
        makeRow('PENDING', 'SPM_SENT')
      ]),
      makeSubFlow('Future-dated release', [makeRow('PENDING', 'SANCTIONS_SENT')])
    ]);

    expect(extractFlowSequences(scenarios)).toEqual([['Init', 'Warehoused', 'SpmSent']]);
    expect([...discoverStates(scenarios)].sort()).toEqual(['Init', 'SpmSent', 'Warehoused']);
    expect(previewConversion(scenarios)).toEqual({
      discoveredStateCount: 3,
      scenarioCount: 1,
      totalRows: 6
    });
  });

  it('uses preview resolution options when counting discovered states', () => {
    const scenarios = makeScenario([makeSubFlow('Current dated', [makeRow('REJECTED', 'ACCOUNT_INVALID')])]);

    expect(previewConversion(scenarios)).toEqual({
      discoveredStateCount: 0,
      scenarioCount: 1,
      totalRows: 1
    });
    expect(
      previewConversion(scenarios, {
        options: {
          preFsmRejections: []
        }
      })
    ).toEqual({
      discoveredStateCount: 1,
      scenarioCount: 1,
      totalRows: 1
    });
    expect(
      discoverStates(scenarios, {
        preFsmRejections: []
      }).has('AccountInvalid')
    ).toBe(true);
  });
});

describe('transition graph helpers', () => {
  it('derives transitions and skips self-transitions', () => {
    const transitions = deriveRawTransitions([
      ['Init', 'SpmSent', 'SanctionsSent'],
      ['SpmSent', 'SpmSent', 'BalanceCheckPending']
    ]);

    expect(mapTargets(transitions, 'Init')).toEqual(['SpmSent']);
    expect(mapTargets(transitions, 'SpmSent')).toEqual(['BalanceCheckPending', 'SanctionsSent']);
  });

  it('prunes subsumed shortcuts deterministically', () => {
    const diamond = new Map<string, Set<string>>([
      ['Init', new Set(['A', 'C'])],
      ['A', new Set(['B'])],
      ['B', new Set(['C'])]
    ]);
    expect(mapTargets(pruneSubsumedTransitions(diamond), 'Init')).toEqual(['A']);

    const linear = new Map<string, Set<string>>([
      ['Init', new Set(['A', 'B', 'C'])],
      ['A', new Set(['B'])],
      ['B', new Set(['C'])]
    ]);
    expect(mapTargets(pruneSubsumedTransitions(linear), 'Init')).toEqual(['A']);

    const keepShortcut = new Map<string, Set<string>>([
      ['Init', new Set(['A', 'B'])],
      ['A', new Set(['C'])]
    ]);
    expect(mapTargets(pruneSubsumedTransitions(keepShortcut), 'Init')).toEqual(['A', 'B']);
  });

  it('detects terminal states from sequence endings and outgoing edges', () => {
    const transitions = new Map<string, Set<string>>([
      ['Init', new Set(['A'])],
      ['A', new Set(['B'])]
    ]);
    const sequences = [
      ['Init', 'A', 'B'],
      ['Init', 'A', 'C']
    ];

    expect([...detectTerminalStates(transitions, sequences, new Set(['Init', 'A', 'B', 'C']))].sort()).toEqual([
      'B',
      'C'
    ]);
  });
});

describe('resolveEventName and resolveActions', () => {
  it('prefers KB data and falls back deterministically', () => {
    const kb = new Map([
      [
        'Alpha->Beta',
        {
          eventName: 'KnownEvent',
          actions: ['known-action']
        }
      ]
    ]);
    const terminalStates = new Set(['FinalPostingComplete']);

    expect(resolveEventName('Alpha', 'Beta', terminalStates, kb)).toBe('KnownEvent');
    expect(resolveActions('Alpha', 'Beta', terminalStates, 'BR', 'outgoing', kb)).toEqual(['known-action']);
    expect(resolveEventName('Alpha', 'FinalPostingComplete', terminalStates, new Map())).toBe('ReachedFinalPostingComplete');
    expect(resolveEventName('Alpha', 'BalanceCheckPending', terminalStates, new Map())).toBe('ProcessBalanceCheckPending');
    expect(resolveActions('Alpha', 'FinalPostingComplete', terminalStates, 'BR', 'incoming', new Map())).toEqual([
      'process-final-posting-complete-br-incoming',
      'persist-txn',
      'notify-bd-final'
    ]);
    expect(resolveActions('Alpha', 'BalanceCheckPending', terminalStates, 'AR', 'outgoing', new Map())).toEqual([
      'process-balance-check-pending-ar-outgoing',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
  });
});

describe('selectStartState', () => {
  it('prefers Init when it exists and otherwise falls back to the most frequent first state', () => {
    expect(selectStartState([['BalanceCheckPending'], ['NormalPostingPending']], ['Init', 'BalanceCheckPending'])).toBe(
      'Init'
    );
    expect(selectStartState([['SpmSent'], ['Init', 'A'], ['Init', 'B']])).toBe('Init');
    expect(selectStartState([['B'], ['A']])).toBe('A');
    expect(selectStartState([])).toBe('Init');
  });
});

describe('expansion rules', () => {
  it('handles minimal init-only flows', () => {
    const result = scenariosToWorkflowSpec(
      makeScenario([makeSubFlow('Current', [makeRow('PENDING', 'VALIDATED')])]),
      null,
      [],
      'WF',
      'BR',
      'OUTGOING'
    );

    expectTransition(result.spec, 'Init', 'DupCheckCompleted', 'Init', ['on-dup-check-completed']);
    expectTransition(result.spec, 'Init', 'DupCheckPassed', 'NormalPostingPending', [
      'on-dup-check-passed',
      'do-spm-check',
      'notify-proxy-svc-br-outgoing'
    ]);
  });

  it('adds spm and sanctions scaffolding when discovered', () => {
    const spmOnly = scenariosToWorkflowSpec(
      makeScenario([makeSubFlow('Current', [makeRow('PENDING', 'VALIDATED'), makeRow('PENDING', 'SPM_SENT')])]),
      null,
      [],
      'WF',
      'BR',
      'OUTGOING'
    );
    expectTransition(spmOnly.spec, 'SpmCheck', 'SpmEnabled', 'SpmSent');
    expectTransition(spmOnly.spec, 'SpmCheck', 'SpmDisabled', 'BalanceCheckPending');
    expectTransition(spmOnly.spec, 'SpmSent', 'SpmEnrichmentSuccessful', 'BalanceCheckPending');

    const sanctions = scenariosToWorkflowSpec(
      makeScenario([
        makeSubFlow('Current', [
          makeRow('PENDING', 'VALIDATED'),
          makeRow('PENDING', 'SPM_SENT'),
          makeRow('PENDING', 'SANCTIONS_SENT'),
          makeRow('PENDING', 'BALANCE_CHECK_PENDING')
        ])
      ]),
      null,
      [],
      'WF',
      'BR',
      'OUTGOING'
    );
    expectTransition(sanctions.spec, 'PreSanctionsResultCheck', 'NeedSanctions', 'SanctionsSent');
    expectTransition(sanctions.spec, 'PreSanctionsResultCheck', 'SkipSanctions', 'BalanceCheckPending');
    expectTransition(sanctions.spec, 'SanctionsSent', 'SanctionsException', 'SanctionsRespRepair');
  });

  it('keeps the BR outgoing sanctions retry branches distinct without preset knowledge', () => {
    const result = scenariosToWorkflowSpec(
      makeScenario([
        makeSubFlow('Sanctions repair', [
          makeRow('PENDING', 'VALIDATED'),
          makeRow('PENDING', 'SPM_SENT'),
          makeRow('PENDING', 'SANCTIONS_SENT'),
          makeRow('PENDING', 'SANCTIONS_RESP_REPAIR')
        ])
      ]),
      null,
      [],
      'WF',
      'BR',
      'OUTGOING',
      {
        customDirectMap: {
          SANCTIONS_RESP_REPAIR: 'SanctionsRespRepair'
        }
      }
    );

    expectTransition(result.spec, 'SanctionsSent', 'OnRetry', 'SanctionsSent', [
      'reset-mtp',
      'send-sanctions-request',
      'persist-txn'
    ]);
    expectTransition(result.spec, 'SanctionsRespRepair', 'OnRetry', 'SanctionsSent', [
      'reset-mtp',
      'send-sanctions-request',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
  });

  it('covers clearing, posting-only, and no-spm paths', () => {
    const clearing = scenariosToWorkflowSpec(
      makeScenario([
        makeSubFlow('Current', [
          makeRow('PENDING', 'BALANCE_CHECK_PENDING'),
          makeRow('SENT_TO_CLEARING', 'POSTING_PENDING_CLEARING_INFORMED'),
          makeRow('SENT_TO_CLEARING', 'POSTING_COMPLETE_CLEARING_INFORMED')
        ])
      ]),
      null,
      [],
      'WF',
      'BR',
      'OUTGOING'
    );
    expectTransition(clearing.spec, 'SendClearingPostingPending', 'ClearingResponseRJCT', 'ClrRejectedOrgPostingPending');
    expectTransition(clearing.spec, 'SendClearingPostingPending', 'PostingSuccess', 'SendClearingPostingComplete');
    expectTransition(clearing.spec, 'SendClearingPostingComplete', 'ClearingResponseACCC', 'FinalPostingComplete');

    const noClearing = scenariosToWorkflowSpec(
      makeScenario([
        makeSubFlow('Current', [
          makeRow('PENDING', 'BALANCE_CHECK_PENDING'),
          makeRow('PENDING', 'POSTING_PENDING'),
          makeRow('COMPLETE', 'POSTING_COMPLETE')
        ])
      ]),
      null,
      [],
      'WF',
      'BR',
      'OUTGOING'
    );
    expectTransition(noClearing.spec, 'BalanceCheckPending', 'NotifyB2BToClearingAndPosting', 'NormalPostingPending');
    expectTransition(noClearing.spec, 'NormalPostingPending', 'PostingSuccess', 'FinalPostingComplete');

    const noSpm = scenariosToWorkflowSpec(
      makeScenario([
        makeSubFlow('Current', [
          makeRow('PENDING', 'VALIDATED'),
          makeRow('PENDING', 'SANCTIONS_SENT'),
          makeRow('PENDING', 'BALANCE_CHECK_PENDING')
        ])
      ]),
      null,
      [],
      'WF',
      'BR',
      'OUTGOING'
    );
    expectTransition(noSpm.spec, 'Init', 'DupCheckPassed', 'SanctionsSent');
  });

  it('supports warehoused release selection and incoming activation without breaking dormant incoming flows', () => {
    const warehoused = scenariosToWorkflowSpec(
      makeScenario([
        makeSubFlow('Warehouse release', [makeRow('PENDING', 'VALIDATED'), makeRow('PENDING', 'WAREHOUSED'), makeRow('PENDING', 'SPM_SENT')]),
        makeSubFlow('Warehouse release second', [makeRow('PENDING', 'VALIDATED'), makeRow('PENDING', 'WAREHOUSED'), makeRow('PENDING', 'SPM_SENT')]),
        makeSubFlow('Warehouse release third', [makeRow('PENDING', 'VALIDATED'), makeRow('PENDING', 'WAREHOUSED'), makeRow('PENDING', 'SANCTIONS_SENT')])
      ]),
      null,
      [],
      'WF',
      'BR',
      'OUTGOING'
    );
    expectTransition(warehoused.spec, 'Warehoused', 'OnRelease', 'SpmSent');
    expectTransition(warehoused.spec, 'Warehoused', 'OnCancel', 'WarehousedCancelled');

    const incomingDormant = scenariosToWorkflowSpec(
      makeScenario([makeSubFlow('Current', [makeRow('PENDING', 'VALIDATED')])]),
      null,
      [],
      'WF',
      'BR',
      'INCOMING'
    );
    expect(getState(incomingDormant.spec, 'IncomingClearingReceived')).toBeUndefined();

    const incomingActive = scenariosToWorkflowSpec(
      makeScenario([makeSubFlow('Current', [makeRow('PENDING', 'INCOMING_CLEARING_RECEIVED')])]),
      null,
      [],
      'WF',
      'BR',
      'INCOMING',
      {
        customDirectMap: {
          INCOMING_CLEARING_RECEIVED: 'IncomingClearingReceived'
        }
      }
    );
    expectTransition(incomingActive.spec, 'IncomingClearingReceived', 'IncomingClearingAccepted', 'NormalPostingPending');
    expectTransition(incomingActive.spec, 'IncomingClearingReceived', 'IncomingClearingRejected', 'ClrRejectedOrgPostingPending');
    expectTransition(incomingActive.spec, 'IncomingClearingReceived', 'IncomingClearingPosted', 'FinalPostingComplete');
  });

  it('supports enabling and disabling expansion rules', () => {
    const scenarios = makeScenario([makeSubFlow('Current', [makeRow('PENDING', 'VALIDATED'), makeRow('PENDING', 'SPM_SENT')])]);

    const disabled = scenariosToWorkflowSpec(scenarios, null, [], 'WF', 'BR', 'OUTGOING', {
      disabledRuleIds: ['A']
    });
    expect(getState(disabled.spec, 'Init')?.onEvent.DupCheckPassed).toBeUndefined();

    const enabled = scenariosToWorkflowSpec(scenarios, null, [], 'WF', 'BR', 'OUTGOING', {
      enabledRuleIds: ['A']
    });
    expectTransition(enabled.spec, 'Init', 'DupCheckPassed', 'SpmCheck');
    expect(getState(enabled.spec, 'SpmCheck')?.onEvent.SpmEnabled).toBeUndefined();
  });
});

describe('scenariosToWorkflowSpec integration', () => {
  it('produces deterministic output for representative default scenarios', () => {
    const scenarios = createDefaultScenarios();
    const resultA = scenariosToWorkflowSpec(scenarios, null, [], 'AR_OUTGOING_PAYMENT', 'AR', 'OUTGOING');
    const resultB = scenariosToWorkflowSpec(createDefaultScenarios(), null, [], 'AR_OUTGOING_PAYMENT', 'AR', 'OUTGOING');

    expect(resultA.spec).toEqual(resultB.spec);
    expect([...resultA.newTransitions]).toEqual([...resultB.newTransitions]);
    expect(resultA.lint).toEqual(lintWorkflowSpec(resultA.spec));
    expect(previewConversion(scenarios)).toEqual({
      scenarioCount: 8,
      totalRows: 105,
      discoveredStateCount: 18
    });
    expect(resultA.spec.states.length).toBe(25);
    expect(listAllTransitions(resultA.spec)).toHaveLength(65);
    expect(resultA.spec.startState).toBe('Init');
    expectTransition(resultA.spec, 'Init', 'DupCheckPassed', 'SpmCheck');
    expectTransition(resultA.spec, 'SanctionsSent', 'SanctionsNoHit', 'BalanceCheckPending');
    expectTransition(resultA.spec, 'BalanceCheckPending', 'BalanceCheckNSFErrorTimeOut', 'TxnRejectedOnNSF');
    resultA.spec.states.forEach((state) => {
      const eventNames = Object.keys(state.onEvent);
      expect(new Set(eventNames).size).toBe(eventNames.length);
      expect(eventNames).toEqual([...eventNames].sort((left, right) => left.localeCompare(right)));
    });
  });

  it('merges preset transitions while preserving preset classes and forcing Init to the front when present', () => {
    const preset: WorkflowSpec = {
      workflowKey: 'BR_OUTGOING_PAYMENT',
      statesClass: 'custom.State',
      eventsClass: 'custom.Event',
      startState: 'PaymentReceived',
      states: [
        {
          name: 'PaymentReceived',
          onEvent: {
            ValidationPassed: { target: 'Init', actions: ['persist-payment'] }
          }
        },
        {
          name: 'Completed',
          onEvent: {}
        }
      ]
    };

    const result = scenariosToWorkflowSpec(
      makeScenario([makeSubFlow('Current', [makeRow('PENDING', 'VALIDATED'), makeRow('PENDING', 'SPM_SENT')])]),
      preset,
      [preset],
      'BR_OUTGOING_PAYMENT',
      'BR',
      'OUTGOING'
    );

    expect(result.spec.statesClass).toBe('custom.State');
    expect(result.spec.eventsClass).toBe('custom.Event');
    expect(result.spec.startState).toBe('Init');
    expect(result.spec.states[0]?.name).toBe('Init');
    expectTransition(result.spec, 'PaymentReceived', 'ValidationPassed', 'Init', ['persist-payment']);
    expectTransition(result.spec, 'Init', 'DupCheckPassed', 'SpmCheck');
    expect(result.spec.states.some((state) => state.name === 'Completed')).toBe(true);
  });

  it('orders generated states with Init first, non-terminals next, and terminals last', () => {
    const result = scenariosToWorkflowSpec(
      makeScenario([
        makeSubFlow('Current', [
          makeRow('PENDING', 'VALIDATED'),
          makeRow('PENDING', 'BALANCE_CHECK_PENDING'),
          makeRow('PENDING', 'POSTING_PENDING'),
          makeRow('COMPLETE', 'POSTING_COMPLETE')
        ])
      ]),
      null,
      [],
      'WF',
      'BR',
      'OUTGOING'
    );

    expect(result.spec.startState).toBe('Init');
    expect(result.spec.states.map((state) => state.name)).toEqual([
      'Init',
      'BalanceCheckPending',
      'NormalPostingPending',
      'FinalPostingComplete',
      'TxnRejectedOnGLSTechError',
      'TxnRejectedOnNSF'
    ]);
  });
});




describe('hardening guards', () => {
  it('prefers presetSpec knowledge before later presets during FSM generation', () => {
    const preferredPreset: WorkflowSpec = {
      workflowKey: 'PREFERRED',
      states: [
        {
          name: 'Alpha',
          onEvent: {
            PreferredEvent: { target: 'Beta', actions: ['preferred-action'] }
          }
        },
        {
          name: 'Beta',
          onEvent: {}
        }
      ]
    };
    const laterPreset: WorkflowSpec = {
      workflowKey: 'LATER',
      states: [
        {
          name: 'Alpha',
          onEvent: {
            LaterEvent: { target: 'Beta', actions: ['later-action'] }
          }
        }
      ]
    };

    const result = scenariosToWorkflowSpec(
      makeScenario([makeSubFlow('Current', [makeRow('PENDING', 'ALPHA'), makeRow('PENDING', 'BETA')])]),
      preferredPreset,
      [laterPreset],
      'WF',
      'BR',
      'OUTGOING'
    );

    expectTransition(result.spec, 'Alpha', 'PreferredEvent', 'Beta', ['preferred-action']);
    expect(getState(result.spec, 'Alpha')?.onEvent.LaterEvent).toBeUndefined();
  });

  it('reuses exact BR outgoing preset actions for self-loop transitions before fallback templates', () => {
    const presetKnowledge = makeBrOutgoingKnowledgePreset();
    const result = scenariosToWorkflowSpec(
      makeScenario([
        makeSubFlow('Main path', [
          makeRow('PENDING', 'VALIDATED'),
          makeRow('PENDING', 'SPM_SENT'),
          makeRow('PENDING', 'SANCTIONS_SENT'),
          makeRow('PENDING', 'OFAC_POSSIBLE_HIT'),
          makeRow('PENDING', 'BALANCE_CHECK_PENDING'),
          makeRow('SENT_TO_CLEARING', 'POSTING_PENDING_CLEARING_INFORMED'),
          makeRow('SENT_TO_CLEARING', 'POSTING_COMPLETE_CLEARING_INFORMED'),
          makeRow('COMPLETE', 'POSTING_COMPLETE')
        ]),
        makeSubFlow('Repair path', [
          makeRow('PENDING', 'VALIDATED'),
          makeRow('PENDING', 'SPM_SENT'),
          makeRow('PENDING', 'SANCTIONS_SENT'),
          makeRow('PENDING', 'SANCTIONS_RESP_REPAIR')
        ])
      ]),
      null,
      [presetKnowledge],
      'WF',
      'BR',
      'OUTGOING',
      {
        customDirectMap: {
          SANCTIONS_RESP_REPAIR: 'SanctionsRespRepair'
        }
      }
    );

    expect(result.spec.startState).toBe('Init');
    expect(result.spec.states[0]?.name).toBe('Init');
    expectTransition(result.spec, 'SanctionsSent', 'SanctionsResponseReceived', 'SanctionsSent', ['process-sanctions-response']);
    expectTransition(result.spec, 'SanctionsSent', 'OnRetry', 'SanctionsSent', [
      'reset-mtp',
      'send-sanctions-request',
      'persist-txn'
    ]);
    expectTransition(result.spec, 'SanctionsRespRepair', 'OnRetry', 'SanctionsSent', [
      'reset-mtp',
      'send-sanctions-request',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    expectTransition(result.spec, 'BalanceCheckPending', 'BalanceCheckResult', 'BalanceCheckPending', [
      'process-balance-check-result-br-outgoing'
    ]);
    expectTransition(result.spec, 'OfacPossibleHit', 'SanctionsFalseMatch', 'BalanceCheckPending', [
      'process-false-match-br-outgoing',
      'do-balance-check',
      'persist-txn',
      'notify-bd-intermediate'
    ]);
    expectTransition(result.spec, 'SendClearingPostingPending', 'ClearingResponseReceived', 'SendClearingPostingPending', [
      'process-clearing-response-br'
    ]);
    expectTransition(result.spec, 'SendClearingPostingPending', 'PostingFailure', 'SendClearingPostingPending', [
      'process-posting-error-br'
    ]);
    expect(result.presetBackedTransitionKeys?.has('SanctionsSent::OnRetry')).toBe(true);
    expect(result.presetBackedTransitionKeys?.has('SendClearingPostingPending::PostingFailure')).toBe(true);
  });

  it('avoids case-insensitive duplicate event names when preset events conflict with generated ones', () => {
    const preset: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'Init',
          onEvent: {
            dupcheckpassed: { target: 'LegacyState', actions: ['legacy-action'] }
          }
        },
        {
          name: 'LegacyState',
          onEvent: {}
        }
      ]
    };

    const result = scenariosToWorkflowSpec(
      makeScenario([makeSubFlow('Current', [makeRow('PENDING', 'VALIDATED'), makeRow('PENDING', 'SPM_SENT')])]),
      preset,
      [preset],
      'WF',
      'BR',
      'OUTGOING'
    );

    const eventNames = Object.keys(getState(result.spec, 'Init')?.onEvent ?? {});
    expect(eventNames).toContain('dupcheckpassed');
    expect(eventNames).toContain('DupCheckPassedToSpmCheck');
    expect(eventNames.map((eventName) => eventName.toUpperCase())).toEqual(
      [...new Set(eventNames.map((eventName) => eventName.toUpperCase()))]
    );
    expect(result.lint.errors.filter((issue) => issue.field === 'event')).toHaveLength(0);
  });

  it('chooses the warehoused release target alphabetically on ties', () => {
    const result = scenariosToWorkflowSpec(
      makeScenario([
        makeSubFlow('Warehouse release one', [
          makeRow('PENDING', 'VALIDATED'),
          makeRow('PENDING', 'WAREHOUSED'),
          makeRow('PENDING', 'BBB_TARGET')
        ]),
        makeSubFlow('Warehouse release two', [
          makeRow('PENDING', 'VALIDATED'),
          makeRow('PENDING', 'WAREHOUSED'),
          makeRow('PENDING', 'AAA_TARGET')
        ])
      ]),
      null,
      [],
      'WF',
      'BR',
      'OUTGOING'
    );

    expectTransition(result.spec, 'Warehoused', 'OnRelease', 'AaaTarget');
  });

  it('keeps incoming rule K dormant when no incoming states are discovered', () => {
    const result = scenariosToWorkflowSpec(
      makeScenario([makeSubFlow('Current', [makeRow('PENDING', 'VALIDATED')])]),
      null,
      [],
      'WF',
      'BR',
      'INCOMING'
    );

    expect(result.spec.states.some((state) => state.name === 'IncomingClearingReceived')).toBe(false);
    expect(
      listAllTransitions(result.spec).some(
        (transition) =>
          transition.from === 'IncomingClearingReceived' || transition.eventName.startsWith('IncomingClearing')
      )
    ).toBe(false);
  });

  it('preserves preset state ordering and start-state fallback when preset startState is absent', () => {
    const preset: WorkflowSpec = {
      workflowKey: 'WF',
      statesClass: 'custom.State',
      eventsClass: 'custom.Event',
      states: [
        {
          name: 'PresetStart',
          onEvent: {}
        },
        {
          name: 'LaterState',
          onEvent: {}
        }
      ]
    };

    const result = scenariosToWorkflowSpec([], preset, undefined, 'WF', 'BR', 'OUTGOING');

    expect(result.spec.startState).toBe('PresetStart');
    expect(result.spec.states.map((state) => state.name)).toEqual(['PresetStart', 'LaterState']);
    expect(result.spec.states.some((state) => state.name === 'Init')).toBe(false);
    expect(result.lint.warnings.length).toBeGreaterThan(0);
  });

  it('reorders preset-backed output so Init stays first when it is the start state', () => {
    const preset: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'BalanceCheckPending',
          onEvent: {
            NotifyPosting: { target: 'FinalPostingComplete', actions: ['notify'] }
          }
        },
        {
          name: 'FinalPostingComplete',
          onEvent: {}
        },
        {
          name: 'Init',
          onEvent: {
            DupCheckPassed: { target: 'BalanceCheckPending', actions: ['dup-check'] }
          }
        }
      ]
    };

    const result = scenariosToWorkflowSpec([], preset, [preset], 'WF', 'BR', 'OUTGOING');

    expect(result.spec.startState).toBe('Init');
    expect(result.spec.states.map((state) => state.name)).toEqual([
      'Init',
      'BalanceCheckPending',
      'FinalPostingComplete'
    ]);
  });
});


describe('analysis-driven synthesis', () => {
  it('can include analysis summary in conversion preview without breaking existing callers', () => {
    const scenarios = makeScenario([
      makeSubFlow('Posting path', [
        makeRow('PENDING', 'VALIDATED'),
        makeRow('PENDING', 'BALANCE_CHECK_PENDING'),
        makeRow('PENDING', 'POSTING_PENDING'),
        makeRow('COMPLETE', 'POSTING_COMPLETE')
      ])
    ]);

    expect(
      previewConversion(scenarios, {
        includeAnalysisSummary: true,
        countryCode: 'BR',
        direction: 'OUTGOING'
      })
    ).toEqual({
      scenarioCount: 1,
      totalRows: 4,
      discoveredStateCount: 4,
      topArchetype: 'OUTGOING_SIMPLE_POSTING',
      warningCount: 0,
      conflictCount: 0
    });
  });

  it('blocks FSM generation when analysis finds a hard ambiguity', () => {
    const scenarios = makeScenario([
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

    expect(() => scenariosToWorkflowSpec(scenarios, null, [], 'WF', 'BR', 'OUTGOING')).toThrow(
      /BALANCE_TARGET_AMBIGUOUS/
    );
  });
});


describe('validation-driven generation', () => {
  it('returns validation and replay details on successful generation', () => {
    const result = scenariosToWorkflowSpec(
      makeScenario([
        makeSubFlow('Current', [
          makeRow('PENDING', 'VALIDATED'),
          makeRow('PENDING', 'BALANCE_CHECK_PENDING'),
          makeRow('PENDING', 'POSTING_PENDING'),
          makeRow('COMPLETE', 'POSTING_COMPLETE')
        ])
      ]),
      null,
      [],
      'WF',
      'BR',
      'OUTGOING'
    );

    expect(result.analysis).toBeDefined();
    expect(result.graphValidation).toEqual(expect.objectContaining({ hasErrors: false }));
    expect(result.scenarioReplay).toEqual(expect.objectContaining({ failedCount: 0, passedCount: 1 }));
  });

  it('returns KB-backed and fallback transition provenance for introduced transitions', () => {
    const presetKnowledge: WorkflowSpec = {
      workflowKey: 'KB',
      states: [
        {
          name: 'Init',
          onEvent: {
            KnownDupCheck: { target: 'SpmCheck', actions: ['known-dup-check'] }
          }
        },
        {
          name: 'SpmCheck',
          onEvent: {}
        }
      ]
    };

    const result = scenariosToWorkflowSpec(
      makeScenario([makeSubFlow('Current', [makeRow('PENDING', 'VALIDATED'), makeRow('PENDING', 'SPM_SENT')])]),
      null,
      [presetKnowledge],
      'WF',
      'BR',
      'OUTGOING'
    );

    expect(result.presetBackedTransitionKeys).toBeDefined();
    expect(result.fallbackTransitionKeys).toBeDefined();
    expect(result.presetBackedTransitionKeys?.has('Init::KnownDupCheck')).toBe(true);
    expect(result.fallbackTransitionKeys?.size).toBeGreaterThan(0);
    expect(result.newTransitions).toEqual(
      new Set([...(result.presetBackedTransitionKeys ?? []), ...(result.fallbackTransitionKeys ?? [])])
    );
  });

  it('surfaces partial analysis details when generation fails on a hard conflict', () => {
    const scenarios = makeScenario([
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

    try {
      scenariosToWorkflowSpec(scenarios, null, [], 'WF', 'BR', 'OUTGOING');
      throw new Error('Expected generation to fail');
    } catch (error) {
      const candidate = error as Error & { analysis?: { conflicts?: Array<{ code: string }> } };
      expect(candidate.message).toMatch(/BALANCE_TARGET_AMBIGUOUS/);
      expect(candidate.analysis?.conflicts?.[0]?.code).toBe('BALANCE_TARGET_AMBIGUOUS');
    }
  });

  it('does not add a balance-check clearing branch without supporting evidence', () => {
    const result = scenariosToWorkflowSpec(
      makeScenario([
        makeSubFlow('Posting path', [
          makeRow('PENDING', 'VALIDATED'),
          makeRow('PENDING', 'BALANCE_CHECK_PENDING'),
          makeRow('PENDING', 'POSTING_PENDING'),
          makeRow('COMPLETE', 'POSTING_COMPLETE')
        ]),
        makeSubFlow('Clearing path', [
          makeRow('PENDING', 'VALIDATED'),
          makeRow('SENT_TO_CLEARING', 'POSTING_PENDING_CLEARING_INFORMED'),
          makeRow('SENT_TO_CLEARING', 'POSTING_COMPLETE_CLEARING_INFORMED')
        ])
      ]),
      null,
      [],
      'WF',
      'BR',
      'OUTGOING'
    );

    expect(getState(result.spec, 'BalanceCheckPending')?.onEvent.OutgoingSendToClearingWithAckAndPosting).toBeUndefined();
    expectTransition(result.spec, 'BalanceCheckPending', 'NotifyB2BToClearingAndPosting', 'NormalPostingPending');
  });

  it('fails generation when graph validation finds a hard warehousing error', () => {
    const scenarios = makeScenario([
      makeSubFlow('Warehouse park only', [makeRow('PENDING', 'VALIDATED'), makeRow('PENDING', 'WAREHOUSED')])
    ]);

    expect(() => scenariosToWorkflowSpec(scenarios, null, [], 'WF', 'BR', 'OUTGOING')).toThrow(
      /WAREHOUSED_RELEASE_MISSING/
    );
  });
});

