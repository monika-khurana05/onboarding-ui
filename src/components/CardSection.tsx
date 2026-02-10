import { alpha } from '@mui/material/styles';
import { Paper, type PaperProps, Stack } from '@mui/material';
import type { PropsWithChildren, ReactNode } from 'react';
import { enterpriseDesign, spacingScale } from '../theme/designSystem';
import { SectionHeader } from './SectionHeader';

type CardSectionProps = PropsWithChildren<{
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  contentSpacing?: number;
  paperProps?: Omit<PaperProps, 'children'>;
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
    <Paper
      elevation={0}
      variant="outlined"
      {...paperRest}
      sx={[
        {
          p: {
            xs: `${enterpriseDesign.cardPadding.mobile}px`,
            md: `${enterpriseDesign.cardPadding.desktop}px`
          },
          borderRadius: `${enterpriseDesign.borderRadius}px`,
          transition: 'box-shadow 150ms ease, border-color 150ms ease',
          '&:hover': {
            boxShadow: (theme) => theme.shadows[2],
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.34)
          }
        },
        paperSx
      ]}
    >
      <Stack spacing={contentSpacing}>
        <SectionHeader title={title} subtitle={subtitle} actions={actions} />
        {children}
      </Stack>
    </Paper>
  );
}
