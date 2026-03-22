import type { FlowDirection, ScenarioCategory, StateManagerConfig } from '../types';

export type SupportedScenarioImportFileType = 'csv' | 'xlsx' | 'xls';

export type RawImportRow = Record<string, unknown>;

export type NormalizedImportRow = {
  rowNumber: number;
  scenarioName: string;
  scenarioDescription: string;
  subFlowTitle: string;
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
  scenarioOrder?: number;
  subFlowOrder?: number;
  rowOrder?: number;
  hasScenarioColumn?: boolean;
  hasResponsibleColumn?: boolean;
  hasTriggerReversalColumn?: boolean;
};

export type ScenarioImportColumnKey = Exclude<keyof NormalizedImportRow, 'rowNumber'>;

export type ScenarioImportIssue = {
  rowNumber?: number;
  severity: 'ERROR' | 'WARN';
  code: string;
  message: string;
};

export type ScenarioImportParseResult = {
  fileType: SupportedScenarioImportFileType;
  rawRows: RawImportRow[];
  normalizedRows: NormalizedImportRow[];
  issues: ScenarioImportIssue[];
};

export type ScenarioImportBuildResult = {
  scenarios: ScenarioCategory[];
  issues: ScenarioImportIssue[];
  summary: {
    scenarioCount: number;
    subFlowCount: number;
    rowCount: number;
    warningCount: number;
    errorCount: number;
  };
};

export type ScenarioImportSuccessHandler = (
  nextConfig: StateManagerConfig,
  result: ScenarioImportBuildResult
) => void;
