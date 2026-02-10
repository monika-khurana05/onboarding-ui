import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Collapse, IconButton, Stack } from '@mui/material';
import { useMemo, useState } from 'react';
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
  defaultExpanded?: boolean;
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
  onCopyError,
  defaultExpanded = true
}: JsonMonacoPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
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
      <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
        {showCopy ? (
          <IconButton aria-label="Copy JSON" onClick={() => void handleCopy()}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        ) : null}
        <IconButton
          aria-label={expanded ? 'Collapse JSON panel' : 'Expand JSON panel'}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Stack>
      <Collapse in={expanded}>
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
      </Collapse>
    </Stack>
  );
}
