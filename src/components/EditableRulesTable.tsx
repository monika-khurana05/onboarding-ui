import AddIcon from '@mui/icons-material/Add';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useMemo } from 'react';

import { Button } from '@ui/Button';
import { Input } from '@ui/Input';
import { Card } from '@ui/Card';
export type EditableRuleRow = {
  key: string;
  enabled: boolean;
  severity?: string;
  params?: Record<string, any>;
};

type EditableRulesTableProps = {
  title: string;
  helperText?: string;
  rows: EditableRuleRow[];
  onChange: (next: EditableRuleRow[]) => void;
  onEditParams?: (index: number, params: Record<string, any> | undefined) => void;
  showSeverity?: boolean;
  severityOptions?: string[];
  addLabel?: string;
  emptyLabel?: string;
};

function listDuplicateKeys(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      return;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });
  return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key));
}

export function EditableRulesTable({
  title,
  helperText,
  rows,
  onChange,
  onEditParams,
  showSeverity = false,
  severityOptions = ['low', 'medium', 'high'],
  addLabel,
  emptyLabel
}: EditableRulesTableProps) {
  const duplicateKeys = useMemo(() => listDuplicateKeys(rows.map((row) => row.key)), [rows]);

  const handleUpdate = (index: number, patch: Partial<EditableRuleRow>) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.5}>
        <Typography variant="subtitle1">{title}</Typography>
        {helperText ? (
          <Typography variant="caption" color="text.secondary">
            {helperText}
          </Typography>
        ) : null}
      </Stack>
      <TableContainer component={Card} variant="outlined">
        <Table size="small" stickyHeader aria-label={`${title} rules table`}>
          <TableHead>
            <TableRow>
              <TableCell>Key</TableCell>
              {showSeverity ? <TableCell>Severity</TableCell> : null}
              <TableCell>Enabled</TableCell>
              <TableCell>Params</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((rule, index) => {
              const normalized = rule.key.trim().toUpperCase();
              const keyError = !rule.key.trim()
                ? 'Key is required'
                : duplicateKeys.has(normalized)
                ? 'Duplicate key'
                : '';
              return (
                <TableRow key={`${rule.key}-${index}`}>
                  <TableCell>
                    <Input
                      size="small"
                      value={rule.key}
                      onChange={(event) => handleUpdate(index, { key: event.target.value })}
                      error={Boolean(keyError)}
                      helperText={keyError || ' '}
                      inputProps={{
                        'aria-label': `${title} rule key row ${index + 1}`
                      }}
                    />
                  </TableCell>
                  {showSeverity ? (
                    <TableCell>
                      <Input
                        select
                        size="small"
                        value={rule.severity ?? ''}
                        onChange={(event) =>
                          handleUpdate(index, { severity: event.target.value || undefined })
                        }
                        helperText="Optional"
                        SelectProps={{
                          inputProps: {
                            'aria-label': `${title} rule severity row ${index + 1}`
                          }
                        }}
                      >
                        <MenuItem value="">None</MenuItem>
                        {severityOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </Input>
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      onChange={(_, checked) => handleUpdate(index, { enabled: checked })}
                      inputProps={{
                        'aria-label': `${title} rule ${rule.key.trim() || `row ${index + 1}`} enabled`
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<BuildOutlinedIcon />}
                      onClick={() => onEditParams?.(index, rule.params)}
                      disabled={!onEditParams}
                    >
                      Configure
                    </Button>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      aria-label="Remove rule"
                      onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showSeverity ? 5 : 4}>
                  <Typography variant="body2" color="text.secondary">
                    {emptyLabel ?? `No ${title.toLowerCase()} configured yet.`}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={() => onChange([...rows, { key: '', enabled: true }])}
      >
        {addLabel ?? `Add ${title}`}
      </Button>
    </Stack>
  );
}


