import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { JsonAdvancedEditor } from './JsonAdvancedEditor';
import type { DupCheckConfig, DupCheckKeyField } from '../models/snapshot';

type ParamsEditorDrawerProps = {
  open: boolean;
  title?: string;
  description?: string;
  params?: Record<string, any>;
  dupCheckConfig?: DupCheckConfig;
  dupCheckFields?: ReadonlyArray<{ key: DupCheckKeyField; label: string }>;
  dupCheckHelperText?: string;
  onSaveDupCheck?: (config: DupCheckConfig) => void;
  onReset?: () => void;
  onClose: () => void;
  onSave: (params: Record<string, any>) => void;
};

type ParamEntry = {
  key: string;
  value: string;
};

function parseParamValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function buildParamsFromEntries(entries: ParamEntry[]) {
  const result: Record<string, any> = {};
  entries.forEach((entry) => {
    const key = entry.key.trim();
    if (!key) {
      return;
    }
    result[key] = parseParamValue(entry.value);
  });
  return result;
}

function normalizeEntries(params?: Record<string, any>): ParamEntry[] {
  if (!params) {
    return [];
  }
  return Object.entries(params).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value)
  }));
}

export function ParamsEditorDrawer({
  open,
  title = 'Configure Params',
  description = 'Configure params aligned to the CPX runtime diagram. Use JSON for advanced values.',
  params,
  dupCheckConfig,
  dupCheckFields,
  dupCheckHelperText = 'Select which fields should be concatenated to build the duplicate-check key.',
  onSaveDupCheck,
  onReset,
  onClose,
  onSave
}: ParamsEditorDrawerProps) {
  const [mode, setMode] = useState<'kv' | 'json'>('kv');
  const [entries, setEntries] = useState<ParamEntry[]>([]);
  const [jsonValue, setJsonValue] = useState('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [dupCheckValues, setDupCheckValues] = useState<Record<string, boolean>>({});
  const [dupCheckDelimiter, setDupCheckDelimiter] = useState('|');
  const [dupCheckCaseMode, setDupCheckCaseMode] = useState<'SENSITIVE' | 'INSENSITIVE'>('SENSITIVE');

  const initialJson = useMemo(() => JSON.stringify(params ?? {}, null, 2), [params]);
  const initialDupCheckValues = useMemo(() => {
    if (!dupCheckFields?.length) {
      return {};
    }
    const selected = new Set(dupCheckConfig?.keyFields ?? []);
    return dupCheckFields.reduce<Record<string, boolean>>((acc, field) => {
      acc[field.key] = selected.has(field.key);
      return acc;
    }, {});
  }, [dupCheckConfig?.keyFields, dupCheckFields]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setEntries(normalizeEntries(params));
    setJsonValue(initialJson);
    setJsonError(null);
    setMode('kv');
    setDupCheckValues(initialDupCheckValues);
    setDupCheckDelimiter(dupCheckConfig?.delimiter?.trim() ? dupCheckConfig.delimiter : '|');
    setDupCheckCaseMode(dupCheckConfig?.caseMode === 'INSENSITIVE' ? 'INSENSITIVE' : 'SENSITIVE');
  }, [dupCheckConfig?.caseMode, dupCheckConfig?.delimiter, initialDupCheckValues, initialJson, open, params]);

  const dupCheckSelectedKeys = useMemo(() => {
    if (!dupCheckFields?.length) {
      return [];
    }
    return dupCheckFields.filter((field) => dupCheckValues[field.key]).map((field) => field.key);
  }, [dupCheckFields, dupCheckValues]);

  const hasDupCheckBuilder = Boolean(dupCheckFields?.length);
  const dupCheckMissingSelection = hasDupCheckBuilder && dupCheckSelectedKeys.length === 0;
  const canSave = (mode === 'kv' || !jsonError) && !dupCheckMissingSelection;

  const normalizedDupCheckDelimiter = dupCheckDelimiter.trim() ? dupCheckDelimiter : '|';
  const dupCheckTemplate = dupCheckSelectedKeys.length
    ? dupCheckSelectedKeys.map((key) => `\${${key}}`).join(normalizedDupCheckDelimiter)
    : 'Select fields to build a key';
  const exampleValues: Record<DupCheckKeyField, string> = {
    bankSettlementType: 'INTRADAY',
    paymentID: '<paymentID>',
    debitAcctID: '<debitAcctID>',
    creditAcctID: '<creditAcctID>',
    clearingSystemMemId: '<clearingSystemMemId>',
    ccy: 'ARS'
  };
  const dupCheckExample = dupCheckSelectedKeys.length
    ? dupCheckSelectedKeys
        .map((key) => `${key}=${exampleValues[key] ?? '<value>'}`)
        .join(` ${normalizedDupCheckDelimiter} `)
    : '—';

  const handleSave = () => {
    if (mode === 'json') {
      if (jsonError) {
        return;
      }
      onSave(JSON.parse(jsonValue));
      if (onSaveDupCheck && dupCheckFields?.length) {
        onSaveDupCheck({
          keyFields: dupCheckSelectedKeys,
          delimiter: normalizedDupCheckDelimiter,
          caseMode: dupCheckCaseMode
        });
      }
      onClose();
      return;
    }
    onSave(buildParamsFromEntries(entries));
    if (onSaveDupCheck && dupCheckFields?.length) {
      onSaveDupCheck({
        keyFields: dupCheckSelectedKeys,
        delimiter: normalizedDupCheckDelimiter,
        caseMode: dupCheckCaseMode
      });
    }
    onClose();
  };

  const handleReset = () => {
    setEntries([]);
    setJsonValue('{}');
    setJsonError(null);
    setMode('kv');
    if (dupCheckFields?.length) {
      const resetValues = dupCheckFields.reduce<Record<string, boolean>>((acc, field) => {
        acc[field.key] = false;
        return acc;
      }, {});
      setDupCheckValues(resetValues);
      setDupCheckDelimiter('|');
      setDupCheckCaseMode('SENSITIVE');
    }
    onReset?.();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          top: { xs: 56, sm: 64 },
          height: { xs: 'calc(100% - 56px)', sm: 'calc(100% - 64px)' }
        }
      }}
    >
      <Box
        sx={{
          width: { xs: 320, sm: 420 },
          p: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
          <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
            <Stack spacing={0.5}>
              <Typography variant="h6">{title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            </Stack>
            {dupCheckFields?.length ? (
              <Stack spacing={1.5}>
                <Stack spacing={0.25}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Duplicate Check Key Builder
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {dupCheckHelperText}
                  </Typography>
                </Stack>
                <Stack spacing={0.75}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        setDupCheckValues((prev) => ({
                          ...prev,
                          ccy: true,
                          paymentID: true,
                          bankSettlementType: false,
                          debitAcctID: false,
                          creditAcctID: false,
                          clearingSystemMemId: false
                        }))
                      }
                    >
                      Select common preset: ccy + paymentID
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        setDupCheckValues((prev) => ({
                          ...prev,
                          debitAcctID: true,
                          creditAcctID: true,
                          bankSettlementType: false,
                          paymentID: false,
                          clearingSystemMemId: false,
                          ccy: false
                        }))
                      }
                    >
                      Select common preset: debitAcctID + creditAcctID
                    </Button>
                    <Button size="small" variant="text" color="warning" onClick={() => {
                      const cleared = dupCheckFields.reduce<Record<string, boolean>>((acc, field) => {
                        acc[field.key] = false;
                        return acc;
                      }, {});
                      setDupCheckValues(cleared);
                    }}>
                      Clear selection
                    </Button>
                  </Stack>
                  <Stack spacing={0.5}>
                    {dupCheckFields.map((field) => {
                      const checked = Boolean(dupCheckValues[field.key]);
                      return (
                        <Stack key={field.key} direction="row" spacing={1} alignItems="center">
                          <Checkbox
                            checked={checked}
                            onChange={(_, value) =>
                              setDupCheckValues((prev) => ({ ...prev, [field.key]: value }))
                            }
                            size="small"
                          />
                          <Stack spacing={0}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {field.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {field.key}
                            </Typography>
                          </Stack>
                        </Stack>
                      );
                    })}
                  </Stack>
                  <TextField
                    label="Delimiter"
                    size="small"
                    value={dupCheckDelimiter}
                    onChange={(event) => setDupCheckDelimiter(event.target.value)}
                    helperText="Delimiter used when composing the key."
                    FormHelperTextProps={{ sx: { color: 'text.secondary', fontSize: 11 } }}
                    inputProps={{ maxLength: 6 }}
                    fullWidth
                  />
                  <Box
                    sx={(theme) => ({
                      p: 1.5,
                      borderRadius: 1,
                      border: `1px solid ${theme.palette.divider}`,
                      backgroundColor: theme.palette.background.default
                    })}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Template
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                      {dupCheckTemplate}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Example
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                      {dupCheckExample}
                    </Typography>
                  </Box>
                  {dupCheckMissingSelection ? (
                    <Alert severity="warning">Select at least one field to build the key.</Alert>
                  ) : null}
                </Stack>
                <Divider />
              </Stack>
            ) : null}
            {hasDupCheckBuilder ? (
              <Stack spacing={0.25}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Advanced Params (optional)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Optional key/value pairs passed through to the CPX runtime.
                </Typography>
              </Stack>
            ) : null}
            <Tabs value={mode} onChange={(_, value) => setMode(value as 'kv' | 'json')}>
              <Tab value="kv" label="Key/Value" />
              <Tab value="json" label="JSON" />
            </Tabs>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
            {mode === 'kv' ? (
              <Stack spacing={1.5}>
                {entries.map((entry, index) => (
                  <Stack key={`${entry.key}-${index}`} direction="row" spacing={1}>
                    <TextField
                      label="Key"
                      size="small"
                      value={entry.key}
                      onChange={(event) => {
                        const next = [...entries];
                        next[index] = { ...next[index], key: event.target.value };
                        setEntries(next);
                      }}
                      fullWidth
                    />
                    <TextField
                      label="Value"
                      size="small"
                      value={entry.value}
                      onChange={(event) => {
                        const next = [...entries];
                        next[index] = { ...next[index], value: event.target.value };
                        setEntries(next);
                      }}
                      fullWidth
                    />
                    <IconButton
                      aria-label="Remove param"
                      onClick={() => setEntries(entries.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Stack>
                ))}
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setEntries([...entries, { key: '', value: '' }])}
                >
                  Add Param
                </Button>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <JsonAdvancedEditor
                  ariaLabel="Params JSON editor"
                  value={jsonValue}
                  onChange={(next) => {
                    setJsonValue(next);
                    try {
                      const parsed = JSON.parse(next);
                      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        setJsonError('Params JSON must be an object.');
                        return;
                      }
                      setJsonError(null);
                    } catch {
                      setJsonError('JSON parse error. Check commas and quotes.');
                    }
                  }}
                  hideHelper
                  label="Params JSON"
                />
                {jsonError ? <Alert severity="warning">{jsonError}</Alert> : null}
              </Stack>
            )}
          </Box>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Stack direction="row" spacing={1}>
            {onReset ? (
              <Button variant="text" color="warning" onClick={handleReset}>
                Reset
              </Button>
            ) : null}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="text" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={!canSave}>
              Save Params
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
}
