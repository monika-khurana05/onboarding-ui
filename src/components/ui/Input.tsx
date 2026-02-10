import { TextField, type TextFieldProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { forwardRef } from 'react';

export type InputProps = TextFieldProps;

const baseStyles: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--border)'
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--text-muted)'
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--accent)'
    },
    '&.Mui-error .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--error)'
    }
  },
  '& .MuiFormHelperText-root.Mui-error': {
    color: 'var(--error)'
  }
};

export const Input = forwardRef<HTMLDivElement, InputProps>((props, ref) => {
  const { sx, variant = 'outlined', className, InputProps, inputProps, FormHelperTextProps, ...rest } = props;
  const inputRootClassName = [
    '!bg-surface2 !text-foreground rounded-[var(--radius-md)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)]',
    InputProps?.className
  ]
    .filter(Boolean)
    .join(' ');
  const inputClassName = ['text-foreground placeholder:text-muted', inputProps?.className]
    .filter(Boolean)
    .join(' ');
  return (
    <TextField
      ref={ref}
      variant={variant}
      className={className}
      InputProps={{ ...InputProps, className: inputRootClassName }}
      inputProps={{ ...inputProps, className: inputClassName }}
      FormHelperTextProps={FormHelperTextProps}
      sx={[baseStyles, sx]}
      {...rest}
    />
  );
});

Input.displayName = 'Input';


