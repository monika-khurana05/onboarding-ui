import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import { useId, useMemo, useState, type ChangeEvent } from 'react';
import type { FlowDirection, StateManagerConfig } from '../types';
import {
  SUPPORTED_SCENARIO_IMPORT_COLUMNS
} from './headerAliases';
import { buildStateManagerConfigFromImportRows } from './buildStateManagerConfigFromImport';
import { parseScenarioFile } from './parseScenarioFile';
import type {
  ScenarioImportBuildResult,
  ScenarioImportIssue,
  ScenarioImportParseResult,
  ScenarioImportSuccessHandler
} from './types';

type ImportScenariosPanelProps = {
  countryCode: string;
  flowDirection: FlowDirection;
  onImportSuccess: ScenarioImportSuccessHandler;
  disabled?: boolean;
};

type ImportPreview = {
  fileName: string;
  parseResult: ScenarioImportParseResult;
  buildResult: ScenarioImportBuildResult;
};

function formatIssueSummary(issues: ScenarioImportIssue[]): string[] {
  return issues.map((issue) => issue.message);
}

export function ImportScenariosPanel({
  countryCode,
  flowDirection,
  onImportSuccess,
  disabled = false
}: ImportScenariosPanelProps) {
  const inputId = useId();
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const issues = useMemo(
    () => (preview ? [...preview.parseResult.issues, ...preview.buildResult.issues] : []),
    [preview]
  );
  const warnings = issues.filter((issue) => issue.severity === 'WARN');
  const errors = issues.filter((issue) => issue.severity === 'ERROR');
  const canReplace = Boolean(preview) && errors.length === 0 && preview.buildResult.summary.rowCount > 0;

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setImportFeedback(null);

    try {
      const parseResult = await parseScenarioFile(file);
      const buildResult = buildStateManagerConfigFromImportRows(
        parseResult.normalizedRows,
        countryCode,
        flowDirection
      );
      setPreview({
        fileName: file.name,
        parseResult,
        buildResult
      });
    } catch (error) {
      setPreview(null);
      setParseError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Unable to parse the selected scenario file.'
      );
    } finally {
      setIsParsing(false);
      event.target.value = '';
    }
  };

  const handleReplaceScenarios = () => {
    if (!preview || errors.length > 0) {
      return;
    }

    const nextConfig: StateManagerConfig = {
      countryCode,
      flowDirection,
      scenarios: preview.buildResult.scenarios,
      lastUpdated: new Date().toISOString()
    };

    onImportSuccess(nextConfig, preview.buildResult);
    setImportFeedback('Imported scenarios into the editor. Save Scenarios to persist changes.');
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h6">Import Scenarios</Typography>
          <Typography variant="body2" color="text.secondary">
            Upload CSV or Excel to populate scenario tabs and rows.
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Use one row per status transition row. Supported files: `.csv`, `.xlsx`, `.xls`.
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {SUPPORTED_SCENARIO_IMPORT_COLUMNS.map((column) => (
            <Chip
              key={column.key}
              label={column.required ? `${column.key} *` : column.key}
              size="small"
              color={column.required ? 'primary' : 'default'}
              variant="outlined"
            />
          ))}
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Sample columns: scenarioName, subFlowTitle, msgStatus, msgSubStatus, transactionStatus, transactionStatusReason.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <Button
            component="label"
            variant="outlined"
            startIcon={isParsing ? <CircularProgress size={16} color="inherit" /> : <UploadFileOutlinedIcon />}
            disabled={disabled || isParsing}
            htmlFor={inputId}
          >
            {isParsing ? 'Parsing file...' : 'Upload CSV / Excel'}
            <input
              id={inputId}
              hidden
              type="file"
              accept=".csv,.xlsx,.xls"
              aria-label="Scenario import file"
              onChange={handleFileChange}
            />
          </Button>
          {preview ? (
            <Typography variant="body2" color="text.secondary">
              {preview.fileName}
            </Typography>
          ) : null}
        </Stack>

        {parseError ? <Alert severity="error">{parseError}</Alert> : null}
        {importFeedback ? <Alert severity="success">{importFeedback}</Alert> : null}

        {preview ? (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`${preview.buildResult.summary.scenarioCount} scenarios`} variant="outlined" />
              <Chip label={`${preview.buildResult.summary.subFlowCount} sub-flows`} variant="outlined" />
              <Chip label={`${preview.buildResult.summary.rowCount} rows`} variant="outlined" />
              <Chip
                label={`${warnings.length} warnings`}
                variant="outlined"
                color={warnings.length > 0 ? 'warning' : 'default'}
              />
              <Chip
                label={`${errors.length} errors`}
                variant="outlined"
                color={errors.length > 0 ? 'error' : 'default'}
              />
              <Chip label={preview.parseResult.fileType.toUpperCase()} variant="outlined" />
            </Stack>

            {errors.length === 0 ? (
              <Alert severity="success">Import ready. Confirm to replace the current scenarios in the editor.</Alert>
            ) : (
              <Alert severity="error">Resolve the import errors before replacing the current scenarios.</Alert>
            )}

            {warnings.length > 0 ? (
              <Alert severity="warning">
                <Box component="ul" sx={{ mb: 0, mt: 0, pl: 2 }}>
                  {formatIssueSummary(warnings).map((message) => (
                    <Box component="li" key={message}>
                      {message}
                    </Box>
                  ))}
                </Box>
              </Alert>
            ) : null}

            {errors.length > 0 ? (
              <Alert severity="error">
                <Box component="ul" sx={{ mb: 0, mt: 0, pl: 2 }}>
                  {formatIssueSummary(errors).map((message) => (
                    <Box component="li" key={message}>
                      {message}
                    </Box>
                  ))}
                </Box>
              </Alert>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
              <Button
                variant="contained"
                onClick={handleReplaceScenarios}
                disabled={disabled || isParsing || !canReplace}
              >
                Replace Current Scenarios
              </Button>
              <Typography variant="body2" color="text.secondary">
                This replaces the current scenario tabs in the editor only. Nothing is persisted until Save Scenarios.
              </Typography>
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
