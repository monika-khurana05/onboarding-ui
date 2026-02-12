import { Autocomplete, Chip, TextField } from '@mui/material';

type ActionMultiSelectProps = {
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

export function ActionMultiSelect({
  value,
  options,
  onChange,
  placeholder = 'Select or type actions'
}: ActionMultiSelectProps) {
  return (
    <Autocomplete
      multiple
      freeSolo
      options={options}
      value={value}
      onChange={(_, next) => onChange(next.map((option) => String(option).trim()).filter(Boolean))}
      filterSelectedOptions
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip label={option} {...getTagProps({ index })} key={option} size="small" />
        ))
      }
      renderInput={(params) => <TextField {...params} size="small" placeholder={placeholder} />}
      fullWidth
    />
  );
}
