import { Add, Delete } from '@mui/icons-material';
import { Button, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import { useCallback } from 'react';
import type { TopicConfig } from '../validation/types';

type TopicSelectorProps = {
  topics: TopicConfig[];
  onChange: (next: TopicConfig[]) => void;
};

const emptyTopic: TopicConfig = {
  serviceName: '',
  entryPoint: '',
  topicName: '',
  headersTemplate: {}
};

export function TopicSelector({ topics, onChange }: TopicSelectorProps) {
  const handleAddTopic = useCallback(() => {
    onChange([...topics, { ...emptyTopic }]);
  }, [onChange, topics]);

  const handleRemoveTopic = useCallback(
    (index: number) => {
      const next = topics.filter((_, idx) => idx !== index);
      onChange(next.length ? next : [{ ...emptyTopic }]);
    },
    [onChange, topics]
  );

  const handleUpdateTopic = useCallback(
    (index: number, updates: Partial<TopicConfig>) => {
      const next = topics.map((topic, idx) => (idx === index ? { ...topic, ...updates } : topic));
      onChange(next);
    },
    [onChange, topics]
  );

  const handleAddHeader = useCallback(
    (index: number) => {
      const topic = topics[index];
      const nextHeaders = { ...(topic.headersTemplate ?? {}) };
      const headerKey = `header-${Object.keys(nextHeaders).length + 1}`;
      nextHeaders[headerKey] = '';
      handleUpdateTopic(index, { headersTemplate: nextHeaders });
    },
    [handleUpdateTopic, topics]
  );

  const handleUpdateHeader = useCallback(
    (index: number, headerKey: string, value: string) => {
      const topic = topics[index];
      const nextHeaders = { ...(topic.headersTemplate ?? {}) };
      nextHeaders[headerKey] = value;
      handleUpdateTopic(index, { headersTemplate: nextHeaders });
    },
    [handleUpdateTopic, topics]
  );

  const handleRenameHeader = useCallback(
    (index: number, oldKey: string, newKey: string) => {
      const topic = topics[index];
      const nextHeaders = { ...(topic.headersTemplate ?? {}) };
      const value = nextHeaders[oldKey] ?? '';
      delete nextHeaders[oldKey];
      if (newKey.trim()) {
        nextHeaders[newKey.trim()] = value;
      }
      handleUpdateTopic(index, { headersTemplate: nextHeaders });
    },
    [handleUpdateTopic, topics]
  );

  const handleRemoveHeader = useCallback(
    (index: number, headerKey: string) => {
      const topic = topics[index];
      const nextHeaders = { ...(topic.headersTemplate ?? {}) };
      delete nextHeaders[headerKey];
      handleUpdateTopic(index, { headersTemplate: nextHeaders });
    },
    [handleUpdateTopic, topics]
  );

  return (
    <Stack spacing={2}>
      {topics.map((topic, index) => {
        const headers = Object.entries(topic.headersTemplate ?? {});
        return (
          <Paper key={`${topic.topicName}-${index}`} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2">Topic {index + 1}</Typography>
                <IconButton size="small" onClick={() => handleRemoveTopic(index)} aria-label="Remove topic">
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                <TextField
                  label="Service Name"
                  value={topic.serviceName}
                  onChange={(event) => handleUpdateTopic(index, { serviceName: event.target.value })}
                  placeholder="Payment Initiation"
                  sx={{ flex: 1, minWidth: 200 }}
                />
                <TextField
                  label="Entry Point"
                  value={topic.entryPoint}
                  onChange={(event) => handleUpdateTopic(index, { entryPoint: event.target.value })}
                  placeholder="incoming"
                  sx={{ flex: 1, minWidth: 160 }}
                />
                <TextField
                  label="Topic Name"
                  value={topic.topicName}
                  onChange={(event) => handleUpdateTopic(index, { topicName: event.target.value })}
                  placeholder="cpx.payments.incoming.in"
                  sx={{ flex: 1.5, minWidth: 220 }}
                />
              </Stack>

              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2">Headers Template</Typography>
                  <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => handleAddHeader(index)}>
                    Add Header
                  </Button>
                </Stack>
                {headers.length ? (
                  <Stack spacing={1}>
                    {headers.map(([headerKey, headerValue]) => (
                      <Stack key={headerKey} direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap>
                        <TextField
                          label="Header Key"
                          value={headerKey}
                          onChange={(event) => handleRenameHeader(index, headerKey, event.target.value)}
                          sx={{ flex: 1, minWidth: 160 }}
                        />
                        <TextField
                          label="Header Value"
                          value={headerValue}
                          onChange={(event) => handleUpdateHeader(index, headerKey, event.target.value)}
                          sx={{ flex: 1.5, minWidth: 200 }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveHeader(index, headerKey)}
                          aria-label="Remove header"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No headers configured.
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Paper>
        );
      })}
      <Button variant="outlined" startIcon={<Add />} onClick={handleAddTopic}>
        Add Topic
      </Button>
    </Stack>
  );
}
