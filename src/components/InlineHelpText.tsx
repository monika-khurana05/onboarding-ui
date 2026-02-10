import { Typography, type TypographyProps } from '@mui/material';
import type { ReactNode } from 'react';

type InlineHelpTextProps = Omit<TypographyProps, 'variant' | 'color' | 'children'> & {
  children: ReactNode;
};

export function InlineHelpText({ children, sx, className, ...rest }: InlineHelpTextProps) {
  return (
    <Typography
      variant="caption"
      {...rest}
      className={['text-muted', className].filter(Boolean).join(' ')}
      sx={{
        display: 'block',
        ...sx
      }}
    >
      {children}
    </Typography>
  );
}


