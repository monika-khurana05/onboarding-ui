import { lazy, Suspense, useMemo } from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

type JsonAdvancedEditorProps = {
  value: string;
  onChange?: (next: string) => void;
  ariaLabel: string;
  readOnly?: boolean;
  helperText?: string;
  hideHelper?: boolean;
  height?: number | string;
  label?: string;
};

export function JsonAdvancedEditor({
  value,
  onChange,
  ariaLabel,
  readOnly = false,
  helperText,
  hideHelper = false,
  height = '320px',
  label
}: JsonAdvancedEditorProps) {
  const theme = useTheme();
  const monacoTheme = theme.palette.mode === 'dark' ? 'vs-dark' : 'light';
  const monacoFontFamily = '"IBM Plex Mono", "Cascadia Mono", "Courier New", monospace';
  const fallbackEditor = useMemo(
    () => (
      <TextField
        fullWidth
        minRows={10}
        multiline
        value={value}
        label={label ?? 'JSON'}
        onChange={(event) => onChange?.(event.target.value)}
        InputProps={{
          readOnly,
          sx: {
            fontFamily: monacoFontFamily,
            fontSize: 13,
            lineHeight: 1.45
          }
        }}
        inputProps={{ 'aria-label': ariaLabel }}
      />
    ),
    [ariaLabel, label, monacoFontFamily, onChange, readOnly, value]
  );

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden' }}>
      <Suspense fallback={fallbackEditor}>
        <MonacoEditor
          height={height}
          language="json"
          value={value}
          onChange={(next) => onChange?.(next ?? '')}
          theme={monacoTheme}
          options={{
            minimap: { enabled: false },
            fontFamily: monacoFontFamily,
            fontSize: 13,
            lineHeight: 20,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            readOnly
          }}
        />
      </Suspense>
      {hideHelper ? null : (
        <Typography variant="caption" sx={{ p: 1.5, display: 'block', color: 'text.secondary' }}>
          {helperText ?? 'Advanced mode accepts strict JSON.'}
        </Typography>
      )}
    </Box>
  );
}
