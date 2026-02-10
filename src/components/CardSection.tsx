import { Stack } from '@mui/material';
import type { PropsWithChildren, ReactNode } from 'react';
import { enterpriseDesign, spacingScale } from '../theme/designSystem';
import { SectionHeader } from './SectionHeader';

import { Card, type CardProps } from '@ui/Card';
type CardSectionProps = PropsWithChildren<{
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  contentSpacing?: number;
  paperProps?: Omit<CardProps, 'children'>;
}>;

export function CardSection({
  title,
  subtitle,
  actions,
  children,
  contentSpacing = spacingScale.s16,
  paperProps
}: CardSectionProps) {
  const { sx: paperSx, ...paperRest } = paperProps ?? {};

  return (
    <Card
      elevation={0}
      variant="outlined"
      {...paperRest}
      className="transition-shadow hover:shadow-[var(--shadow-subtle)] hover:!border-accent"
      sx={[
        {
          p: {
            xs: `${enterpriseDesign.cardPadding.mobile}px`,
            md: `${enterpriseDesign.cardPadding.desktop}px`
          },
          borderRadius: `${enterpriseDesign.borderRadius}px`,
          transition: 'box-shadow 150ms ease, border-color 150ms ease'
        },
        paperSx
      ]}
    >
      <Stack spacing={contentSpacing}>
        <SectionHeader title={title} subtitle={subtitle} actions={actions} />
        {children}
      </Stack>
    </Card>
  );
}


