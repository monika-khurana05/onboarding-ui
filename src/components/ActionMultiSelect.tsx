import { Autocomplete, Chip, TextField } from '@mui/material';

const actionCatalog = [
  'persist-txn',
  'notify-bd-error',
  'notify-bd-intermediate',
  'reset-mtp',
  'initiate-psp-enrichment',
  'do-spm-check',
  'send-sanctions-request',
  'queue-retry',
  'emit-state-change',
  'publish-clearing-event'
];

type ActionMultiSelectProps = {
  value: string[];
  onChange: (next: string[]) => void;
};

export function ActionMultiSelect({ value, onChange }: ActionMultiSelectProps) {
  return (
    <Autocomplete
      multiple
      options={actionCatalog}
      value={value}
      onChange={(_, next) => onChange(next)}
      filterSelectedOptions
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip label={option} {...getTagProps({ index })} key={option} size="small" />
        ))
      }
      renderInput={(params) => <TextField {...params} size="small" placeholder="Select actions" />}
      fullWidth
    />
  );
}
