import { Alert, Button, Chip, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TestScenarioPack } from '../../types';
import type { Flow } from '../../../status/types';
import { RunResultsTable } from './RunResultsTable';
import type { TopicConfig } from '../validation/types';
import type { CreateRunRequest, RunStatusResponse, ScenarioResult, SseEvent } from '../validation/apiTypes';
import { cancelRun, createRun, getResults, getRun, subscribeEvents } from '../validation/validationApi';

type ValidationRunPanelProps = {
  countryCode: string;
  flow: Flow;
  scenarioPack: TestScenarioPack | null;
  selectedScenarioIds: Set<string>;
};

type SelectionSummary = {
  total: number;
  selectedCount: number;
  usingAll: boolean;
  selectedIds: string[];
};

type PipelinePreset = 'OUTGOING' | 'INCOMING' | 'CUSTOM';

const terminalStatuses: RunStatusResponse['status'][] = ['COMPLETED', 'FAILED', 'CANCELLED'];
const LAST_RUN_PREFIX = 'ai.validation.lastRun.';
const RUN_PREFIX = 'ai.validation.run.';

function presetTopic(preset: Exclude<PipelinePreset, 'CUSTOM'>): TopicConfig {
  if (preset === 'INCOMING') {
    return {
      serviceName: 'Payment Reception',
      entryPoint: 'IN',
      topicName: 'cpx.payments.incoming.in',
      headersTemplate: {}
    };
  }
  return {
    serviceName: 'Payment Initiation',
    entryPoint: 'IN',
    topicName: 'cpx.payments.outgoing.in',
    headersTemplate: {}
  };
}

function statusTone(status?: RunStatusResponse['status']) {
  switch (status) {
    case 'COMPLETED':
      return 'success' as const;
    case 'FAILED':
      return 'error' as const;
    case 'CANCELLED':
      return 'warning' as const;
    case 'RUNNING':
      return 'info' as const;
    case 'QUEUED':
      return 'warning' as const;
    default:
      return 'default' as const;
  }
}

function lastRunKey(countryCode: string, flow: Flow) {
  return `${LAST_RUN_PREFIX}${countryCode}.${flow}`;
}

function runKey(runId: string) {
  return `${RUN_PREFIX}${runId}`;
}

function readStoredId(key: string): string | null {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'string') {
      return parsed;
    }
  } catch (error) {
    return raw;
  }
  return raw;
}

function computeStats(results: ScenarioResult[], totalOverride?: number) {
  const total = totalOverride ?? results.length;
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

export function ValidationRunPanel({
  countryCode,
  flow,
  scenarioPack,
  selectedScenarioIds
}: ValidationRunPanelProps) {
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pollRef = useRef<number | null>(null);
  const [pipelinePreset, setPipelinePreset] = useState<PipelinePreset>('OUTGOING');
  const [topic, setTopic] = useState<TopicConfig>(() => presetTopic('OUTGOING'));
  const [run, setRun] = useState<RunStatusResponse | null>(null);
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selection = useMemo<SelectionSummary>(() => {
    const scenarios = scenarioPack?.scenarios ?? [];
    const total = scenarios.length;
    const selected = scenarios.filter((scenario) => selectedScenarioIds.has(scenario.scenarioId));
    const usingAll = selected.length === 0 && total > 0;
    const selectedIds = usingAll ? scenarios.map((scenario) => scenario.scenarioId) : selected.map((s) => s.scenarioId);
    return {
      total,
      selectedCount: selected.length,
      usingAll,
      selectedIds
    };
  }, [scenarioPack, selectedScenarioIds]);

  const selectedScenarios = useMemo(() => {
    if (!scenarioPack) {
      return [];
    }
    if (selection.usingAll) {
      return scenarioPack.scenarios;
    }
    return scenarioPack.scenarios.filter((scenario) => selection.selectedIds.includes(scenario.scenarioId));
  }, [scenarioPack, selection.selectedIds, selection.usingAll]);

  const runInProgress = Boolean(run && ['QUEUED', 'RUNNING'].includes(run.status));

  const clearPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleSseEvent = useCallback((event: SseEvent) => {
    if (event.type === 'run.status') {
      setRun((prev) =>
        prev ? { ...prev, status: event.status, updatedAt: event.updatedAt } : prev
      );
      if (terminalStatuses.includes(event.status)) {
        clearPolling();
      }
      return;
    }
    if (event.type === 'run.completed') {
      setRun((prev) =>
        prev
          ? { ...prev, status: event.status, stats: event.stats, updatedAt: new Date().toISOString() }
          : prev
      );
      clearPolling();
      return;
    }
    if (event.type === 'scenario.publish') {
      setResults((prev) => {
        const exists = prev.some((entry) => entry.scenarioId === event.scenarioId);
        const next = exists
          ? prev.map((entry) =>
              entry.scenarioId === event.scenarioId
                ? {
                    ...entry,
                    publish: {
                      ...entry.publish,
                      status: event.status,
                      topic: event.topic,
                      partition: event.partition ?? entry.publish.partition,
                      offset: event.offset ?? entry.publish.offset,
                      key: event.key ?? entry.publish.key,
                      timestamp: event.timestamp ?? entry.publish.timestamp,
                      error: event.error ?? entry.publish.error
                    }
                  }
                : entry
            )
          : [
              ...prev,
              {
                scenarioId: event.scenarioId,
                publish: {
                  status: event.status,
                  topic: event.topic,
                  partition: event.partition,
                  offset: event.offset,
                  key: event.key,
                  timestamp: event.timestamp,
                  error: event.error
                },
                validation: { status: 'PENDING', checks: [] }
              }
            ];
        setRun((prevRun) => {
          if (!prevRun) {
            return prevRun;
          }
          const stats = computeStats(next, prevRun.stats.total);
          const status = prevRun.status === 'QUEUED' ? 'RUNNING' : prevRun.status;
          return { ...prevRun, stats, status };
        });
        return next;
      });
      return;
    }
    if (event.type === 'scenario.validation') {
      setResults((prev) => {
        const exists = prev.some((entry) => entry.scenarioId === event.scenarioId);
        const next = exists
          ? prev.map((entry) =>
              entry.scenarioId === event.scenarioId
                ? {
                    ...entry,
                    validation: {
                      status: event.status,
                      checks: event.checks,
                      errorCode: event.errorCode,
                      message: event.message
                    }
                  }
                : entry
            )
          : [
              ...prev,
              {
                scenarioId: event.scenarioId,
                publish: { status: 'QUEUED', topic: 'cpx.validation.in' },
                validation: {
                  status: event.status,
                  checks: event.checks,
                  errorCode: event.errorCode,
                  message: event.message
                }
              }
            ];
        setRun((prevRun) => {
          if (!prevRun) {
            return prevRun;
          }
          const stats = computeStats(next, prevRun.stats.total);
          return { ...prevRun, stats };
        });
        return next;
      });
    }
  }, [clearPolling]);

  const startPolling = useCallback(
    (runId: string) => {
      clearPolling();
      pollRef.current = window.setInterval(async () => {
        try {
          const data = await getRun(runId);
          setRun(data);
          if (terminalStatuses.includes(data.status)) {
            clearPolling();
            const payload = await getResults(runId);
            setResults(payload.results);
          }
        } catch (pollError) {
          console.warn('Failed to poll validation run.', pollError);
        }
      }, 5000);
    },
    [clearPolling]
  );

  useEffect(() => {
    const normalizedCountry = countryCode.trim().toUpperCase();
    if (!normalizedCountry) {
      setRun(null);
      setResults([]);
      clearPolling();
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      return;
    }
    const runId = readStoredId(lastRunKey(normalizedCountry, flow));
    if (!runId) {
      setRun(null);
      setResults([]);
      clearPolling();
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      return;
    }
    getRun(runId)
      .then((data) => {
        setRun(data);
        if (!terminalStatuses.includes(data.status)) {
          startPolling(runId);
        }
      })
      .catch(() => {
        setRun(null);
      });
    getResults(runId)
      .then((payload) => setResults(payload.results))
      .catch(() => setResults([]));

    unsubscribeRef.current?.();
    try {
      unsubscribeRef.current = subscribeEvents(runId, handleSseEvent);
    } catch (subscribeError) {
      console.warn('Failed to subscribe to validation events.', subscribeError);
      setError('Failed to subscribe to validation events.');
    }
  }, [clearPolling, countryCode, flow, handleSseEvent, startPolling]);

  const handlePresetChange = useCallback((nextPreset: PipelinePreset) => {
    setPipelinePreset(nextPreset);
    if (nextPreset !== 'CUSTOM') {
      setTopic(presetTopic(nextPreset));
    }
  }, []);

  const handleTopicNameChange = useCallback(
    (value: string) => {
      setTopic((prev) => ({ ...prev, topicName: value }));
      if (pipelinePreset !== 'CUSTOM') {
        setPipelinePreset('CUSTOM');
      }
    },
    [pipelinePreset]
  );

  const handleRunValidation = useCallback(async () => {
    if (!scenarioPack || selection.total === 0) {
      setError('Generate scenarios before running validation.');
      return;
    }
    if (selection.selectedIds.length === 0) {
      setError('Select at least one scenario or leave all unselected to run all.');
      return;
    }
    if (!countryCode.trim()) {
      setError('Country code is required.');
      return;
    }
    if (!topic.topicName.trim()) {
      setError('Provide a valid entry topic.');
      return;
    }

    setError(null);

    const basePayload = scenarioPack?.baseXml ?? '';
    const request: CreateRunRequest = {
      countryCode: countryCode.trim().toUpperCase(),
      flow,
      pipelinePreset,
      topics: [topic],
      baseMessage: {
        format: 'PAIN001_XML',
        payload: basePayload,
        headers: { source: 'UI_DEMO' }
      },
      scenarios: selectedScenarios.map((scenario) => ({
        scenarioId: scenario.scenarioId,
        title: scenario.title,
        mutations: scenario.mutations,
        payload: scenario.xmlVariant
      })),
      options: {
        publishMode: 'KAFKA',
        timeoutSeconds: 120,
        stopOnFirstFailure: false
      }
    };

    try {
      const response = await createRun(request);
      const runId = response.runId;
      localStorage.setItem(lastRunKey(request.countryCode, flow), runId);
      setRun({
        runId,
        status: response.status,
        countryCode: request.countryCode,
        flow,
        createdAt: response.createdAt,
        updatedAt: response.createdAt,
        stats: computeStats([], request.scenarios.length),
        blockers: [],
        error: null
      });
      setResults([]);
      if (pipelinePreset !== 'CUSTOM') {
        setPipelinePreset('CUSTOM');
      }
      unsubscribeRef.current?.();
      try {
        unsubscribeRef.current = subscribeEvents(runId, handleSseEvent);
      } catch (subscribeError) {
        console.warn('Failed to subscribe to validation events.', subscribeError);
        setError('Failed to subscribe to validation events.');
      }
      startPolling(runId);
      const runStatus = await getRun(runId);
      setRun(runStatus);
      const payload = await getResults(runId);
      setResults(payload.results);
    } catch (runError) {
      console.warn('Failed to start validation run.', runError);
      setError('Failed to start validation run.');
    }
  }, [
    countryCode,
    flow,
    handleSseEvent,
    pipelinePreset,
    scenarioPack,
    selectedScenarios,
    selection.selectedIds.length,
    selection.total,
    startPolling,
    topic
  ]);

  const handleCancelRun = useCallback(() => {
    if (!run) {
      return;
    }
    cancelRun(run.runId)
      .then((payload) => {
        setRun((prev) =>
          prev ? { ...prev, status: payload.status as RunStatusResponse['status'], updatedAt: new Date().toISOString() } : prev
        );
      })
      .catch((cancelError) => {
        console.warn('Failed to cancel validation run.', cancelError);
        setError('Failed to cancel validation run.');
      });
  }, [run]);

  const handleClearResults = useCallback(() => {
    if (run) {
      localStorage.removeItem(runKey(run.runId));
    }
    localStorage.removeItem(lastRunKey(countryCode.trim().toUpperCase(), flow));
    setRun(null);
    setResults([]);
  }, [countryCode, flow, run]);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      clearPolling();
    };
  }, [clearPolling]);

  const stats = run?.stats ?? { total: 0, sent: 0, acked: 0, passed: 0, failed: 0, queued: 0, validated: 0 };
  const publishProgress = stats.total ? Math.round((stats.sent / stats.total) * 100) : 0;
  const validationProgress = stats.total ? Math.round(((stats.passed + stats.failed) / stats.total) * 100) : 0;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} useFlexGap flexWrap="wrap">
        <Typography variant="subtitle1">Entry Topic</Typography>
        <Chip label={`Flow: ${flow}`} size="small" variant="outlined" />
      </Stack>

      <TextField
        select
        label="Pipeline Preset"
        value={pipelinePreset}
        onChange={(event) => handlePresetChange(event.target.value as PipelinePreset)}
        helperText="Choose a preset to pre-fill the entry topic or select custom to keep manual edits."
        sx={{ maxWidth: 260 }}
      >
        <MenuItem value="OUTGOING">Outgoing</MenuItem>
        <MenuItem value="INCOMING">Incoming</MenuItem>
        <MenuItem value="CUSTOM">Custom</MenuItem>
      </TextField>

      <Stack spacing={1}>
        <Typography variant="subtitle2">Entry Topic</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
          <TextField
            label="Service Name"
            value={topic.serviceName}
            disabled
            sx={{ flex: 1, minWidth: 200 }}
          />
          <TextField
            label="Entry Point"
            value={topic.entryPoint}
            disabled
            sx={{ width: 140 }}
          />
          <TextField
            label="Topic Name"
            value={topic.topicName}
            onChange={(event) => handleTopicNameChange(event.target.value)}
            helperText="Single entry topic for the full system pipeline."
            sx={{ flex: 1.5, minWidth: 220 }}
          />
        </Stack>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle1">Scenario Selection</Typography>
        <Typography variant="body2" color="text.secondary">
          {selection.total === 0
            ? 'No scenarios available.'
            : selection.usingAll
            ? `No scenarios selected. Running all ${selection.total}.`
            : `${selection.selectedCount} selected of ${selection.total}.`}
        </Typography>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
        <Button variant="contained" onClick={handleRunValidation} disabled={runInProgress || selection.total === 0}>
          Run Validation
        </Button>
        <Button variant="outlined" onClick={handleCancelRun} disabled={!runInProgress}>
          Cancel Run
        </Button>
        <Button variant="text" onClick={handleClearResults} disabled={!run && results.length === 0}>
          Clear Results
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1">Run Progress</Typography>
          <Chip
            label={run?.status ?? 'IDLE'}
            size="small"
            color={statusTone(run?.status)}
            variant="outlined"
          />
          {run?.updatedAt ? (
            <Typography variant="caption" color="text.secondary">
              Updated {new Date(run.updatedAt).toLocaleTimeString()}
            </Typography>
          ) : null}
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            Publish progress: {stats.sent}/{stats.total} sent · {stats.acked} acked
          </Typography>
          <LinearProgress variant="determinate" value={publishProgress} />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            Validation progress: {stats.passed + stats.failed}/{stats.total} completed
          </Typography>
          <LinearProgress variant="determinate" value={validationProgress} />
        </Stack>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle1">Run Results</Typography>
        {scenarioPack ? (
          <RunResultsTable scenarios={scenarioPack.scenarios} results={results} />
        ) : (
          <Alert severity="info">Generate scenarios to view validation results.</Alert>
        )}
      </Stack>
    </Stack>
  );
}
