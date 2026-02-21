import type {
  CreateRunRequest,
  CreateRunResponse,
  RunStatusResponse,
  ScenarioResult,
  SseEvent
} from './apiTypes';

export async function createRun(_req: CreateRunRequest): Promise<CreateRunResponse> {
  throw new Error('Not implemented. Configure backend integration for validation runs.');
}

export async function getRun(_runId: string): Promise<RunStatusResponse> {
  throw new Error('Not implemented. Configure backend integration for validation runs.');
}

export async function getResults(_runId: string): Promise<{ runId: string; results: ScenarioResult[] }> {
  throw new Error('Not implemented. Configure backend integration for validation runs.');
}

export async function cancelRun(_runId: string): Promise<{ runId: string; status: string }> {
  throw new Error('Not implemented. Configure backend integration for validation runs.');
}

export function subscribeEvents(_runId: string, _onEvent: (event: SseEvent) => void): () => void {
  throw new Error('Not implemented. Configure backend integration for validation runs.');
}
