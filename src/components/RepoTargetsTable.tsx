import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Button,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useMemo } from 'react';

export type RepoDefaultsEntry = {
  slug: string;
  label?: string;
  defaultRef: string;
};

export type RepoTarget = {
  id: string;
  label?: string;
  description?: string;
  matchHints?: string[];
  enabled?: boolean;
  repoSlug: string;
  baseBranch: string;
  packVersion: string;
  packOptions?: string[];
  loadingPacks?: boolean;
};

type RepoTargetsTableProps = {
  variant?: 'wizard' | 'simple';
  targets: RepoTarget[];
  onChange: (next: RepoTarget[]) => void;
  repoDefaults?: RepoDefaultsEntry[];
  onDiscoverPacks?: (repoSlug: string, baseBranch?: string) => Promise<string[]>;
  onError?: (message: string) => void;
  allowAdd?: boolean;
  addLabel?: string;
  allowRemove?: boolean;
  onAddTarget?: () => void;
  onRemoveTarget?: (index: number) => void;
  showValidationHint?: boolean;
  showErrors?: boolean;
};

function defaultTargetTemplate(): RepoTarget {
  return {
    id: `repo-${Date.now()}`,
    label: 'repo target',
    repoSlug: '',
    baseBranch: 'main',
    packVersion: ''
  };
}

export function RepoTargetsTable({
  variant = 'simple',
  targets,
  onChange,
  repoDefaults,
  onDiscoverPacks,
  onError,
  allowAdd = false,
  addLabel,
  allowRemove = false,
  onAddTarget,
  onRemoveTarget,
  showValidationHint = false,
  showErrors
}: RepoTargetsTableProps) {
  const repoDefaultMap = useMemo(
    () => new Map((repoDefaults ?? []).map((repo) => [repo.slug, repo.defaultRef])),
    [repoDefaults]
  );

  const handleUpdate = (index: number, patch: Partial<RepoTarget>) => {
    onChange(targets.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const handleRepoSlugChange = (index: number, nextSlug: string) => {
    const trimmed = nextSlug.trim();
    const row = targets[index];
    const defaultBranch = repoDefaultMap.get(trimmed);
    const shouldDefaultBranch = !row.baseBranch.trim() || row.baseBranch.trim().toLowerCase() === 'main';
    handleUpdate(index, {
      repoSlug: nextSlug,
      baseBranch: defaultBranch && shouldDefaultBranch ? defaultBranch : row.baseBranch,
      packOptions: [],
      packVersion: ''
    });
  };

  const handleDiscoverPacks = async (index: number) => {
    if (!onDiscoverPacks) {
      return;
    }
    const target = targets[index];
    const slug = target.repoSlug.trim();
    if (!slug) {
      onError?.('Enter a repo slug before discovering packs.');
      return;
    }
    handleUpdate(index, { loadingPacks: true });
    try {
      const packs = await onDiscoverPacks(slug, target.baseBranch.trim() || undefined);
      handleUpdate(index, {
        loadingPacks: false,
        packOptions: packs,
        packVersion: packs[0] ?? target.packVersion
      });
    } catch (error) {
      handleUpdate(index, { loadingPacks: false });
      onError?.(error instanceof Error ? error.message : 'Failed to load repo packs.');
    }
  };

  const handleAddRow = () => {
    if (onAddTarget) {
      onAddTarget();
      return;
    }
    onChange([...targets, defaultTargetTemplate()]);
  };

  const showTargetColumn = variant === 'wizard';
  const enableToggle = variant === 'wizard';
  const shouldShowErrors = showErrors ?? variant === 'wizard';

  const hasValidationIssues =
    showValidationHint &&
    (targets.filter((target) => target.enabled !== false).length === 0 ||
      targets
        .filter((target) => target.enabled !== false)
        .some((target) => !target.repoSlug.trim() || !target.baseBranch.trim()));

  return (
    <Stack spacing={2}>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {showTargetColumn ? <TableCell>Target</TableCell> : null}
              <TableCell>Repo Slug</TableCell>
              <TableCell>Base Branch</TableCell>
              <TableCell>Pack Version</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {targets.map((target, index) => {
              const enabled = target.enabled !== false;
              const repoSlugRequired = enabled && Boolean(target.repoSlug.trim());
              const baseBranchError = enabled && target.repoSlug.trim() && !target.baseBranch.trim();
              return (
                <TableRow key={target.id}>
                  {showTargetColumn ? (
                    <TableCell>
                      <Stack spacing={0.5}>
                        {enableToggle ? (
                          <FormControlLabel
                            control={
                              <Switch
                                checked={enabled}
                                onChange={(_, checked) => handleUpdate(index, { enabled: checked })}
                              />
                            }
                            label={target.label ?? 'Target'}
                          />
                        ) : (
                          <Typography variant="subtitle2">{target.label ?? 'Target'}</Typography>
                        )}
                        {target.description ? (
                          <Typography variant="caption" color="text.secondary">
                            {target.description}
                          </Typography>
                        ) : null}
                      </Stack>
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder={target.label ?? 'repo-slug'}
                      value={target.repoSlug}
                      onChange={(event) => handleRepoSlugChange(index, event.target.value)}
                      disabled={!enabled}
                      error={shouldShowErrors && enabled && !repoSlugRequired}
                      helperText={shouldShowErrors && enabled && !repoSlugRequired ? 'Required' : ' '}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={target.baseBranch}
                      onChange={(event) => handleUpdate(index, { baseBranch: event.target.value })}
                      disabled={!enabled}
                      error={shouldShowErrors && baseBranchError}
                      helperText={shouldShowErrors && baseBranchError ? 'Required' : ' '}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {target.packOptions && target.packOptions.length > 0 ? (
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={target.packVersion}
                          onChange={(event) => handleUpdate(index, { packVersion: event.target.value })}
                          disabled={!enabled}
                        >
                          {target.packOptions.map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        <TextField
                          size="small"
                          fullWidth
                          value={target.packVersion}
                          onChange={(event) => handleUpdate(index, { packVersion: event.target.value })}
                          disabled={!enabled}
                          placeholder="Optional"
                        />
                      )}
                      {onDiscoverPacks ? (
                        <Tooltip title="Discover packs">
                          <span>
                            <IconButton
                              aria-label="Discover packs"
                              onClick={() => void handleDiscoverPacks(index)}
                              disabled={!enabled || target.loadingPacks}
                            >
                              <SearchIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : null}
                      {allowRemove ? (
                        <IconButton
                          aria-label="Remove repo target"
                          onClick={() =>
                            onRemoveTarget
                              ? onRemoveTarget(index)
                              : onChange(targets.filter((_, rowIndex) => rowIndex !== index))
                          }
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {allowAdd ? (
        <Button variant="outlined" onClick={handleAddRow}>
          {addLabel ?? 'Add Repo Target'}
        </Button>
      ) : null}
      {hasValidationIssues ? (
        <Alert severity="warning">Enable at least one repo target with a valid slug and base branch.</Alert>
      ) : null}
    </Stack>
  );
}
