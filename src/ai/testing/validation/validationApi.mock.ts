import type { CreateRunRequest, CreateRunResponse, RunStatusResponse, ScenarioResult, SseEvent } from './apiTypes';

type StoredRun = {
  request: CreateRunRequest;
  run: RunStatusResponse;
  results: ScenarioResult[];
};

type SimulationState = {
  timers: number[];
  running: boolean;
};

const RUN_PREFIX = 'ai.validation.run.';
const LAST_RUN_PREFIX = 'ai.validation.lastRun.';
const subscribers = new Map<string, Set<(event: SseEvent) => void>>();
const simulations = new Map<string, SimulationState>();

function safeSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save validation run data for ${key}.`, error);
  }
}

function safeGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to load validation run data for ${key}.`, error);
    localStorage.removeItem(key);
    return null;
  }
}

function saveStoredRun(runId: string, payload: StoredRun) {
  safeSet(`${RUN_PREFIX}${runId}`, payload);
}

function loadStoredRun(runId: string): StoredRun | null {
  return safeGet<StoredRun>(`${RUN_PREFIX}${runId}`);
}

function setLastRunId(countryCode: string, flow: string, runId: string) {
  safeSet(`${LAST_RUN_PREFIX}${countryCode}.${flow}`, runId);
}

function now() {
  return new Date().toISOString();
}

function randomDelay() {
  return 200 + Math.floor(Math.random() * 600);
}

function normalize(value: string) {
  return value.toLowerCase();
}

function contains(text: string, needle: string) {
  return normalize(text).includes(normalize(needle));
}

function failureRule(scenario: CreateRunRequest['scenarios'][number]) {
  const mutationText = scenario.mutations.join(' ');
  if (contains(mutationText, 'dbtracct')) {
    return { errorCode: 'MISSING_DEBTOR_ACCOUNT', failureCheck: 'RequiredFields' };
  }
  if (contains(mutationText, 'cdtracct')) {
    return { errorCode: 'MISSING_CREDITOR_ACCOUNT', failureCheck: 'RequiredFields' };
  }
  if (contains(mutationText, 'duplicate') || contains(scenario.title, 'duplicate') || contains(scenario.scenarioId, 'dup')) {
    return { errorCode: 'DUPLICATE_PAYMENT', failureCheck: 'DupCheck' };
  }
  return null;
}

function buildChecks(failureCheck?: string): ScenarioResult['validation']['checks'] {
  const checks = [
    { name: 'SchemaValidation', status: 'PASS' as const },
    { name: 'RequiredFields', status: 'PASS' as const },
    { name: 'DupCheck', status: 'PASS' as const },
    { name: 'CutoffRules', status: 'PASS' as const }
  ];
  if (!failureCheck) {
    return checks;
  }
  return checks.map((check) =>
    check.name === failureCheck ? { ...check, status: 'FAIL' as const } : check
  );
}

function computeStats(results: ScenarioResult[]): RunStatusResponse['stats'] {
  const total = results.length;
  const queued = results.filter((entry) => entry.publish.status === 'QUEUED').length;
  const sent = results.filter(
    (entry) => entry.publish.status === 'SENT' || entry.publish.status === 'ACKED'
  ).length;
  const acked = results.filter((entry) => entry.publish.status === 'ACKED').length;
  const validated = results.filter((entry) => entry.validation.status !== 'PENDING').length;
  const passed = results.filter((entry) => entry.validation.status === 'PASS').length;
  const failed = results.filter((entry) => entry.validation.status === 'FAIL').length;
  return { total, queued, sent, acked, validated, passed, failed };
}

function emit(runId: string, event: SseEvent) {
  const listeners = subscribers.get(runId);
  if (!listeners) {
    return;
  }
  listeners.forEach((listener) => listener(event));
}

function updateStoredRun(runId: string, updates: Partial<RunStatusResponse>, results: ScenarioResult[]) {
  const stored = loadStoredRun(runId);
  if (!stored) {
    return;
  }
  if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(stored.run.status)) {
    return;
  }
  const run = {
    ...stored.run,
    ...updates,
    stats: computeStats(results),
    updatedAt: now()
  };
  saveStoredRun(runId, { ...stored, run, results });
}

function ensureSimulation(runId: string) {
  const state = simulations.get(runId);
  if (state?.running) {
    return;
  }
  const stored = loadStoredRun(runId);
  if (!stored) {
    return;
  }

  const timers: number[] = [];
  const simulationState: SimulationState = { timers, running: true };
  simulations.set(runId, simulationState);

  const updateResults = (scenarioId: string, update: Partial<ScenarioResult>): ScenarioResult[] => {
    const refreshed = loadStoredRun(runId);
    if (!refreshed) {
      return [];
    }
    const nextResults = refreshed.results.map((entry) =>
      entry.scenarioId === scenarioId ? { ...entry, ...update } : entry
    );
    updateStoredRun(runId, {}, nextResults);
    return nextResults;
  };

  const markStatus = (status: RunStatusResponse['status']) => {
    const refreshed = loadStoredRun(runId);
    if (!refreshed) {
      return;
    }
    updateStoredRun(runId, { status }, refreshed.results);
    emit(runId, { type: 'run.status', runId, status, updatedAt: now() });
  };

  if (stored.run.status === 'QUEUED') {
    markStatus('RUNNING');
  }

  stored.request.scenarios.forEach((scenario, index) => {
    const storedResult = stored.results.find((entry) => entry.scenarioId === scenario.scenarioId);
    if (!storedResult) {
      return;
    }

    const schedule = (fn: () => void, delay: number) => {
      const timer = window.setTimeout(fn, delay);
      timers.push(timer);
    };

    const topic = storedResult.publish.topic;

    const handleValidation = () => {
      const failure = failureRule(scenario);
      const validation: ScenarioResult['validation'] = {
        status: failure ? 'FAIL' : 'PASS',
        checks: buildChecks(failure?.failureCheck),
        errorCode: failure?.errorCode,
        message: failure ? `Failed: ${failure.errorCode}` : 'All checks passed.'
      };
      updateResults(scenario.scenarioId, { validation });
      emit(runId, {
        type: 'scenario.validation',
        runId,
        scenarioId: scenario.scenarioId,
        status: validation.status,
        errorCode: validation.errorCode,
        message: validation.message,
        checks: validation.checks
      });

      const refreshed = loadStoredRun(runId);
      if (!refreshed) {
        return;
      }
      const stats = computeStats(refreshed.results);
      if (stats.validated === stats.total) {
        updateStoredRun(runId, { status: 'COMPLETED' }, refreshed.results);
        emit(runId, { type: 'run.completed', runId, status: 'COMPLETED', stats });
      }
    };

    if (storedResult.publish.status === 'QUEUED') {
      schedule(() => {
        const publish = {
          ...storedResult.publish,
          status: 'SENT' as const,
          key: scenario.scenarioId,
          timestamp: now()
        };
        updateResults(scenario.scenarioId, { publish });
        emit(runId, {
          type: 'scenario.publish',
          runId,
          scenarioId: scenario.scenarioId,
          status: publish.status,
          topic,
          key: publish.key,
          timestamp: publish.timestamp
        });

        schedule(() => {
          const ackedPublish = {
            ...publish,
            status: 'ACKED' as const,
            partition: index % 4,
            offset: 1000 + index,
            timestamp: now()
          };
          updateResults(scenario.scenarioId, { publish: ackedPublish });
          emit(runId, {
            type: 'scenario.publish',
            runId,
            scenarioId: scenario.scenarioId,
            status: ackedPublish.status,
            topic,
            partition: ackedPublish.partition,
            offset: ackedPublish.offset,
            key: ackedPublish.key,
            timestamp: ackedPublish.timestamp
          });

          schedule(handleValidation, randomDelay());
        }, randomDelay());
      }, randomDelay());
      return;
    }

    if (storedResult.publish.status === 'SENT') {
      schedule(() => {
        const ackedPublish = {
          ...storedResult.publish,
          status: 'ACKED' as const,
          partition: storedResult.publish.partition ?? index % 4,
          offset: storedResult.publish.offset ?? 1000 + index,
          timestamp: now()
        };
        updateResults(scenario.scenarioId, { publish: ackedPublish });
        emit(runId, {
          type: 'scenario.publish',
          runId,
          scenarioId: scenario.scenarioId,
          status: ackedPublish.status,
          topic,
          partition: ackedPublish.partition,
          offset: ackedPublish.offset,
          key: ackedPublish.key,
          timestamp: ackedPublish.timestamp
        });
        schedule(handleValidation, randomDelay());
      }, randomDelay());
      return;
    }

    if (storedResult.publish.status === 'ACKED' && storedResult.validation.status === 'PENDING') {
      schedule(handleValidation, randomDelay());
    }
  });
}

export async function createRun(req: CreateRunRequest): Promise<CreateRunResponse> {
  const runId = `vr_${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = now();
  const results: ScenarioResult[] = req.scenarios.map((scenario, index) => ({
    scenarioId: scenario.scenarioId,
    publish: {
      status: 'QUEUED',
      topic: req.topics[index % Math.max(1, req.topics.length)]?.topicName ?? 'cpx.validation.in'
    },
    validation: {
      status: 'PENDING',
      checks: []
    }
  }));
  const run: RunStatusResponse = {
    runId,
    countryCode: req.countryCode,
    flow: req.flow,
    status: 'QUEUED',
    createdAt,
    updatedAt: createdAt,
    stats: computeStats(results),
    blockers: [],
    error: null
  };
  const stored: StoredRun = { request: req, run, results };
  saveStoredRun(runId, stored);
  setLastRunId(req.countryCode, req.flow, runId);
  ensureSimulation(runId);
  return {
    runId,
    status: run.status,
    createdAt,
    links: {
      self: `/api/validation-runs/${runId}`,
      events: `/api/validation-runs/${runId}/events`
    }
  };
}

export async function getRun(runId: string): Promise<RunStatusResponse> {
  const stored = loadStoredRun(runId);
  if (!stored) {
    throw new Error('Validation run not found.');
  }
  return stored.run;
}

export async function getResults(runId: string): Promise<{ runId: string; results: ScenarioResult[] }> {
  const stored = loadStoredRun(runId);
  if (!stored) {
    throw new Error('Validation run not found.');
  }
  return { runId, results: stored.results };
}

export async function cancelRun(runId: string): Promise<{ runId: string; status: string }> {
  const stored = loadStoredRun(runId);
  if (!stored) {
    throw new Error('Validation run not found.');
  }
  const status: RunStatusResponse['status'] = 'CANCELLED';
  updateStoredRun(runId, { status }, stored.results);
  const simulation = simulations.get(runId);
  if (simulation) {
    simulation.timers.forEach((timer) => window.clearTimeout(timer));
    simulation.running = false;
  }
  emit(runId, { type: 'run.status', runId, status, updatedAt: now() });
  return { runId, status };
}

export function subscribeEvents(runId: string, onEvent: (event: SseEvent) => void): () => void {
  const stored = loadStoredRun(runId);
  if (!stored) {
    throw new Error('Validation run not found.');
  }
  let listeners = subscribers.get(runId);
  if (!listeners) {
    listeners = new Set();
    subscribers.set(runId, listeners);
  }
  listeners.add(onEvent);
  onEvent({ type: 'run.status', runId, status: stored.run.status, updatedAt: stored.run.updatedAt });
  ensureSimulation(runId);

  return () => {
    const current = subscribers.get(runId);
    if (!current) {
      return;
    }
    current.delete(onEvent);
    if (current.size === 0) {
      subscribers.delete(runId);
    }
  };
}
