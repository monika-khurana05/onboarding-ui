import { TextField, type TextFieldProps } from '@mui/material';

type CountryCodeFieldProps = Omit<TextFieldProps, 'label' | 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
};

export function CountryCodeField({ value, onChange, helperText, inputProps, ...rest }: CountryCodeFieldProps) {
  return (
    <TextField
      fullWidth
      label="Country Code"
      placeholder="GB, SG, AE"
      value={value}
      onChange={(event) => onChange(event.target.value.toUpperCase())}
      helperText={helperText}
      inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' }, ...inputProps }}
      InputLabelProps={{ sx: { textAlign: 'left' } }}
      {...rest}
    />
  );
}
