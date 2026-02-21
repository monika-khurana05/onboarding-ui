import type { PerScenarioResult, ValidationRun, ValidationRunStats } from './types';

const RUNS_KEY = 'ai.validationRuns';
const RESULTS_PREFIX = 'ai.validationRunResults.';

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

function loadRuns(): ValidationRun[] {
  return safeGet<ValidationRun[]>(RUNS_KEY) ?? [];
}

function saveRuns(runs: ValidationRun[]) {
  safeSet(RUNS_KEY, runs);
}

export function saveRun(run: ValidationRun): ValidationRun {
  const runs = loadRuns();
  const index = runs.findIndex((entry) => entry.runId === run.runId);
  if (index >= 0) {
    runs[index] = run;
  } else {
    runs.push(run);
  }
  saveRuns(runs);
  return run;
}

export function deleteRun(runId: string): void {
  const runs = loadRuns().filter((entry) => entry.runId !== runId);
  saveRuns(runs);
  localStorage.removeItem(`${RESULTS_PREFIX}${runId}`);
}

export function getRun(runId: string): ValidationRun | null {
  const runs = loadRuns();
  return runs.find((entry) => entry.runId === runId) ?? null;
}

export function listRunsByCountryFlow(countryCode: string, flow: ValidationRun['flow']): ValidationRun[] {
  const normalized = countryCode.trim().toUpperCase();
  return loadRuns().filter(
    (entry) => entry.countryCode.trim().toUpperCase() === normalized && entry.flow === flow
  );
}

export function saveResults(runId: string, results: PerScenarioResult[]): void {
  safeSet(`${RESULTS_PREFIX}${runId}`, results);
}

export function loadResults(runId: string): PerScenarioResult[] | null {
  return safeGet<PerScenarioResult[]>(`${RESULTS_PREFIX}${runId}`);
}

export function computeRunStats(run: ValidationRun, results: PerScenarioResult[]): ValidationRunStats {
  const total = run.selectedScenarioIds.length || results.length;
  const sent = results.filter((entry) => entry.publish.status !== 'QUEUED').length;
  const acked = results.filter((entry) => entry.publish.status === 'ACKED').length;
  const passed = results.filter((entry) => entry.validation.status === 'PASS').length;
  const failed = results.filter((entry) => entry.validation.status === 'FAIL').length;
  return { total, sent, acked, passed, failed };
}

export function saveRunWithResults(run: ValidationRun, results: PerScenarioResult[]): ValidationRun {
  const nextStats = computeRunStats(run, results);
  const updated = { ...run, stats: nextStats, updatedAt: new Date().toISOString() };
  saveRun(updated);
  saveResults(run.runId, results);
  return updated;
}
