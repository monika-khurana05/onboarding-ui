import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Alert, Stack } from '@mui/material';
import { useState } from 'react';
import { JsonAdvancedEditor } from '../../components/JsonAdvancedEditor';
import { SectionCard } from '../../components/SectionCard';

import { Button } from '@ui/Button';
type JsonPayloadCardProps = {
  title: string;
  subtitle?: string;
  payload: unknown;
};

export function JsonPayloadCard({ title, subtitle, payload }: JsonPayloadCardProps) {
  const [copied, setCopied] = useState(false);
  const pretty = JSON.stringify(payload, null, 2);

  return (
    <SectionCard
      title={title}
      subtitle={subtitle}
      actions={
        <Button
          size="small"
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          aria-label={`Copy ${title}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(pretty);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            } catch {
              setCopied(false);
            }
          }}
        >
          Copy
        </Button>
      }
    >
      <Stack spacing={1.5}>
        {copied ? <Alert severity="success">Copied to clipboard.</Alert> : null}
        <JsonAdvancedEditor ariaLabel={`${title} JSON`} value={pretty} readOnly />
      </Stack>
    </SectionCard>
  );
}


