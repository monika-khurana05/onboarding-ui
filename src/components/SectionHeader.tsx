import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { spacingScale } from '../theme/designSystem';
import { InlineHelpText } from './InlineHelpText';

type SectionHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  level?: 'page' | 'section';
};

export function SectionHeader({ title, subtitle, actions, level = 'section' }: SectionHeaderProps) {
  const titleVariant = level === 'page' ? 'h4' : 'h5';

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      justifyContent="space-between"
      gap={spacingScale.s12}
    >
      <Stack spacing={spacingScale.s4}>
        <Typography variant={titleVariant}>{title}</Typography>
        {subtitle ? <InlineHelpText>{subtitle}</InlineHelpText> : null}
      </Stack>
      {actions ? <Box sx={{ width: { xs: '100%', md: 'auto' } }}>{actions}</Box> : null}
    </Stack>
  );
}


