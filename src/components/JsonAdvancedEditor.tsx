import { Suspense, lazy, useMemo } from 'react';
import { Box, TextField, Typography } from '@mui/material';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

type JsonAdvancedEditorProps = {
  value: string;
  onChange?: (next: string) => void;
  ariaLabel: string;
  readOnly?: boolean;
};

export function JsonAdvancedEditor({ value, onChange, ariaLabel, readOnly = false }: JsonAdvancedEditorProps) {
  const fallbackEditor = useMemo(
    () => (
      <TextField
        fullWidth
        minRows={10}
        multiline
        value={value}
        label="Workflow JSON"
        onChange={(event) => onChange?.(event.target.value)}
        InputProps={{ readOnly }}
        inputProps={{ 'aria-label': ariaLabel }}
      />
    ),
    [ariaLabel, onChange, readOnly, value]
  );

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Suspense fallback={fallbackEditor}>
        <MonacoEditor
          height="320px"
          language="json"
          value={value}
          onChange={(next) => onChange?.(next ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            readOnly
          }}
        />
      </Suspense>
      <Typography variant="caption" sx={{ p: 1.5, display: 'block', color: 'text.secondary' }}>
        Advanced mode accepts strict JSON and validates against the workflow schema.
      </Typography>
    </Box>
  );
}
