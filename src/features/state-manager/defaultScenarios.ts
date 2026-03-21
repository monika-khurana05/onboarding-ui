import type {
  FlowDirection,
  ScenarioCategory,
  StateManagerConfig,
  StatusRow,
  SubFlow
} from './types';

type StatusRowSeed = Omit<StatusRow, 'id'>;

type SubFlowSeed = {
  title: string;
  rows: StatusRowSeed[];
};

type ScenarioSeed = Omit<ScenarioCategory, 'id' | 'subFlows'> & {
  subFlows: SubFlowSeed[];
};

function createIdFactory(): () => string {
  let counter = 0;
  return () => `default-${++counter}`;
}

function row(
  msgStatus: StatusRow['msgStatus'],
  msgSubStatus: StatusRow['msgSubStatus'],
  transactionStatus: StatusRow['transactionStatus'],
  transactionStatusReason: string,
  reasonDescription: string,
  overrides: Partial<
    Omit<
      StatusRowSeed,
      | 'msgStatus'
      | 'msgSubStatus'
      | 'transactionStatus'
      | 'transactionStatusReason'
      | 'reasonDescription'
    >
  > = {}
): StatusRowSeed {
  return {
    msgStatus,
    msgSubStatus,
    channelPushNotification: false,
    cdmNotification: false,
    transactionStatus,
    transactionStatusReason,
    reasonDescription,
    ...overrides
  };
}

const DEFAULT_SCENARIO_SEEDS: ScenarioSeed[] = [
  {
    name: 'Happy Flow Non BOOK',
    description: 'Status transitions for current-dated and future-dated non-BOOK payment happy paths.',
    hasScenarioColumn: false,
    hasResponsibleColumn: false,
    hasTriggerReversalColumn: false,
    subFlows: [
      {
        title: 'Happy Flow - Current dated payment',
        rows: [
          row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted for processing.'),
          row(
            'PENDING',
            'RECEIVED_FOR_PROCESSING',
            'PDNG',
            'PROCESSING',
            'Payment queued for orchestration.'
          ),
          row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request sent.'),
          row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Sanctions screening requested.'),
          row('PENDING', 'BALANCE_CHECK_PENDING', 'PDNG', 'LIQUIDITY_CHECK', 'Balance validation pending.'),
          row('PENDING', 'POSTING_PENDING', 'PDNG', 'POSTING_INITIATED', 'Posting request submitted.'),
          row(
            'SENT_TO_CLEARING',
            'POSTING_PENDING_CLEARING_INFORMED',
            'PDNG',
            'CLEARING_PENDING',
            'Clearing informed while posting remains pending.',
            { cdmNotification: true }
          ),
          row(
            'COMPLETE',
            'POSTING_COMPLETE_CLEARING_INFORMED',
            'ACCC',
            'COMPLETED',
            'Payment completed and clearing was informed.',
            { channelPushNotification: true, cdmNotification: true }
          )
        ]
      },
      {
        title: 'Happy Flow - Future dated payment',
        rows: [
          row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Future-dated payment accepted for processing.'),
          row(
            'PENDING',
            'RECEIVED_FOR_PROCESSING',
            'PDNG',
            'PROCESSING',
            'Future-dated payment queued for orchestration.'
          ),
          row('PENDING', 'WAREHOUSED', 'PDNG', 'VALUE_DATE_PENDING', 'Payment warehoused until value date.'),
          row('PENDING', 'WAREHOUSED', 'PDNG', 'RELEASE_WINDOW_OPEN', 'Value date reached and release is pending.'),
          row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request sent after warehouse release.'),
          row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Sanctions screening requested after release.'),
          row('PENDING', 'BALANCE_CHECK_PENDING', 'PDNG', 'LIQUIDITY_CHECK', 'Balance validation pending on release.'),
          row('PENDING', 'POSTING_PENDING', 'PDNG', 'POSTING_INITIATED', 'Posting request submitted after value date.'),
          row(
            'SENT_TO_CLEARING',
            'POSTING_PENDING_CLEARING_INFORMED',
            'PDNG',
            'CLEARING_PENDING',
            'Clearing informed while posting remains pending after release.',
            { cdmNotification: true }
          ),
          row(
            'SENT_TO_CLEARING',
            'POSTING_COMPLETE_CLEARING_INFORMED',
            'PDNG',
            'CLEARING_ACKNOWLEDGED',
            'Posting completed and clearing acknowledged the update.',
            { cdmNotification: true }
          ),
          row(
            'COMPLETE',
            'POSTING_COMPLETE',
            'ACCC',
            'COMPLETED',
            'Future-dated payment completed on value date.',
            { channelPushNotification: true, cdmNotification: true }
          )
        ]
      }
    ]
  },
  {
    name: 'Happy Flow BOOK',
    description: 'Status transitions for current-dated and future-dated BOOK transfer happy paths.',
    hasScenarioColumn: false,
    hasResponsibleColumn: false,
    hasTriggerReversalColumn: false,
    subFlows: [
      {
        title: 'Happy Flow - Current dated BOOK Transfer',
        rows: [
          row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'BOOK transfer accepted for processing.'),
          row('PENDING', 'RECEIVED_FOR_PROCESSING', 'PDNG', 'PROCESSING', 'BOOK transfer queued for orchestration.'),
          row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'BOOK transfer sent to SPM screening.'),
          row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'BOOK transfer sent for sanctions screening.'),
          row('PENDING', 'BALANCE_CHECK_PENDING', 'PDNG', 'LIQUIDITY_CHECK', 'BOOK transfer balance validation pending.'),
          row('PENDING', 'POSTING_PENDING', 'PDNG', 'BOOKING_INITIATED', 'Ledger booking request submitted.'),
          row('PENDING', 'POSTING_COMPLETE', 'PDNG', 'BOOKED', 'Ledger updated for the BOOK transfer.'),
          row(
            'COMPLETE',
            'POSTING_COMPLETE',
            'ACCC',
            'COMPLETED',
            'BOOK transfer completion confirmed.',
            { channelPushNotification: true, cdmNotification: true }
          )
        ]
      },
      {
        title: 'Happy Flow - Future dated BOOK Transfer',
        rows: [
          row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Future-dated BOOK transfer accepted for processing.'),
          row(
            'PENDING',
            'RECEIVED_FOR_PROCESSING',
            'PDNG',
            'PROCESSING',
            'Future-dated BOOK transfer queued for orchestration.'
          ),
          row('PENDING', 'WAREHOUSED', 'PDNG', 'VALUE_DATE_PENDING', 'Future-dated BOOK transfer warehoused.'),
          row('PENDING', 'WAREHOUSED', 'PDNG', 'BOOKING_WINDOW_PENDING', 'Waiting for BOOK transfer value-date window.'),
          row('PENDING', 'WAREHOUSED', 'PDNG', 'RELEASE_WINDOW_OPEN', 'BOOK transfer released from warehouse on value date.'),
          row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request sent for released BOOK transfer.'),
          row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Sanctions screening requested for released BOOK transfer.'),
          row('PENDING', 'BALANCE_CHECK_PENDING', 'PDNG', 'LIQUIDITY_CHECK', 'Balance validation pending for released BOOK transfer.'),
          row('PENDING', 'POSTING_PENDING', 'PDNG', 'BOOKING_INITIATED', 'Ledger booking started for released BOOK transfer.'),
          row('PENDING', 'POSTING_PENDING', 'PDNG', 'BOOKING_RETRY', 'Ledger booking retry initiated for released BOOK transfer.'),
          row('PENDING', 'POSTING_COMPLETE', 'PDNG', 'BOOKED', 'Ledger updated for future-dated BOOK transfer.'),
          row(
            'COMPLETE',
            'POSTING_COMPLETE',
            'ACCC',
            'VALUE_DATED',
            'Future-dated BOOK transfer completed on value date.',
            { cdmNotification: true }
          ),
          row(
            'COMPLETE',
            'POSTING_COMPLETE',
            'ACCC',
            'COMPLETED',
            'BOOK transfer final confirmation sent.',
            { channelPushNotification: true, cdmNotification: true }
          )
        ]
      }
    ]
  },
  {
    name: 'Clearing Rejection',
    description: 'Status transitions when clearing rejects the payment.',
    hasScenarioColumn: false,
    hasResponsibleColumn: false,
    hasTriggerReversalColumn: false,
    subFlows: [
      {
        title: 'Clearing Rejection - Current dated Payment',
        rows: [
          row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted before clearing interaction.'),
          row('PENDING', 'RECEIVED_FOR_PROCESSING', 'PDNG', 'PROCESSING', 'Payment queued for orchestration.'),
          row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request sent before clearing.'),
          row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Sanctions screening requested before clearing.'),
          row('PENDING', 'BALANCE_CHECK_PENDING', 'PDNG', 'LIQUIDITY_CHECK', 'Balance validation pending before clearing.'),
          row('PENDING', 'POSTING_PENDING', 'PDNG', 'POSTING_INITIATED', 'Posting request submitted before clearing.'),
          row(
            'SENT_TO_CLEARING',
            'POSTING_PENDING_CLEARING_INFORMED',
            'PDNG',
            'CLEARING_PENDING',
            'Payment sent to clearing while posting remains pending.',
            { cdmNotification: true }
          ),
          row(
            'REJECTED',
            'CLEARING_REJECT_POSTING_PENDING',
            'RJCT',
            'CLEARING_REJECTED',
            'Clearing rejected the payment before posting completed.',
            { cdmNotification: true }
          ),
          row(
            'REJECTED',
            'CLEARING_REJECT_POSTING_COMPLETE',
            'RJCT',
            'FINAL_REJECTED',
            'Clearing rejection persisted after posting reconciliation.',
            { channelPushNotification: true, cdmNotification: true }
          )
        ]
      },
      {
        title: 'Clearing Rejection - Future dated Payment',
        rows: [
          row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Future-dated payment accepted before clearing interaction.'),
          row(
            'PENDING',
            'RECEIVED_FOR_PROCESSING',
            'PDNG',
            'PROCESSING',
            'Future-dated payment queued for orchestration.'
          ),
          row('PENDING', 'WAREHOUSED', 'PDNG', 'VALUE_DATE_PENDING', 'Future-dated payment warehoused before release.'),
          row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'SPM request sent after warehouse release.'),
          row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Sanctions screening requested after release.'),
          row('PENDING', 'BALANCE_CHECK_PENDING', 'PDNG', 'LIQUIDITY_CHECK', 'Balance validation pending before clearing.'),
          row(
            'SENT_TO_CLEARING',
            'POSTING_PENDING_CLEARING_INFORMED',
            'PDNG',
            'CLEARING_PENDING',
            'Payment sent to clearing after future-date release.',
            { cdmNotification: true }
          ),
          row(
            'REJECTED',
            'CLEARING_REJECT_POSTING_PENDING',
            'RJCT',
            'CLEARING_REJECTED',
            'Clearing rejected the future-dated payment before posting completed.',
            { cdmNotification: true }
          ),
          row(
            'REJECTED',
            'CLEARING_REJECT_POSTING_COMPLETE',
            'RJCT',
            'RECONCILED_REJECTED',
            'Clearing rejection reconciled after posting updates.',
            { cdmNotification: true }
          ),
          row(
            'REJECTED',
            'CLEARING_REJECT_POSTING_COMPLETE',
            'RJCT',
            'FINAL_REJECTED',
            'Future-dated clearing rejection confirmation sent.',
            { channelPushNotification: true, cdmNotification: true }
          )
        ]
      }
    ]
  },
  {
    name: 'Business Validation Failed',
    description: 'Status transitions when business validation checks fail.',
    hasScenarioColumn: true,
    hasResponsibleColumn: true,
    hasTriggerReversalColumn: false,
    subFlows: [
      {
        title: 'Account Validation Failed',
        rows: [
          row('RECEIVED', 'VALIDATED', 'PDNG', 'ACCEPTED', 'Payment accepted before business validation.'),
          row(
            'PENDING',
            'RECEIVED_FOR_PROCESSING',
            'PDNG',
            'BUSINESS_VALIDATION_STARTED',
            'Business validation started for the payment.'
          ),
          row(
            'REJECTED',
            'ACCOUNT_INVALID',
            'RJCT',
            'ACCOUNT_INVALID',
            'Rejected because the debtor or creditor account is invalid.',
            {
              scenario: 'Account invalid',
              responsibleComponent: 'Business Validation Service',
              channelPushNotification: true,
              cdmNotification: true
            }
          ),
          row(
            'REJECTED',
            'ACCOUNT_CLOSED',
            'RJCT',
            'ACCOUNT_CLOSED',
            'Rejected because the account is closed.',
            {
              scenario: 'Account closed',
              responsibleComponent: 'Business Validation Service',
              channelPushNotification: true,
              cdmNotification: true
            }
          ),
          row(
            'REJECTED',
            'INVALID_ACCOUNT_CLASS',
            'RJCT',
            'INVALID_ACCOUNT_CLASS',
            'Rejected because the account class is not eligible.',
            {
              scenario: 'Invalid account class',
              responsibleComponent: 'Business Validation Service',
              channelPushNotification: true,
              cdmNotification: true
            }
          ),
          row(
            'REJECTED',
            'TAX_INFO_MISSING',
            'RJCT',
            'TAX_INFO_MISSING',
            'Rejected because tax information is missing.',
            {
              scenario: 'Tax information missing',
              responsibleComponent: 'Business Validation Service',
              channelPushNotification: true,
              cdmNotification: true
            }
          ),
          row(
            'REJECTED',
            'INVALID_TAX_ID',
            'RJCT',
            'INVALID_TAX_ID',
            'Rejected because the tax identifier is invalid.',
            {
              scenario: 'Invalid tax ID',
              responsibleComponent: 'Business Validation Service',
              channelPushNotification: true,
              cdmNotification: true
            }
          ),
          row(
            'REJECTED',
            'ALIAS_NOT_RESOLVED',
            'RJCT',
            'ALIAS_NOT_RESOLVED',
            'Rejected because the alias could not be resolved.',
            {
              scenario: 'Alias not resolved',
              responsibleComponent: 'Business Validation Service',
              channelPushNotification: true,
              cdmNotification: true
            }
          ),
          row(
            'REJECTED',
            'CREDITOR_MEMBERSHIP_INVALID',
            'RJCT',
            'CREDITOR_MEMBERSHIP_INVALID',
            'Rejected because creditor membership is invalid.',
            {
              scenario: 'Creditor membership invalid',
              responsibleComponent: 'Business Validation Service',
              channelPushNotification: true,
              cdmNotification: true
            }
          ),
          row(
            'REJECTED',
            'DUPLICATE',
            'RJCT',
            'DUPLICATE',
            'Rejected because a duplicate payment was detected.',
            {
              scenario: 'Duplicate payment',
              responsibleComponent: 'Business Validation Service',
              channelPushNotification: true,
              cdmNotification: true
            }
          )
        ]
      }
    ]
  },
  {
    name: 'STOP Payment Scenario',
    description: 'Status transitions for stop payment flows across multiple payment states.',
    hasScenarioColumn: false,
    hasResponsibleColumn: false,
    hasTriggerReversalColumn: false,
    subFlows: [
      {
        title: 'STOP Payment Flow - Payment NOT IN OFAC Possible HIT',
        rows: [
          row('PENDING', 'RECEIVED_FOR_PROCESSING', 'PDNG', 'ACTIVE', 'Payment is active in standard processing.'),
          row('PENDING', 'STOP_RECALL_REQUEST', 'PDNG', 'STOP_REQUESTED', 'Stop payment request received.'),
          row(
            'CANCELLED',
            'STOP_RECALL_REQUEST',
            'RJCT',
            'STOP_ACCEPTED',
            'Stop payment approved before sanctions hold.'
          ),
          row(
            'CANCELLED',
            'STOP_RECALL_REQUEST',
            'RJCT',
            'FINAL_CANCELLED',
            'Cancellation confirmed to downstream systems.',
            { channelPushNotification: true, cdmNotification: true }
          )
        ]
      },
      {
        title: 'STOP Payment Flow - Payment IN OFAC Possible HIT',
        rows: [
          row('PENDING', 'SANCTIONS_SENT', 'PDNG', 'SANCTIONS_REQUESTED', 'Payment awaiting sanctions response.'),
          row('PENDING', 'OFAC_POSSIBLE_HIT', 'PDNG', 'OFAC_REVIEW', 'Possible OFAC hit identified.'),
          row('PENDING', 'STOP_RECALL_REQUEST', 'PDNG', 'STOP_REQUESTED', 'Stop request captured during OFAC review.'),
          row('PENDING', 'OFAC_POSSIBLE_HIT', 'PDNG', 'CASE_REVIEW', 'Payment remains on hold during investigation.'),
          row('CANCELLED', 'SANCTION_CANCELLED', 'RJCT', 'STOP_RELEASED', 'Sanctions hold released and payment cancelled.'),
          row('CANCELLED', 'STOP_RECALL_REQUEST', 'RJCT', 'STOP_CONFIRMED', 'Stop payment persisted after hold release.'),
          row(
            'CANCELLED',
            'STOP_RECALL_REQUEST',
            'RJCT',
            'FINAL_CANCELLED',
            'Cancellation confirmation sent to downstream systems.',
            { channelPushNotification: true, cdmNotification: true }
          )
        ]
      },
      {
        title: 'STOP Payment Flow - Payment is warehoused',
        rows: [
          row('PENDING', 'WAREHOUSED', 'PDNG', 'VALUE_DATE_PENDING', 'Payment warehoused pending future date.'),
          row('PENDING', 'STOP_RECALL_REQUEST', 'PDNG', 'STOP_REQUESTED', 'Stop request received for warehoused payment.'),
          row('PENDING', 'WAREHOUSED', 'PDNG', 'CANCELLATION_PENDING', 'Warehoused payment marked for cancellation.'),
          row('CANCELLED', 'STOP_RECALL_REQUEST', 'RJCT', 'STOP_ACCEPTED', 'Warehoused payment cancelled before release.'),
          row('CANCELLED', 'WAREHOUSED', 'RJCT', 'WAREHOUSE_CLOSED', 'Warehouse entry closed without releasing the payment.'),
          row(
            'CANCELLED',
            'STOP_RECALL_REQUEST',
            'RJCT',
            'FINAL_CANCELLED',
            'Cancellation propagated to all systems.',
            { channelPushNotification: true, cdmNotification: true }
          )
        ]
      },
      {
        title: 'STOP Payment Flow - Payment in SPM Lifecycle',
        rows: [
          row('PENDING', 'SPM_SENT', 'PDNG', 'SPM_REQUESTED', 'Payment submitted to SPM.'),
          row('PENDING', 'STOP_RECALL_REQUEST', 'PDNG', 'STOP_REQUESTED', 'Stop request captured during SPM lifecycle.'),
          row('CANCELLED', 'SPM_FAILED', 'RJCT', 'STOP_DURING_SPM', 'SPM path terminated because the payment was stopped.'),
          row(
            'CANCELLED',
            'STOP_RECALL_REQUEST',
            'RJCT',
            'FINAL_CANCELLED',
            'Stop payment completion recorded.',
            { channelPushNotification: true, cdmNotification: true }
          )
        ]
      },
      {
        title: 'STOP Payment Flow - NON PAY statuses',
        rows: [
          row(
            'NON_PAY_COMPLETE',
            'NON_PAY_RECEIVED_FOR_PROCESSING',
            'PDNG',
            'NON_PAY_ACTIVE',
            'Non-pay item received for processing.'
          ),
          row(
            'NON_PAY_COMPLETE',
            'STOP_RECALL_REQUEST',
            'PDNG',
            'NON_PAY_STOP_REQUESTED',
            'Stop request received for non-pay item.'
          ),
          row(
            'NON_PAY_REJECTED',
            'STOP_RECALL_REQUEST',
            'RJCT',
            'NON_PAY_CANCELLED',
            'Non-pay item rejected after stop request.'
          ),
          row(
            'NON_PAY_REJECTED',
            'STOP_RECALL_REQUEST',
            'RJCT',
            'FINAL_REJECTED',
            'Non-pay rejection confirmation sent.',
            { channelPushNotification: true, cdmNotification: true }
          )
        ]
      }
    ]
  },
  {
    name: 'Posting Response Scenario',
    description: 'Status transitions based on posting response categories.',
    hasScenarioColumn: true,
    hasResponsibleColumn: false,
    hasTriggerReversalColumn: false,
    subFlows: [
      {
        title: 'Posting Response',
        rows: [
          row(
            'COMPLETE',
            'POSTING_COMPLETE',
            'ACCC',
            'CATEGORY_A',
            'Posting completed successfully for Category A response.',
            { scenario: 'Category A response', channelPushNotification: true, cdmNotification: true }
          ),
          row(
            'PENDING',
            'POSTING_PENDING_CLEARING_INFORMED',
            'PDNG',
            'CATEGORY_B',
            'Posting remains pending while clearing has been informed for Category B response.',
            { scenario: 'Category B response', cdmNotification: true }
          ),
          row(
            'REJECTED',
            'CLEARING_REJECT_POSTING_PENDING',
            'RJCT',
            'CATEGORY_C',
            'Posting response requires payment rejection for Category C response.',
            { scenario: 'Category C response', channelPushNotification: true, cdmNotification: true }
          )
        ]
      }
    ]
  },
  {
    name: 'SPM Scenarios',
    description: 'Status transitions for SPM (screening / payment monitoring) requests.',
    hasScenarioColumn: true,
    hasResponsibleColumn: true,
    hasTriggerReversalColumn: false,
    subFlows: [
      {
        title: 'SPM Scenarios',
        rows: [
          row(
            'PENDING',
            'SPM_SENT',
            'PDNG',
            'SPM_REQUESTED',
            'SPM request submitted to the screening engine.',
            { scenario: 'SPM request submitted', responsibleComponent: 'SPM Service' }
          ),
          row(
            'REJECTED',
            'SPM_FAILED',
            'RJCT',
            'SPM_FAILED',
            'SPM returned a business failure.',
            {
              scenario: 'SPM failed response',
              responsibleComponent: 'SPM Service',
              channelPushNotification: true,
              cdmNotification: true
            }
          ),
          row(
            'REJECTED',
            'SPM_ERROR',
            'RJCT',
            'SPM_ERROR',
            'SPM returned a technical error.',
            {
              scenario: 'SPM technical error',
              responsibleComponent: 'SPM Service',
              channelPushNotification: true,
              cdmNotification: true
            }
          )
        ]
      }
    ]
  },
  {
    name: 'Sanctions Fail Scenario',
    description: 'Status transitions for sanctions screening outcomes.',
    hasScenarioColumn: true,
    hasResponsibleColumn: false,
    hasTriggerReversalColumn: false,
    subFlows: [
      {
        title: 'Sanctions Failure',
        rows: [
          row(
            'PENDING',
            'SANCTIONS_SENT',
            'PDNG',
            'SANCTIONS_REQUESTED',
            'Sanctions request submitted.',
            { scenario: 'Sanctions request submitted' }
          ),
          row(
            'PENDING',
            'OFAC_POSSIBLE_HIT',
            'PDNG',
            'OFAC_REVIEW',
            'Possible OFAC hit identified for manual review.',
            { scenario: 'Possible OFAC hit' }
          ),
          row(
            'REJECTED',
            'SANCTION_REJECTED',
            'RJCT',
            'SANCTIONS_REJECTED',
            'Payment rejected because sanctions screening failed.',
            { scenario: 'Sanctions rejected payment', channelPushNotification: true, cdmNotification: true }
          ),
          row(
            'CANCELLED',
            'SANCTION_CANCELLED',
            'RJCT',
            'SANCTIONS_CANCELLED',
            'Payment cancelled after sanctions workflow closed.',
            { scenario: 'Sanctions cancelled payment', channelPushNotification: true, cdmNotification: true }
          ),
          row(
            'SEIZED',
            'SANCTIONS_SEIZED',
            'RJCT',
            'SANCTIONS_SEIZED',
            'Funds seized after sanctions determination.',
            { scenario: 'Funds seized after sanctions review', channelPushNotification: true, cdmNotification: true }
          )
        ]
      }
    ]
  }
];

function materializeRows(nextId: () => string, rows: StatusRowSeed[]): StatusRow[] {
  return rows.map((item) => ({
    id: nextId(),
    ...item
  }));
}

function materializeSubFlows(nextId: () => string, subFlows: SubFlowSeed[]): SubFlow[] {
  return subFlows.map((subFlow) => ({
    id: nextId(),
    title: subFlow.title,
    rows: materializeRows(nextId, subFlow.rows)
  }));
}

export function createDefaultScenarios(): ScenarioCategory[] {
  const nextId = createIdFactory();

  return DEFAULT_SCENARIO_SEEDS.map((scenario) => ({
    id: nextId(),
    name: scenario.name,
    description: scenario.description,
    subFlows: materializeSubFlows(nextId, scenario.subFlows),
    hasScenarioColumn: scenario.hasScenarioColumn,
    hasResponsibleColumn: scenario.hasResponsibleColumn,
    hasTriggerReversalColumn: scenario.hasTriggerReversalColumn
  }));
}

export function createDefaultStateManagerConfig(
  countryCode: string,
  flowDirection: FlowDirection
): StateManagerConfig {
  return {
    countryCode,
    flowDirection,
    scenarios: createDefaultScenarios(),
    lastUpdated: new Date().toISOString()
  };
}

