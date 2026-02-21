import type { Flow } from '../../../status/types';

export type TopicConfig = {
  serviceName: string;
  entryPoint: string;
  topicName: string;
  headersTemplate?: Record<string, string>;
};

export type ValidationRunStatus = 'IDLE' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type ValidationRunStats = {
  total: number;
  sent: number;
  acked: number;
  passed: number;
  failed: number;
};

export type ValidationRun = {
  runId: string;
  createdAt: string;
  updatedAt: string;
  countryCode: string;
  flow: Flow;
  selectedScenarioIds: string[];
  topics: TopicConfig[];
  status: ValidationRunStatus;
  stats: ValidationRunStats;
};

export type PublishStatus = 'QUEUED' | 'SENT' | 'ACKED' | 'ERROR';
export type ValidationStatus = 'PENDING' | 'PASS' | 'FAIL';

export type ValidationCheck = {
  name: string;
  status: 'PASS' | 'FAIL';
  detail?: string;
};

export type PerScenarioResult = {
  scenarioId: string;
  publish: {
    status: PublishStatus;
    topic: string;
    partition?: number;
    offset?: number;
    key?: string;
    timestamp?: string;
    error?: string;
  };
  validation: {
    status: ValidationStatus;
    checks: ValidationCheck[];
    errorCode?: string;
    message?: string;
  };
};
