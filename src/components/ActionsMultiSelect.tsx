import { Autocomplete, Chip, Stack, TextField, Tooltip } from '@mui/material';
import { useMemo } from 'react';
import { fsmCatalog } from '../lib/fsmCatalog';

type ActionsMultiSelectProps = {
  value: string[];
  onChange: (next: string[]) => void;
  options?: string[];
  placeholder?: string;
  size?: 'small' | 'medium';
};

const actionDescriptions: Record<string, string> = {
  'persist-txn': 'Persist transaction state to the datastore.',
  'notify-bd-error': 'Notify downstream systems of an error condition.',
  'notify-bd-intermediate': 'Send an intermediate status update downstream.',
  'reset-mtp': 'Reset MTP context to prepare for a retry.',
  'initiate-psp-enrichment': 'Trigger PSP enrichment workflow.',
  'initiate-bank-code-enrichment': 'Trigger bank code enrichment workflow.',
  'process-psp-enrichment-failure': 'Handle PSP enrichment failure flow.',
  'process-bank-enrichment-failure': 'Handle bank code enrichment failure flow.',
  'do-spm-check': 'Run SPM screening check.',
  'send-sanctions-request': 'Dispatch a sanctions screening request.',
  'save-spm-result': 'Persist SPM screening result.',
  'save-spm-error-result': 'Persist SPM screening error result.',
  'save-spm-failed-result': 'Persist SPM screening failed result.',
  'clearing-final-nack-ar-outgoing': 'Emit final clearing NACK to AR outbound.'
};

const normalizeActionKey = (value: string) => value.trim().toLowerCase();

const resolveActionGroup = (actionName: string) => {
  const normalized = normalizeActionKey(actionName);
  if (normalized.includes('persist') || normalized.startsWith('save-')) {
    return 'Persistence';
  }
  if (normalized.startsWith('notify-') || normalized.includes('nack') || normalized.includes('emit') || normalized.includes('publish')) {
    return 'Notification';
  }
  if (normalized.includes('enrich') || normalized.startsWith('process-')) {
    return 'Enrichment';
  }
  if (normalized.includes('sanction') || normalized.includes('spm')) {
    return 'Sanctions';
  }
  if (normalized.includes('retry') || normalized.includes('reset') || normalized.includes('queue')) {
    return 'Retry/Recovery';
  }
  return 'Notification';
};

export function ActionsMultiSelect({
  value,
  onChange,
  options,
  placeholder = 'Select or type actions',
  size = 'small'
}: ActionsMultiSelectProps) {
  const resolvedOptions = options ?? fsmCatalog.actions;
  const normalizedValues = useMemo(
    () => value.map((action) => action.trim()).filter(Boolean),
    [value]
  );

  return (
    <Autocomplete
      multiple
      freeSolo
      options={resolvedOptions}
      value={normalizedValues}
      onChange={(_, next) => onChange(next.map((option) => String(option).trim()).filter(Boolean))}
      groupBy={resolveActionGroup}
      filterSelectedOptions
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => {
          const description = actionDescriptions[option];
          const chip = <Chip label={option} {...getTagProps({ index })} key={option} size={size} />;
          return description ? (
            <Tooltip title={description} key={option}>
              <Stack component="span">{chip}</Stack>
            </Tooltip>
          ) : (
            chip
          );
        })
      }
      renderOption={(props, option) => {
        const description = actionDescriptions[option];
        return (
          <li {...props}>
            {description ? (
              <Tooltip title={description}>
                <Stack component="span">{option}</Stack>
              </Tooltip>
            ) : (
              option
            )}
          </li>
        );
      }}
      renderInput={(params) => <TextField {...params} size={size} placeholder={placeholder} />}
      fullWidth
    />
  );
}
