import type { WorkflowSpec } from '../../../models/snapshot';
import type { FsmGenerationOptions } from '../scenariosToFsm';
import type { FlowDirection, ScenarioCategory, StatusRow, SubFlow } from '../types';

const DEFAULT_STATES_CLASS = 'com.citi.cpx.statemanager.fsm.State';
const DEFAULT_EVENTS_CLASS = 'com.citi.cpx.statemanager.fsm.Event';

function transition(target: string, actions: string[]) {
  return { target, actions };
}

function row(
  msgStatus: string,
  msgSubStatus: string,
  transactionStatus: string,
  transactionStatusReason: string,
  reasonDescription: string
): Omit<StatusRow, 'id'> {
  return {
    msgStatus,
    msgSubStatus,
    channelPushNotification: false,
    cdmNotification: false,
    transactionStatus,
    transactionStatusReason,
    reasonDescription
  };
}

function createSubFlow(id: string, title: string, rows: Array<Omit<StatusRow, 'id'>>): SubFlow {
  return {
    id,
    title,
    rows: rows.map((seed, index) => ({ id: `${id}-row-${index + 1}`, ...seed }))
  };
}

export const BR_OUTGOING_WORKFLOW_KEY = 'BR_OUTGOING_PAYMENT';
export const BR_OUTGOING_COUNTRY_CODE = 'BR';
export const BR_OUTGOING_DIRECTION: FlowDirection = 'OUTGOING';
export const BR_OUTGOING_GENERATION_OPTIONS: FsmGenerationOptions = {
  skipObservedTransitions: true
};

export const BR_OUTGOING_ACTUAL_SPEC: WorkflowSpec = {
  workflowKey: BR_OUTGOING_WORKFLOW_KEY,
  statesClass: DEFAULT_STATES_CLASS,
  eventsClass: DEFAULT_EVENTS_CLASS,
  startState: 'Init',
  states: [
    {
      name: 'Init',
      onEvent: {
        DupCheckCompleted: transition('Init', ['on-dup-check-completed']),
        DupCheckPassed: transition('SpmCheck', ['on-dup-check-passed', 'do-spm-check', 'notify-proxy-svc-br-outgoing']),
        DupCheckFailed: transition('DuplicatePayment', [
          'on-dup-check-failed',
          'notify-client-final-nack-outgoing',
          'persist-txn',
          'notify-bd-error'
        ])
      }
    },
    {
      name: 'SpmCheck',
      onEvent: {
        SpmEnabled: transition('SpmSent', ['do-pre-sanctions-enrichment', 'persist-txn']),
        SpmDisabled: transition('SanctionsSent', ['send-sanctions-request', 'persist-txn', 'notify-bd-intermediate'])
      }
    },
    {
      name: 'SpmSent',
      onEvent: {
        SpmEnrichmentSuccessful: transition('PreSanctionsResultCheck', ['save-spm-result', 'process-spm-result']),
        SpmEnrichmentError: transition('SpmError', ['save-spm-error-result', 'persist-txn', 'notify-bd-error']),
        SpmEnrichmentFailed: transition('SpmFailed', ['save-spm-failed-result', 'persist-txn', 'notify-bd-error']),
        OnRetry: transition('SpmSent', ['reset-mtp', 'do-pre-sanctions-enrichment', 'persist-txn'])
      }
    },
    {
      name: 'SpmError',
      onEvent: {
        OnRetry: transition('SpmSent', ['reset-mtp', 'do-pre-sanctions-enrichment', 'persist-txn'])
      }
    },
    {
      name: 'SpmFailed',
      onEvent: {
        OnRetry: transition('SpmSent', ['reset-mtp', 'do-pre-sanctions-enrichment', 'persist-txn'])
      }
    },
    {
      name: 'PreSanctionsResultCheck',
      onEvent: {
        SkipSanctions: transition('BalanceCheckPending', ['do-balance-check', 'persist-txn', 'notify-bd-intermediate']),
        NeedSanctions: transition('SanctionsSent', ['send-sanctions-request', 'persist-txn', 'notify-bd-intermediate'])
      }
    },
    {
      name: 'SanctionsSent',
      onEvent: {
        SanctionsResponseReceived: transition('SanctionsSent', ['process-sanctions-response']),
        SanctionsNoHit: transition('BalanceCheckPending', ['do-balance-check', 'persist-txn', 'notify-bd-intermediate']),
        SanctionsOfacPossibleHit: transition('OfacPossibleHit', ['persist-txn', 'notify-bd-intermediate']),
        SanctionsException: transition('SanctionsRespRepair', ['process-sanctions-error', 'persist-txn']),
        OnRetry: transition('SanctionsSent', ['reset-mtp', 'send-sanctions-request', 'persist-txn'])
      }
    },
    {
      name: 'OfacPossibleHit',
      onEvent: {
        SanctionsException: transition('OfacPossibleHit', ['process-sanctions-error', 'notify-bd-error']),
        SanctionsResponseReceived: transition('OfacPossibleHit', ['process-sanctions-final-response']),
        SanctionsFalseMatch: transition('BalanceCheckPending', [
          'process-false-match-br-outgoing',
          'do-balance-check',
          'persist-txn',
          'notify-bd-intermediate'
        ]),
        SanctionsRejectReport: transition('SanctionsReject', [
          'do-sanctions-reject',
          'notify-client-final-nack-outgoing',
          'persist-txn',
          'notify-bd-final'
        ]),
        SanctionsBlockReport: transition('SanctionsSeized', [
          'do-sanctions-seize',
          'notify-client-final-nack-outgoing',
          'persist-txn',
          'notify-bd-final'
        ]),
        SanctionsCancelled: transition('SanctionsCancelled', [
          'do-sanctions-cancel',
          'notify-client-final-nack-outgoing',
          'persist-txn',
          'notify-bd-final'
        ])
      }
    },
    {
      name: 'SanctionsRespRepair',
      onEvent: {
        OnRetry: transition('SanctionsSent', ['reset-mtp', 'send-sanctions-request', 'persist-txn', 'notify-bd-intermediate'])
      }
    },
    {
      name: 'BalanceCheckPending',
      onEvent: {
        BalanceCheckResult: transition('BalanceCheckPending', ['process-balance-check-result-br-outgoing']),
        OutgoingSendToClearingWithAckAndPosting: transition('SendClearingPostingPending', [
          'send-to-clearing-for-br-outgoing',
          'do-normal-outgoing-posting',
          'persist-txn',
          'notify-bd-intermediate'
        ]),
        NotifyB2BToClearingAndPosting: transition('NormalPostingPending', [
          'notify-client-final-ack-outgoing',
          'notify-b2b-to-clearing-for-br-outgoing',
          'do-normal-b2b-posting',
          'persist-txn',
          'notify-bd-intermediate'
        ]),
        BalanceCheckNSFErrorTimeOut: transition('TxnRejectedOnNSF', [
          'notify-client-final-nack-outgoing',
          'persist-txn',
          'notify-bd-error'
        ]),
        BalanceCheckGLSTechErrorTimeOut: transition('TxnRejectedOnGLSTechError', [
          'notify-client-final-nack-outgoing',
          'persist-txn',
          'notify-bd-error'
        ])
      }
    },
    {
      name: 'SendClearingPostingPending',
      onEvent: {
        ClearingResponseReceived: transition('SendClearingPostingPending', ['process-clearing-response-br']),
        ClearingResponseACCC: transition('NormalPostingPending', [
          'notify-client-final-ack-outgoing',
          'persist-txn',
          'notify-bd-intermediate'
        ]),
        ClearingResponseRJCT: transition('ClrRejectedOrgPostingPending', [
          'notify-client-final-nack-outgoing',
          'reverse-outgoing-payment',
          'persist-txn',
          'notify-bd-intermediate'
        ]),
        PostingSuccess: transition('SendClearingPostingComplete', ['process-normal-outgoing-posting-success', 'persist-txn']),
        PostingFailure: transition('SendClearingPostingPending', ['process-posting-error-br']),
        PostingFailureRecoverable: transition('SendClearingPostingPending', ['persist-txn'])
      }
    },
    {
      name: 'SendClearingPostingComplete',
      onEvent: {
        ClearingResponseReceived: transition('SendClearingPostingComplete', ['process-clearing-response-br']),
        ClearingResponseACCC: transition('FinalPostingComplete', [
          'notify-client-final-ack-outgoing',
          'persist-txn',
          'notify-bd-final'
        ]),
        ClearingResponseRJCT: transition('ClearingRejectPostingComplete', [
          'notify-client-final-nack-outgoing',
          'reverse-outgoing-payment',
          'persist-txn',
          'notify-bd-final'
        ])
      }
    },
    {
      name: 'NormalPostingPending',
      onEvent: {
        PostingSuccess: transition('FinalPostingComplete', [
          'process-normal-outgoing-posting-success',
          'persist-txn',
          'notify-bd-final'
        ]),
        PostingFailure: transition('NormalPostingPending', ['process-posting-error-br']),
        PostingFailureRecoverable: transition('NormalPostingPending', ['persist-txn'])
      }
    },
    {
      name: 'ClrRejectedOrgPostingPending',
      onEvent: {
        PostingSuccess: transition('ClearingRejectPostingComplete', ['persist-txn', 'notify-bd-final']),
        PostingFailure: transition('ClrRejectedOrgPostingPending', ['process-posting-error-br']),
        PostingFailureRecoverable: transition('ClrRejectedOrgPostingPending', ['persist-txn'])
      }
    },
    { name: 'FinalPostingComplete', onEvent: {} },
    { name: 'DuplicatePayment', onEvent: {} },
    { name: 'SanctionsReject', onEvent: {} },
    { name: 'SanctionsCancelled', onEvent: {} },
    { name: 'SanctionsSeized', onEvent: {} },
    { name: 'TxnRejectedOnNSF', onEvent: {} },
    { name: 'TxnRejectedOnGLSTechError', onEvent: {} },
    { name: 'ClearingRejectPostingComplete', onEvent: {} }
  ]
};

export const BR_OUTGOING_SEED_SCENARIOS: ScenarioCategory[] = [
  {
    id: 'br-outgoing-seed',
    name: 'BR Outgoing Validation Seeds',
    description: 'Deterministic seed scenarios used to validate BR outgoing FSM parity.',
    hasScenarioColumn: false,
    hasResponsibleColumn: false,
    hasTriggerReversalColumn: false,
    subFlows: [
      createSubFlow('happy-clearing', 'Happy clearing path', [
        row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted.'),
        row('PENDING', 'RECEIVED_FOR_PROCESSING', 'PDNG', 'PROCESSING', 'Payment queued for processing.'),
        row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request submitted.'),
        row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Sanctions screening requested.'),
        row('PENDING', 'BALANCE_CHECK_PENDING', 'PDNG', 'LIQUIDITY_CHECK', 'Balance validation pending.'),
        row('SENT_TO_CLEARING', 'POSTING_PENDING_CLEARING_INFORMED', 'PDNG', 'CLEARING_PENDING', 'Clearing informed.'),
        row('SENT_TO_CLEARING', 'POSTING_COMPLETE_CLEARING_INFORMED', 'PDNG', 'CLEARING_ACKNOWLEDGED', 'Posting completed before clearing response.'),
        row('COMPLETE', 'POSTING_COMPLETE', 'ACCC', 'COMPLETED', 'Payment completed.')
      ]),
      createSubFlow('happy-posting', 'Posting-only path', [
        row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted.'),
        row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request submitted.'),
        row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Sanctions screening requested.'),
        row('PENDING', 'BALANCE_CHECK_PENDING', 'PDNG', 'LIQUIDITY_CHECK', 'Balance validation pending.'),
        row('PENDING', 'POSTING_PENDING', 'PDNG', 'POSTING_INITIATED', 'Posting request submitted.'),
        row('COMPLETE', 'POSTING_COMPLETE', 'ACCC', 'COMPLETED', 'Payment completed.')
      ]),
      createSubFlow('clearing-reject', 'Clearing reject path', [
        row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted.'),
        row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request submitted.'),
        row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Sanctions screening requested.'),
        row('PENDING', 'BALANCE_CHECK_PENDING', 'PDNG', 'LIQUIDITY_CHECK', 'Balance validation pending.'),
        row('SENT_TO_CLEARING', 'POSTING_PENDING_CLEARING_INFORMED', 'PDNG', 'CLEARING_PENDING', 'Clearing informed.'),
        row('REJECTED', 'CLEARING_REJECT_POSTING_PENDING', 'RJCT', 'CLEARING_REJECTED', 'Clearing rejected before posting completion.'),
        row('REJECTED', 'CLEARING_REJECT_POSTING_COMPLETE', 'RJCT', 'FINAL_REJECTED', 'Clearing rejection completed.')
      ]),
      createSubFlow('duplicate-payment', 'Duplicate payment', [
        row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted.'),
        row('REJECTED', 'DUPLICATE', 'RJCT', 'DUPLICATE', 'Duplicate payment detected.')
      ]),
      createSubFlow('spm-error', 'SPM error path', [
        row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted.'),
        row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request submitted.'),
        row('REJECTED', 'SPM_ERROR', 'RJCT', 'SPM_ERROR', 'SPM error returned.')
      ]),
      createSubFlow('spm-failed', 'SPM failed path', [
        row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted.'),
        row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request submitted.'),
        row('REJECTED', 'SPM_FAILED', 'RJCT', 'SPM_FAILED', 'SPM failed response returned.')
      ]),
      createSubFlow('ofac-false-match', 'OFAC false match path', [
        row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted.'),
        row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request submitted.'),
        row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Sanctions screening requested.'),
        row('PENDING', 'OFAC_POSSIBLE_HIT', 'PDNG', 'OFAC_REVIEW', 'Possible OFAC hit identified.'),
        row('PENDING', 'BALANCE_CHECK_PENDING', 'PDNG', 'LIQUIDITY_CHECK', 'False match cleared and balance validation resumed.'),
        row('SENT_TO_CLEARING', 'POSTING_PENDING_CLEARING_INFORMED', 'PDNG', 'CLEARING_PENDING', 'Clearing informed after false match resolution.'),
        row('SENT_TO_CLEARING', 'POSTING_COMPLETE_CLEARING_INFORMED', 'PDNG', 'CLEARING_ACKNOWLEDGED', 'Posting completed before clearing response.'),
        row('COMPLETE', 'POSTING_COMPLETE', 'ACCC', 'COMPLETED', 'Payment completed.')
      ]),
      createSubFlow('sanctions-reject', 'Sanctions reject path', [
        row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted.'),
        row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request submitted.'),
        row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Sanctions screening requested.'),
        row('PENDING', 'OFAC_POSSIBLE_HIT', 'PDNG', 'OFAC_REVIEW', 'Possible OFAC hit identified.'),
        row('REJECTED', 'SANCTION_REJECTED', 'RJCT', 'SANCTIONS_REJECTED', 'Sanctions rejected the payment.')
      ]),
      createSubFlow('sanctions-cancel', 'Sanctions cancel path', [
        row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted.'),
        row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request submitted.'),
        row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Sanctions screening requested.'),
        row('PENDING', 'OFAC_POSSIBLE_HIT', 'PDNG', 'OFAC_REVIEW', 'Possible OFAC hit identified.'),
        row('CANCELLED', 'SANCTION_CANCELLED', 'RJCT', 'SANCTIONS_CANCELLED', 'Sanctions cancelled the payment.')
      ]),
      createSubFlow('sanctions-seize', 'Sanctions seize path', [
        row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted.'),
        row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request submitted.'),
        row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Sanctions screening requested.'),
        row('PENDING', 'OFAC_POSSIBLE_HIT', 'PDNG', 'OFAC_REVIEW', 'Possible OFAC hit identified.'),
        row('SEIZED', 'SANCTIONS_SEIZED', 'RJCT', 'SANCTIONS_SEIZED', 'Sanctions seized the payment.')
      ]),
      createSubFlow('sanctions-repair', 'Sanctions repair path', [
        row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted.'),
        row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request submitted.'),
        row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Sanctions screening requested.'),
        row('PENDING', 'SANCTIONS_RESP_REPAIR', 'PDNG', 'SANCTIONS_REPAIR', 'Sanctions response requires repair.')
      ])
    ]
  }
];

