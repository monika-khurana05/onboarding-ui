import CheckIcon from '@mui/icons-material/Check';
import { Box, Step, StepLabel, Stepper, StepConnector } from '@mui/material';
import type { StepIconProps } from '@mui/material/StepIcon';
import { styled } from '@mui/material/styles';

export type WizardStepperProps = {
  steps: string[];
  activeStep: number;
  className?: string;
};

const WizardStepConnector = styled(StepConnector)(() => ({
  '& .MuiStepConnector-line': {
    borderColor: 'var(--border)',
    borderTopWidth: 2
  },
  '&.MuiStepConnector-active .MuiStepConnector-line': {
    borderColor: 'var(--accent)'
  },
  '&.MuiStepConnector-completed .MuiStepConnector-line': {
    borderColor: 'var(--success)'
  }
}));

function WizardStepIcon({ active, completed, icon }: StepIconProps) {
  const base = 'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold';
  const stateClass = completed
    ? 'border-success bg-success text-primary-fg'
    : active
    ? 'border-accent bg-surface2 text-accent'
    : 'border-border bg-surface text-muted';

  return (
    <Box className={`${base} ${stateClass}`}>
      {completed ? <CheckIcon fontSize="small" /> : <span>{icon}</span>}
    </Box>
  );
}

export function WizardStepper({ steps, activeStep, className }: WizardStepperProps) {
  return (
    <Stepper
      activeStep={activeStep}
      alternativeLabel
      connector={<WizardStepConnector />}
      aria-label="Progress steps"
      className={className}
      sx={{
        '& .MuiStepLabel-label': {
          color: 'var(--text-muted)',
          fontWeight: 600
        },
        '& .MuiStepLabel-label.Mui-active': {
          color: 'var(--accent)'
        },
        '& .MuiStepLabel-label.Mui-completed': {
          color: 'var(--text)'
        }
      }}
    >
      {steps.map((label) => (
        <Step key={label}>
          <StepLabel StepIconComponent={WizardStepIcon}>{label}</StepLabel>
        </Step>
      ))}
    </Stepper>
  );
}
