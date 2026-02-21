import {
  Alert,
  Button,
  Chip,
  Divider,
  Drawer,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { useMemo, useState } from 'react';
import type { TestScenario } from '../../types';
import type { ScenarioResult } from '../validation/apiTypes';

type RunResultsTableProps = {
  scenarios: TestScenario[];
  results: ScenarioResult[];
};

function statusTone(status?: string) {
  if (!status) {
    return 'default' as const;
  }
  const normalized = status.toLowerCase();
  if (normalized.includes('pass') || normalized.includes('acked')) {
    return 'success' as const;
  }
  if (normalized.includes('fail') || normalized.includes('error')) {
    return 'error' as const;
  }
  if (normalized.includes('pending') || normalized.includes('queued') || normalized.includes('sent')) {
    return 'warning' as const;
  }
  return 'default' as const;
}

export function RunResultsTable({ scenarios, results }: RunResultsTableProps) {
  const scenarioMap = useMemo(() => new Map(scenarios.map((scenario) => [scenario.scenarioId, scenario])), [scenarios]);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  const activeResult = results.find((result) => result.scenarioId === activeScenarioId) ?? null;
  const activeScenario = activeResult ? scenarioMap.get(activeResult.scenarioId) ?? null : null;

  if (!results.length) {
    return <Alert severity="info">No validation results yet.</Alert>;
  }

  return (
    <>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Scenario ID</TableCell>
              <TableCell>Topic</TableCell>
              <TableCell>Publish Status</TableCell>
              <TableCell>Validation Status</TableCell>
              <TableCell>Summary</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map((result) => {
              const validationSummary =
                result.validation.status === 'FAIL'
                  ? result.validation.errorCode ?? result.validation.message ?? 'Failed'
                  : result.validation.status === 'PASS'
                  ? 'Passed'
                  : 'Pending';
              return (
                <TableRow key={result.scenarioId} hover>
                  <TableCell>{result.scenarioId}</TableCell>
                  <TableCell>{result.publish.topic || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={result.publish.status}
                      color={statusTone(result.publish.status)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={result.validation.status}
                      color={statusTone(result.validation.status)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{validationSummary}</TableCell>
                  <TableCell>
                    <Button size="small" variant="outlined" onClick={() => setActiveScenarioId(result.scenarioId)}>
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Drawer
        anchor="right"
        open={Boolean(activeResult)}
        onClose={() => setActiveScenarioId(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
      >
        <Stack spacing={2} sx={{ p: 2 }}>
          <Typography variant="subtitle1">Validation Detail</Typography>
          {activeResult ? (
            <Stack spacing={1.5}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">{activeResult.scenarioId}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Publish: {activeResult.publish.status} · Validation: {activeResult.validation.status}
                </Typography>
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Publish Metadata</Typography>
                <Typography variant="body2">Topic: {activeResult.publish.topic || '—'}</Typography>
                <Typography variant="body2">Partition: {activeResult.publish.partition ?? '—'}</Typography>
                <Typography variant="body2">Offset: {activeResult.publish.offset ?? '—'}</Typography>
                <Typography variant="body2">Key: {activeResult.publish.key ?? '—'}</Typography>
                <Typography variant="body2">Timestamp: {activeResult.publish.timestamp ?? '—'}</Typography>
                {activeResult.publish.error ? (
                  <Typography variant="body2" color="error">
                    Error: {activeResult.publish.error}
                  </Typography>
                ) : null}
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Validation Checks</Typography>
                {activeResult.validation.checks.length ? (
                  activeResult.validation.checks.map((check) => (
                    <Stack key={check.name} direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        label={check.status}
                        color={statusTone(check.status)}
                        variant="outlined"
                      />
                      <Typography variant="body2">
                        {check.name}
                        {check.detail ? ` · ${check.detail}` : ''}
                      </Typography>
                    </Stack>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Checks pending.
                  </Typography>
                )}
                {activeResult.validation.errorCode ? (
                  <Typography variant="body2" color="error">
                    Error Code: {activeResult.validation.errorCode}
                  </Typography>
                ) : null}
                {activeResult.validation.message ? (
                  <Typography variant="body2" color="text.secondary">
                    {activeResult.validation.message}
                  </Typography>
                ) : null}
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Payload</Typography>
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}
                >
                  {activeScenario?.xmlVariant ?? 'Payload unavailable.'}
                </Typography>
              </Stack>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select a scenario to view details.
            </Typography>
          )}
        </Stack>
      </Drawer>
    </>
  );
}
