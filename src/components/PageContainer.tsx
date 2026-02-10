import { Stack } from '@mui/material';
import type { PropsWithChildren, ReactNode } from 'react';
import { spacingScale } from '../theme/designSystem';
import { SectionHeader } from './SectionHeader';

type PageContainerProps = PropsWithChildren<{
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}>;

export function PageContainer({ title, subtitle, actions, children }: PageContainerProps) {
  return (
    <Stack
      spacing={spacingScale.s32}
      sx={{
        width: '100%',
        maxWidth: { xs: '100%', xl: '1180px' },
        mx: 'auto'
      }}
    >
      <SectionHeader title={title} subtitle={subtitle} actions={actions} level="page" />
      {children}
    </Stack>
  );
}


