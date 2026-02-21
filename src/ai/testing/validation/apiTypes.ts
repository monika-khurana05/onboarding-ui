import type { Flow } from '../../../status/types';
import type { TopicConfig } from './types';

export type CreateRunRequest = {
  countryCode: string;
  flow: Flow;
  pipelinePreset: 'OUTGOING' | 'INCOMING' | 'CUSTOM';
  topics: TopicConfig[];
  baseMessage: {
    format: 'PAIN001_XML';
    payload: string;
    headers?: Record<string, string>;
  };
  scenarios: Array<{
    scenarioId: string;
    title: string;
    mutations: string[];
    payload: string;
  }>;
  options: {
    publishMode: 'KAFKA';
    timeoutSeconds: number;
    stopOnFirstFailure: boolean;
  };
};

export type CreateRunResponse = {
  runId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  links: {
    self: string;
    events: string;
  };
};

export type RunStatusResponse = {
  runId: string;
  countryCode: string;
  flow: Flow;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  stats: {
    total: number;
    queued: number;
    sent: number;
    acked: number;
    validated: number;
    passed: number;
    failed: number;
  };
  blockers: string[];
  error: string | null;
};

export type ScenarioResult = {
  scenarioId: string;
  publish: {
    status: 'QUEUED' | 'SENT' | 'ACKED' | 'ERROR';
    topic: string;
    partition?: number;
    offset?: number;
    key?: string;
    timestamp?: string;
    error?: string;
  };
  validation: {
    status: 'PENDING' | 'PASS' | 'FAIL';
    checks: Array<{ name: string; status: 'PASS' | 'FAIL'; detail?: string }>;
    errorCode?: string;
    message?: string;
  };
};

export type SseEvent =
  | {
      type: 'run.status';
      runId: string;
      status: RunStatusResponse['status'];
      updatedAt: string;
    }
  | {
      type: 'scenario.publish';
      runId: string;
      scenarioId: string;
      status: ScenarioResult['publish']['status'];
      topic: string;
      partition?: number;
      offset?: number;
      key?: string;
      timestamp?: string;
      error?: string;
    }
  | {
      type: 'scenario.validation';
      runId: string;
      scenarioId: string;
      status: ScenarioResult['validation']['status'];
      errorCode?: string;
      message?: string;
      checks: ScenarioResult['validation']['checks'];
    }
  | {
      type: 'run.completed';
      runId: string;
      status: 'COMPLETED';
      stats: RunStatusResponse['stats'];
    };
