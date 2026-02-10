import { Paper, type PaperProps } from '@mui/material';
import { forwardRef } from 'react';

export type CardProps = PaperProps;

const baseClassName =
  '!bg-surface border !border-border !shadow-[var(--shadow-subtle)] rounded-[var(--radius-md)]';

export const Card = forwardRef<HTMLDivElement, CardProps>((props, ref) => {
  const { sx, className, elevation = 0, variant = 'outlined', ...rest } = props;
  const resolvedClassName = [baseClassName, className].filter(Boolean).join(' ');

  return <Paper ref={ref} elevation={elevation} variant={variant} className={resolvedClassName} sx={sx} {...rest} />;
});

Card.displayName = 'Card';


