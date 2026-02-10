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
    <Stack spacing={spacingScale.s24}>
      <SectionHeader title={title} subtitle={subtitle} actions={actions} level="page" />
      {children}
    </Stack>
  );
}
