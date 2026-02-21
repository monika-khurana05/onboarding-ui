import type {
  CreateRunRequest,
  CreateRunResponse,
  RunStatusResponse,
  ScenarioResult,
  SseEvent
} from './apiTypes';
import * as mock from './validationApi.mock';
import * as real from './validationApi.real';

const mode = (import.meta.env.VITE_VALIDATION_API_MODE ?? 'mock').toString().toLowerCase();
const api = mode === 'real' ? real : mock;

export const createRun = (req: CreateRunRequest): Promise<CreateRunResponse> => api.createRun(req);
export const getRun = (runId: string): Promise<RunStatusResponse> => api.getRun(runId);
export const getResults = (runId: string): Promise<{ runId: string; results: ScenarioResult[] }> =>
  api.getResults(runId);
export const cancelRun = (runId: string): Promise<{ runId: string; status: string }> => api.cancelRun(runId);
export const subscribeEvents = (runId: string, onEvent: (event: SseEvent) => void): (() => void) =>
  api.subscribeEvents(runId, onEvent);
