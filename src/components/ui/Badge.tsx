import { Chip, type ChipProps } from '@mui/material';
import { forwardRef } from 'react';

type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'muted' | 'primary' | 'accent';

type BadgeStatus = 'validated' | 'draft' | 'failed' | 'generated' | 'warning';

type BadgeVariant = 'filled' | 'outlined';

export type BadgeProps = Omit<ChipProps, 'color' | 'variant'> & {
  tone?: BadgeTone;
  status?: BadgeStatus;
  variant?: BadgeVariant;
};

const statusToTone: Record<BadgeStatus, BadgeTone> = {
  validated: 'success',
  draft: 'muted',
  failed: 'error',
  generated: 'info',
  warning: 'warning'
};

const statusLabel: Record<BadgeStatus, string> = {
  validated: 'Validated',
  draft: 'Draft',
  failed: 'Failed',
  generated: 'Generated',
  warning: 'Warning'
};

const toneClasses: Record<BadgeTone, Record<BadgeVariant, string>> = {
  success: {
    filled: '!bg-success !text-primary-fg',
    outlined: 'border border-success !text-success !bg-transparent'
  },
  warning: {
    filled: '!bg-warning !text-accent-fg',
    outlined: 'border border-warning !text-warning !bg-transparent'
  },
  error: {
    filled: '!bg-error !text-primary-fg',
    outlined: 'border border-error !text-error !bg-transparent'
  },
  info: {
    filled: '!bg-info !text-primary-fg',
    outlined: 'border border-info !text-info !bg-transparent'
  },
  primary: {
    filled: '!bg-primary !text-primary-fg',
    outlined: 'border border-primary !text-primary !bg-transparent'
  },
  accent: {
    filled: '!bg-accent !text-accent-fg',
    outlined: 'border border-accent !text-accent !bg-transparent'
  },
  muted: {
    filled: '!bg-surface2 !text-muted border border-border',
    outlined: 'border border-border !text-muted !bg-transparent'
  }
};

export const Badge = forwardRef<HTMLDivElement, BadgeProps>((props, ref) => {
  const { tone, status, variant = 'filled', label, size = 'small', className, ...rest } = props;
  const resolvedTone = status ? statusToTone[status] : tone ?? 'muted';
  const resolvedLabel = label ?? (status ? statusLabel[status] : undefined);
  const resolvedClassName = [
    'rounded-[var(--radius-sm)] text-xs font-semibold',
    toneClasses[resolvedTone][variant],
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Chip
      ref={ref}
      size={size}
      label={resolvedLabel}
      className={resolvedClassName}
      sx={{ textTransform: 'none' }}
      {...rest}
    />
  );
});

Badge.displayName = 'Badge';


