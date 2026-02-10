import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { Chip } from '@mui/material';

type StatusChipProps = {
  status: 'active' | 'pending' | 'blocked' | 'success' | 'failed' | 'running';
};

export function StatusChip({ status }: StatusChipProps) {
  switch (status) {
    case 'active':
    case 'success':
      return (
        <Chip
          size="small"
          color="success"
          variant="outlined"
          icon={<CheckCircleOutlineIcon />}
          label={status}
        />
      );
    case 'pending':
    case 'running':
      return (
        <Chip
          size="small"
          color="warning"
          variant="outlined"
          icon={<HourglassBottomIcon />}
          label={status}
        />
      );
    case 'blocked':
    case 'failed':
      return (
        <Chip
          size="small"
          color="error"
          variant="outlined"
          icon={<ReportProblemIcon />}
          label={status}
        />
      );
    default:
      return <Chip size="small" label={status} />;
  }
}
