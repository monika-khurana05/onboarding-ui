import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Box,
  Button,
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

type ParamsEditorDrawerProps = {
  open: boolean;
  title?: string;
  description?: string;
  params?: Record<string, any>;
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
  onClose,
  onSave
}: ParamsEditorDrawerProps) {
  const [mode, setMode] = useState<'kv' | 'json'>('kv');
  const [entries, setEntries] = useState<ParamEntry[]>([]);
  const [jsonValue, setJsonValue] = useState('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const initialJson = useMemo(() => JSON.stringify(params ?? {}, null, 2), [params]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setEntries(normalizeEntries(params));
    setJsonValue(initialJson);
    setJsonError(null);
    setMode('kv');
  }, [initialJson, open, params]);

  const canSave = mode === 'kv' || !jsonError;

  const handleSave = () => {
    if (mode === 'json') {
      if (jsonError) {
        return;
      }
      onSave(JSON.parse(jsonValue));
      onClose();
      return;
    }
    onSave(buildParamsFromEntries(entries));
    onClose();
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
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button variant="text" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={!canSave}>
            Save Params
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
