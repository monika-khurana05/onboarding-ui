export type FlowDirection = 'INCOMING' | 'OUTGOING';

export type StatusRow = {
  id: string;
  msgStatus: string;
  msgSubStatus: string;
  channelPushNotification: boolean;
  cdmNotification: boolean;
  transactionStatus: string;
  transactionStatusReason: string;
  reasonDescription: string;
  scenario?: string;
  responsibleComponent?: string;
  triggerReversal?: boolean;
};

export type SubFlow = {
  id: string;
  title: string;
  rows: StatusRow[];
};

export type ScenarioCategory = {
  id: string;
  name: string;
  description: string;
  subFlows: SubFlow[];
  hasScenarioColumn: boolean;
  hasResponsibleColumn: boolean;
  hasTriggerReversalColumn: boolean;
};

export type StateManagerConfig = {
  countryCode: string;
  flowDirection: FlowDirection;
  scenarios: ScenarioCategory[];
  lastUpdated: string;
};

export const MSG_STATUS_OPTIONS = [
  'RECEIVED',
  'PENDING',
  'SENT_TO_CLEARING',
  'COMPLETE',
  'REJECTED',
  'CANCELLED',
  'SEIZED',
  'NON_PAY_COMPLETE',
  'NON_PAY_REJECTED'
] as const;

export const TRANSACTION_STATUS_OPTIONS = ['PDNG', 'ACCC', 'RJCT'] as const;

export const MSG_SUB_STATUS_OPTIONS = [
  'VALIDATED',
  'RECEIVED_FOR_PROCESSING',
  'SPM_SENT',
  'SPM_FAILED',
  'SPM_ERROR',
  'SANCTIONS_SENT',
  'BALANCE_CHECK_PENDING',
  'POSTING_PENDING',
  'POSTING_COMPLETE',
  'POSTING_PENDING_CLEARING_INFORMED',
  'POSTING_COMPLETE_CLEARING_INFORMED',
  'WAREHOUSED',
  'OFAC_POSSIBLE_HIT',
  'CLEARING_REJECT_POSTING_PENDING',
  'CLEARING_REJECT_POSTING_COMPLETE',
  'ACCOUNT_INVALID',
  'ACCOUNT_CLOSED',
  'INVALID_ACCOUNT_CLASS',
  'TAX_INFO_MISSING',
  'INVALID_TAX_ID',
  'ALIAS_NOT_RESOLVED',
  'CREDITOR_MEMBERSHIP_INVALID',
  'DUPLICATE',
  'STOP_RECALL_REQUEST',
  'SANCTION_REJECTED',
  'SANCTION_CANCELLED',
  'SANCTIONS_SEIZED',
  'NON_PAY_RECEIVED_FOR_PROCESSING'
] as const;
