import { Typography, type TypographyProps } from '@mui/material';
import type { ReactNode } from 'react';

type InlineHelpTextProps = Omit<TypographyProps, 'variant' | 'color' | 'children'> & {
  children: ReactNode;
};

export function InlineHelpText({ children, sx, ...rest }: InlineHelpTextProps) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      {...rest}
      sx={{
        display: 'block',
        ...sx
      }}
    >
      {children}
    </Typography>
  );
}
