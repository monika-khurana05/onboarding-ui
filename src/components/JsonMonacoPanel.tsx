import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Box, IconButton, Stack } from '@mui/material';
import { useMemo } from 'react';
import { JsonAdvancedEditor } from './JsonAdvancedEditor';

type JsonMonacoPanelProps = {
  ariaLabel: string;
  value: unknown;
  onChange?: (next: string) => void;
  readOnly?: boolean;
  pretty?: boolean;
  showCopy?: boolean;
  helperText?: string;
  onCopyError?: (error: unknown) => void;
};

function stringifyValue(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function JsonMonacoPanel({
  ariaLabel,
  value,
  onChange,
  readOnly = false,
  pretty,
  showCopy = true,
  helperText,
  onCopyError
}: JsonMonacoPanelProps) {
  const serializedValue = useMemo(() => {
    if (typeof value === 'string') {
      if (readOnly && (pretty ?? true)) {
        try {
          return stringifyValue(JSON.parse(value));
        } catch {
          return value;
        }
      }
      return value;
    }
    return stringifyValue(value);
  }, [pretty, readOnly, value]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(serializedValue);
    } catch (error) {
      onCopyError?.(error);
    }
  };

  return (
    <Stack spacing={1}>
      {showCopy ? (
        <Stack direction="row" justifyContent="flex-end">
          <IconButton aria-label="Copy JSON" onClick={() => void handleCopy()}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Stack>
      ) : null}
      <Box>
        <JsonAdvancedEditor
          ariaLabel={ariaLabel}
          value={serializedValue}
          onChange={readOnly ? undefined : onChange}
          readOnly={readOnly}
          helperText={helperText}
          hideHelper={!helperText}
        />
      </Box>
    </Stack>
  );
}
