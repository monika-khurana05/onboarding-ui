import MuiButton, { type ButtonProps as MuiButtonProps } from '@mui/material/Button';
import { forwardRef } from 'react';

type ButtonTone = 'primary' | 'secondary' | 'ghost';
type ButtonVariant = ButtonTone | MuiButtonProps['variant'];

export type ButtonProps = Omit<MuiButtonProps, 'variant' | 'color'> & {
  variant?: ButtonVariant;
};

const resolveTone = (variant?: ButtonVariant): ButtonTone => {
  if (variant === 'secondary' || variant === 'outlined') {
    return 'secondary';
  }
  if (variant === 'ghost' || variant === 'text') {
    return 'ghost';
  }
  return 'primary';
};

const baseClassName =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)] disabled:!text-foreground';

const toneClassNames: Record<ButtonTone, string> = {
  primary:
    '!bg-primary !text-primary-fg hover:!bg-primary-hover active:!bg-primary-active disabled:!bg-primary',
  secondary:
    '!bg-surface2 !text-foreground border border-border hover:!bg-surface2 active:!bg-surface2 disabled:!bg-surface2',
  ghost: '!bg-transparent !text-foreground hover:!bg-surface2 active:!bg-surface2'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const { variant, sx, className, ...rest } = props;
  const tone = resolveTone(variant);
  const muiVariant = tone === 'secondary' ? 'outlined' : tone === 'ghost' ? 'text' : 'contained';
  const resolvedClassName = [baseClassName, toneClassNames[tone], className].filter(Boolean).join(' ');

  return <MuiButton ref={ref} variant={muiVariant} className={resolvedClassName} sx={sx} {...rest} />;
});

Button.displayName = 'Button';

