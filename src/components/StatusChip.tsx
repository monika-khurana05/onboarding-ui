import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { Badge } from '@ui/Badge';
type StatusChipProps = {
  status: 'active' | 'pending' | 'blocked' | 'success' | 'failed' | 'running';
};

export function StatusChip({ status }: StatusChipProps) {
  switch (status) {
    case 'active':
    case 'success':
      return (
        <Badge
          size="small"
          tone="success"
          variant="outlined"
          icon={<CheckCircleOutlineIcon />}
          label={status}
        />
      );
    case 'pending':
    case 'running':
      return (
        <Badge
          size="small"
          tone="warning"
          variant="outlined"
          icon={<HourglassBottomIcon />}
          label={status}
        />
      );
    case 'blocked':
    case 'failed':
      return (
        <Badge
          size="small"
          tone="error"
          variant="outlined"
          icon={<ReportProblemIcon />}
          label={status}
        />
      );
    default:
      return <Badge size="small" label={status} />;
  }
}


