import type { ScenarioImportColumnKey } from './types';

export type ScenarioImportColumnDescriptor = {
  key: ScenarioImportColumnKey;
  required: boolean;
  description: string;
};

export const SUPPORTED_SCENARIO_IMPORT_COLUMNS: ScenarioImportColumnDescriptor[] = [
  { key: 'scenarioName', required: true, description: 'Scenario tab name.' },
  { key: 'scenarioDescription', required: false, description: 'Scenario description shown above the editor.' },
  { key: 'subFlowTitle', required: true, description: 'Sub-flow title rendered under each scenario.' },
  { key: 'msgStatus', required: true, description: 'Message status for the row.' },
  { key: 'msgSubStatus', required: true, description: 'Message sub-status for the row.' },
  { key: 'channelPushNotification', required: false, description: 'Boolean flag for channel push notification.' },
  { key: 'cdmNotification', required: false, description: 'Boolean flag for CDM notification.' },
  { key: 'transactionStatus', required: false, description: 'Transaction status value.' },
  { key: 'transactionStatusReason', required: false, description: 'Transaction status reason value.' },
  { key: 'reasonDescription', required: false, description: 'Reason description text.' },
  { key: 'scenario', required: false, description: 'Optional scenario column value.' },
  { key: 'responsibleComponent', required: false, description: 'Optional responsible component value.' },
  { key: 'triggerReversal', required: false, description: 'Optional trigger reversal flag.' },
  { key: 'scenarioOrder', required: false, description: 'Optional scenario sort order.' },
  { key: 'subFlowOrder', required: false, description: 'Optional sub-flow sort order.' },
  { key: 'rowOrder', required: false, description: 'Optional row sort order.' },
  { key: 'hasScenarioColumn', required: false, description: 'Explicitly show the Scenario column.' },
  { key: 'hasResponsibleColumn', required: false, description: 'Explicitly show the Responsible column.' },
  { key: 'hasTriggerReversalColumn', required: false, description: 'Explicitly show the Trigger Reversal column.' }
];

export const REQUIRED_SCENARIO_IMPORT_COLUMNS: ScenarioImportColumnKey[] = [
  'scenarioName',
  'subFlowTitle',
  'msgStatus',
  'msgSubStatus'
];

const HEADER_ALIASES: Record<ScenarioImportColumnKey, readonly string[]> = {
  scenarioName: ['scenarioName', 'scenario name', 'scenario_name'],
  scenarioDescription: [
    'scenarioDescription',
    'scenario description',
    'scenario_description',
    'scenario desc',
    'scenario_desc'
  ],
  subFlowTitle: [
    'subFlowTitle',
    'sub flow title',
    'sub_flow_title',
    'subflowtitle',
    'subflow',
    'sub_flow',
    'sub flow',
    'subflow name'
  ],
  msgStatus: ['msgStatus', 'msg status', 'msg_status', 'message status', 'message_status', 'status'],
  msgSubStatus: [
    'msgSubStatus',
    'msg sub status',
    'msg_sub_status',
    'message sub status',
    'message_sub_status',
    'sub status',
    'sub_status',
    'substatus'
  ],
  channelPushNotification: [
    'channelPushNotification',
    'channel push notification',
    'channel_push_notification',
    'channel push',
    'channel_push',
    'push notification',
    'push_notification'
  ],
  cdmNotification: ['cdmNotification', 'cdm notification', 'cdm_notification', 'cdm'],
  transactionStatus: [
    'transactionStatus',
    'transaction status',
    'transaction_status',
    'txn status',
    'txn_status',
    'tx status',
    'tx_status'
  ],
  transactionStatusReason: [
    'transactionStatusReason',
    'transaction status reason',
    'transaction_status_reason',
    'txn status reason',
    'txn_status_reason',
    'txn reason',
    'txn_reason',
    'transaction reason',
    'transaction_reason'
  ],
  reasonDescription: [
    'reasonDescription',
    'reason description',
    'reason_description',
    'reason desc',
    'reason_desc',
    'reason detail',
    'reason_detail'
  ],
  scenario: ['scenario'],
  responsibleComponent: [
    'responsibleComponent',
    'responsible component',
    'responsible_component',
    'responsible',
    'who does it',
    'who_does_it',
    'owner'
  ],
  triggerReversal: [
    'triggerReversal',
    'trigger reversal',
    'trigger_reversal',
    'reversal trigger',
    'reversal_trigger'
  ],
  scenarioOrder: ['scenarioOrder', 'scenario order', 'scenario_order'],
  subFlowOrder: ['subFlowOrder', 'sub flow order', 'sub_flow_order', 'subfloworder', 'subflow order'],
  rowOrder: ['rowOrder', 'row order', 'row_order'],
  hasScenarioColumn: ['hasScenarioColumn', 'has scenario column', 'has_scenario_column', 'show scenario column'],
  hasResponsibleColumn: [
    'hasResponsibleColumn',
    'has responsible column',
    'has_responsible_column',
    'show responsible column'
  ],
  hasTriggerReversalColumn: [
    'hasTriggerReversalColumn',
    'has trigger reversal column',
    'has_trigger_reversal_column',
    'show trigger reversal column'
  ]
};

const headerLookup = new Map<string, ScenarioImportColumnKey>();

Object.entries(HEADER_ALIASES).forEach(([canonicalKey, aliases]) => {
  aliases.forEach((alias) => {
    headerLookup.set(normalizeHeaderKey(alias), canonicalKey as ScenarioImportColumnKey);
  });
});

export function normalizeHeaderKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function resolveCanonicalHeader(header: string): ScenarioImportColumnKey | undefined {
  return headerLookup.get(normalizeHeaderKey(header));
}
