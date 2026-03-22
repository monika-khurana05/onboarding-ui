import AddIcon from '@mui/icons-material/Add';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Stack,
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
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import {
  MSG_STATUS_OPTIONS,
  MSG_SUB_STATUS_OPTIONS,
  TRANSACTION_STATUS_OPTIONS,
  type ScenarioCategory,
  type StatusRow,
  type SubFlow
} from './types';

type ScenarioTableProps = {
  scenario: ScenarioCategory;
  onChange: (next: ScenarioCategory) => void;
};

type FreeSoloAutocompleteCellProps = {
  value: string;
  options: readonly string[];
  placeholder: string;
  ariaLabel: string;
  minWidth?: number;
  autoFocus?: boolean;
  onChange: (next: string) => void;
};

type PendingDelete =
  | {
      kind: 'row';
      rowId: string;
      rowLabel: string;
      subFlowId: string;
      subFlowTitle: string;
    }
  | {
      kind: 'subFlow';
      subFlowId: string;
      subFlowTitle: string;
    }
  | null;

let localIdCounter = 0;

function createLocalId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}-${localIdCounter}`;
}

function createEmptyRow(): StatusRow {
  return {
    id: createLocalId('state-row'),
    msgStatus: '',
    msgSubStatus: '',
    channelPushNotification: false,
    cdmNotification: false,
    transactionStatus: '',
    transactionStatusReason: '',
    reasonDescription: '',
    scenario: '',
    responsibleComponent: '',
    triggerReversal: false
  };
}

function createEmptySubFlow(label: string): SubFlow {
  return {
    id: createLocalId('subflow'),
    title: label,
    rows: [createEmptyRow()]
  };
}

function stopAccordionToggle(event: SyntheticEvent): void {
  event.stopPropagation();
}

function isMeaningfulString(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function isEmptyRow(row: StatusRow): boolean {
  return (
    !isMeaningfulString(row.msgStatus) &&
    !isMeaningfulString(row.msgSubStatus) &&
    !row.channelPushNotification &&
    !row.cdmNotification &&
    !isMeaningfulString(row.transactionStatus) &&
    !isMeaningfulString(row.transactionStatusReason) &&
    !isMeaningfulString(row.reasonDescription) &&
    !isMeaningfulString(row.scenario) &&
    !isMeaningfulString(row.responsibleComponent) &&
    !row.triggerReversal
  );
}

function hasMeaningfulRows(subFlow: SubFlow): boolean {
  return subFlow.rows.some((row) => !isEmptyRow(row));
}

function isMeaningfulSubFlow(subFlow: SubFlow, defaultTitle: string): boolean {
  const normalizedTitle = subFlow.title.trim();
  return hasMeaningfulRows(subFlow) || (Boolean(normalizedTitle) && normalizedTitle !== defaultTitle);
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function appendRow(subFlow: SubFlow, row: StatusRow): SubFlow {
  return {
    ...subFlow,
    rows: [...subFlow.rows, row]
  };
}

function removeRow(subFlow: SubFlow, rowId: string): SubFlow {
  return {
    ...subFlow,
    rows: subFlow.rows.filter((row) => row.id !== rowId)
  };
}

function duplicateRow(row: StatusRow): StatusRow {
  return {
    ...row,
    id: createLocalId('state-row')
  };
}

function FreeSoloAutocompleteCell({
  value,
  options,
  placeholder,
  ariaLabel,
  minWidth = 160,
  autoFocus = false,
  onChange
}: FreeSoloAutocompleteCellProps) {
  return (
    <Autocomplete
      freeSolo
      autoHighlight
      clearOnBlur
      handleHomeEndKeys
      selectOnFocus
      options={[...options]}
      value={value}
      inputValue={value}
      onInputChange={(_, nextValue, reason) => {
        if (reason === 'input' || reason === 'clear') {
          onChange(nextValue);
        }
      }}
      onChange={(_, nextValue) => {
        if (typeof nextValue === 'string') {
          onChange(nextValue);
          return;
        }
        onChange(nextValue ?? '');
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          placeholder={placeholder}
          fullWidth
          autoFocus={autoFocus}
          inputProps={{
            ...params.inputProps,
            'aria-label': ariaLabel
          }}
        />
      )}
      fullWidth
      sx={{ minWidth }}
    />
  );
}

function updateSubFlowById(
  scenario: ScenarioCategory,
  subFlowId: string,
  updater: (current: SubFlow) => SubFlow
): ScenarioCategory {
  return {
    ...scenario,
    subFlows: scenario.subFlows.map((subFlow) => (subFlow.id === subFlowId ? updater(subFlow) : subFlow))
  };
}

function updateRowById(subFlow: SubFlow, rowId: string, updater: (current: StatusRow) => StatusRow): SubFlow {
  return {
    ...subFlow,
    rows: subFlow.rows.map((row) => (row.id === rowId ? updater(row) : row))
  };
}

export function ScenarioTable({ scenario, onChange }: ScenarioTableProps) {
  const optionalColumnCount =
    (scenario.hasScenarioColumn ? 1 : 0) +
    (scenario.hasResponsibleColumn ? 1 : 0) +
    (scenario.hasTriggerReversalColumn ? 1 : 0);
  const columnCount = 9 + optionalColumnCount;
  const [expandedSubFlowIds, setExpandedSubFlowIds] = useState<string[]>(() =>
    scenario.subFlows.map((subFlow) => subFlow.id)
  );
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const knownSubFlowIdsRef = useRef(new Set<string>(scenario.subFlows.map((subFlow) => subFlow.id)));

  useEffect(() => {
    const subFlowIds = scenario.subFlows.map((subFlow) => subFlow.id);
    knownSubFlowIdsRef.current = new Set(subFlowIds);
    setPendingDelete(null);
    setExpandedSubFlowIds((current) => (sameStringArray(current, subFlowIds) ? current : subFlowIds));
  }, [scenario.id]);

  useEffect(() => {
    const currentIds = scenario.subFlows.map((subFlow) => subFlow.id);
    const newIds = currentIds.filter((id) => !knownSubFlowIdsRef.current.has(id));
    setExpandedSubFlowIds((current) => {
      const currentIdSet = new Set(currentIds);
      const kept = current.filter((id) => currentIdSet.has(id));
      const next = [...kept, ...newIds];
      return sameStringArray(current, next) ? current : next;
    });
    knownSubFlowIdsRef.current = new Set(currentIds);
  }, [scenario.subFlows]);

  useEffect(() => {
    if (!focusRowId) {
      return;
    }
    setFocusRowId(null);
  }, [focusRowId]);

  const handleSubFlowChange = (subFlowId: string, updater: (current: SubFlow) => SubFlow) => {
    onChange(updateSubFlowById(scenario, subFlowId, updater));
  };

  const handleRowChange = (
    subFlowId: string,
    rowId: string,
    updater: (current: StatusRow) => StatusRow
  ) => {
    handleSubFlowChange(subFlowId, (subFlow) => updateRowById(subFlow, rowId, updater));
  };

  const handleAddRow = (subFlowId: string) => {
    const nextRow = createEmptyRow();
    handleSubFlowChange(subFlowId, (subFlow) => ({
      ...appendRow(subFlow, nextRow)
    }));
    setFocusRowId(nextRow.id);
    setFeedbackMessage('Added a new row to the sub-flow.');
  };

  const handleDeleteRow = (subFlowId: string, rowId: string) => {
    handleSubFlowChange(subFlowId, (subFlow) => ({
      ...removeRow(subFlow, rowId)
    }));
    setFeedbackMessage('Removed the row from this sub-flow.');
  };

  const handleDuplicateRow = (subFlowId: string, row: StatusRow) => {
    const nextRow = duplicateRow(row);
    handleSubFlowChange(subFlowId, (subFlow) => ({
      ...subFlow,
      rows: [...subFlow.rows, nextRow]
    }));
    setFocusRowId(nextRow.id);
    setFeedbackMessage('Duplicated the row for quick editing.');
  };

  const handleDeleteSubFlow = (subFlowId: string) => {
    onChange({
      ...scenario,
      subFlows: scenario.subFlows.filter((subFlow) => subFlow.id !== subFlowId)
    });
    setFeedbackMessage('Removed the sub-flow from this scenario.');
  };

  const handleAddSubFlow = () => {
    const nextSubFlow = createEmptySubFlow(`New Sub-flow ${scenario.subFlows.length + 1}`);
    onChange({
      ...scenario,
      subFlows: [...scenario.subFlows, nextSubFlow]
    });
    setFocusRowId(nextSubFlow.rows[0]?.id ?? null);
    setFeedbackMessage('Added a new sub-flow for this scenario.');
  };

  const handleToggleExpanded = (subFlowId: string, expanded: boolean) => {
    setExpandedSubFlowIds((current) => {
      if (expanded && !current.includes(subFlowId)) {
        return [...current, subFlowId];
      }
      if (!expanded && current.includes(subFlowId)) {
        return current.filter((id) => id !== subFlowId);
      }
      return current;
    });
  };

  const handleRequestDeleteRow = (subFlow: SubFlow, row: StatusRow, rowIndex: number) => {
    if (isEmptyRow(row)) {
      handleDeleteRow(subFlow.id, row.id);
      return;
    }
    setPendingDelete({
      kind: 'row',
      rowId: row.id,
      rowLabel: `Row ${rowIndex + 1}`,
      subFlowId: subFlow.id,
      subFlowTitle: subFlow.title.trim() || 'Untitled sub-flow'
    });
  };

  const handleRequestDeleteSubFlow = (subFlow: SubFlow, subFlowIndex: number) => {
    if (!isMeaningfulSubFlow(subFlow, `New Sub-flow ${subFlowIndex + 1}`)) {
      handleDeleteSubFlow(subFlow.id);
      return;
    }
    setPendingDelete({
      kind: 'subFlow',
      subFlowId: subFlow.id,
      subFlowTitle: subFlow.title.trim() || 'Untitled sub-flow'
    });
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) {
      return;
    }

    if (pendingDelete.kind === 'row') {
      handleDeleteRow(pendingDelete.subFlowId, pendingDelete.rowId);
    } else {
      handleDeleteSubFlow(pendingDelete.subFlowId);
    }

    setPendingDelete(null);
  };

  return (
    <Stack spacing={2}>
      {scenario.subFlows.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2.5 }}>
          <Stack spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Typography variant="subtitle1">No sub-flows yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Add a sub-flow to start mapping status transitions for this scenario.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddSubFlow}>
              Add Sub-flow
            </Button>
          </Stack>
        </Paper>
      ) : null}

      {scenario.subFlows.map((subFlow, subFlowIndex) => (
        <Accordion
          key={subFlow.id}
          expanded={expandedSubFlowIds.includes(subFlow.id)}
          onChange={(_, expanded) => handleToggleExpanded(subFlow.id, expanded)}
          disableGutters
          variant="outlined"
          sx={{ borderRadius: 2.5, overflow: 'hidden' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              px: 2,
              '& .MuiAccordionSummary-content': {
                alignItems: { xs: 'stretch', md: 'center' },
                gap: 1.5,
                my: 1,
                flexDirection: { xs: 'column', md: 'row' }
              }
            }}
          >
            <TextField
              value={subFlow.title}
              onChange={(event) =>
                handleSubFlowChange(subFlow.id, (current) => ({ ...current, title: event.target.value }))
              }
              label={`Sub-flow ${subFlowIndex + 1}`}
              placeholder="e.g. Review Flow"
              size="small"
              fullWidth
              onClick={stopAccordionToggle}
              onFocus={stopAccordionToggle}
              inputProps={{
                'aria-label': `Sub-flow ${subFlowIndex + 1} title`
              }}
            />
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Chip label={`${subFlow.rows.length} rows`} size="small" variant="outlined" />
              <Tooltip title="Add row to this sub-flow">
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    component="span"
                    aria-label={`Add row to ${subFlow.title.trim() || `Sub-flow ${subFlowIndex + 1}`}`}
                    onClick={(event) => {
                      stopAccordionToggle(event);
                      handleAddRow(subFlow.id);
                    }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Delete this sub-flow">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    component="span"
                    aria-label={`Delete ${subFlow.title.trim() || `Sub-flow ${subFlowIndex + 1}`}`}
                    onClick={(event) => {
                      stopAccordionToggle(event);
                      handleRequestDeleteSubFlow(subFlow, subFlowIndex);
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pt: 0 }}>
            <Box sx={{ overflowX: 'auto' }}>
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ borderRadius: 0, borderLeft: 0, borderRight: 0 }}
              >
                <Table size="small" sx={{ minWidth: 1320 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          whiteSpace: 'nowrap',
                          position: 'sticky',
                          left: 0,
                          zIndex: 3,
                          backgroundColor: 'background.paper'
                        }}
                      >
                        #
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Message Status</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Message Sub-status</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }} align="center">
                        Channel Push
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }} align="center">
                        CDM
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Txn Status</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Txn Reason</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Reason Description</TableCell>
                      {scenario.hasScenarioColumn ? (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>Scenario</TableCell>
                      ) : null}
                      {scenario.hasResponsibleColumn ? (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>Who Does It</TableCell>
                      ) : null}
                      {scenario.hasTriggerReversalColumn ? (
                        <TableCell sx={{ whiteSpace: 'nowrap' }} align="center">
                          Trigger Reversal
                        </TableCell>
                      ) : null}
                      <TableCell
                        sx={{
                          whiteSpace: 'nowrap',
                          position: 'sticky',
                          right: 0,
                          zIndex: 3,
                          backgroundColor: 'background.paper'
                        }}
                        align="right"
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subFlow.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={columnCount}>
                          <Stack spacing={1} sx={{ py: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              No rows yet. Add a row to capture the next transition for this sub-flow.
                            </Typography>
                            <Box>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={() => handleAddRow(subFlow.id)}
                              >
                                Add Row
                              </Button>
                            </Box>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {subFlow.rows.map((row, rowIndex) => (
                      <TableRow key={row.id} hover>
                        <TableCell
                          sx={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 2,
                            backgroundColor: 'background.paper',
                            minWidth: 52,
                            verticalAlign: 'top'
                          }}
                        >
                          {rowIndex + 1}
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          <FreeSoloAutocompleteCell
                            value={row.msgStatus}
                            options={MSG_STATUS_OPTIONS}
                            placeholder="e.g. RECEIVED"
                            ariaLabel={`Row ${rowIndex + 1} message status`}
                            autoFocus={focusRowId === row.id}
                            onChange={(nextValue) =>
                              handleRowChange(subFlow.id, row.id, (current) => ({ ...current, msgStatus: nextValue }))
                            }
                          />
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          <FreeSoloAutocompleteCell
                            value={row.msgSubStatus}
                            options={MSG_SUB_STATUS_OPTIONS}
                            placeholder="e.g. VALIDATED"
                            ariaLabel={`Row ${rowIndex + 1} message sub-status`}
                            minWidth={220}
                            onChange={(nextValue) =>
                              handleRowChange(subFlow.id, row.id, (current) => ({ ...current, msgSubStatus: nextValue }))
                            }
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ verticalAlign: 'top' }}>
                          <Checkbox
                            size="small"
                            checked={row.channelPushNotification}
                            inputProps={{ 'aria-label': `Row ${rowIndex + 1} channel push` }}
                            onChange={(event) =>
                              handleRowChange(subFlow.id, row.id, (current) => ({
                                ...current,
                                channelPushNotification: event.target.checked
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ verticalAlign: 'top' }}>
                          <Checkbox
                            size="small"
                            checked={row.cdmNotification}
                            inputProps={{ 'aria-label': `Row ${rowIndex + 1} cdm` }}
                            onChange={(event) =>
                              handleRowChange(subFlow.id, row.id, (current) => ({
                                ...current,
                                cdmNotification: event.target.checked
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          <FreeSoloAutocompleteCell
                            value={row.transactionStatus}
                            options={TRANSACTION_STATUS_OPTIONS}
                            placeholder="e.g. PDNG"
                            ariaLabel={`Row ${rowIndex + 1} transaction status`}
                            onChange={(nextValue) =>
                              handleRowChange(subFlow.id, row.id, (current) => ({
                                ...current,
                                transactionStatus: nextValue
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          <TextField
                            size="small"
                            value={row.transactionStatusReason}
                            placeholder="e.g. RR01"
                            inputProps={{ 'aria-label': `Row ${rowIndex + 1} transaction reason` }}
                            onChange={(event) =>
                              handleRowChange(subFlow.id, row.id, (current) => ({
                                ...current,
                                transactionStatusReason: event.target.value
                              }))
                            }
                            sx={{ minWidth: 180 }}
                            fullWidth
                          />
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          <TextField
                            size="small"
                            value={row.reasonDescription}
                            placeholder="Reason description"
                            inputProps={{ 'aria-label': `Row ${rowIndex + 1} reason description` }}
                            onChange={(event) =>
                              handleRowChange(subFlow.id, row.id, (current) => ({
                                ...current,
                                reasonDescription: event.target.value
                              }))
                            }
                            sx={{ minWidth: 240 }}
                            fullWidth
                          />
                        </TableCell>
                        {scenario.hasScenarioColumn ? (
                          <TableCell sx={{ verticalAlign: 'top' }}>
                            <TextField
                              size="small"
                              value={row.scenario ?? ''}
                              placeholder="Scenario"
                              inputProps={{ 'aria-label': `Row ${rowIndex + 1} scenario` }}
                              onChange={(event) =>
                                handleRowChange(subFlow.id, row.id, (current) => ({
                                  ...current,
                                  scenario: event.target.value
                                }))
                              }
                              sx={{ minWidth: 180 }}
                              fullWidth
                            />
                          </TableCell>
                        ) : null}
                        {scenario.hasResponsibleColumn ? (
                          <TableCell sx={{ verticalAlign: 'top' }}>
                            <TextField
                              size="small"
                              value={row.responsibleComponent ?? ''}
                              placeholder="Who does it"
                              inputProps={{ 'aria-label': `Row ${rowIndex + 1} responsible component` }}
                              onChange={(event) =>
                                handleRowChange(subFlow.id, row.id, (current) => ({
                                  ...current,
                                  responsibleComponent: event.target.value
                                }))
                              }
                              sx={{ minWidth: 220 }}
                              fullWidth
                            />
                          </TableCell>
                        ) : null}
                        {scenario.hasTriggerReversalColumn ? (
                          <TableCell align="center" sx={{ verticalAlign: 'top' }}>
                            <Checkbox
                              size="small"
                              checked={Boolean(row.triggerReversal)}
                              inputProps={{ 'aria-label': `Row ${rowIndex + 1} trigger reversal` }}
                              onChange={(event) =>
                                handleRowChange(subFlow.id, row.id, (current) => ({
                                  ...current,
                                  triggerReversal: event.target.checked
                                }))
                              }
                            />
                          </TableCell>
                        ) : null}
                        <TableCell
                          align="right"
                          sx={{
                            position: 'sticky',
                            right: 0,
                            zIndex: 2,
                            backgroundColor: 'background.paper',
                            verticalAlign: 'top'
                          }}
                        >
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Duplicate row">
                              <span>
                                <IconButton
                                  size="small"
                                  aria-label={`Duplicate row ${rowIndex + 1}`}
                                  onClick={() => handleDuplicateRow(subFlow.id, row)}
                                >
                                  <ContentCopyOutlinedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title={isEmptyRow(row) ? 'Delete empty row' : 'Delete row'}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  aria-label={`Delete row ${rowIndex + 1}`}
                                  onClick={() => handleRequestDeleteRow(subFlow, row, rowIndex)}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Changes are kept locally until you save scenarios or generate the FSM.
              </Typography>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleAddRow(subFlow.id)}>
                Add Row
              </Button>
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}

      {scenario.subFlows.length > 0 ? (
        <Box>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddSubFlow}>
            Add Sub-flow
          </Button>
        </Box>
      ) : null}

      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {pendingDelete?.kind === 'row' ? 'Delete this row?' : 'Delete this sub-flow?'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {pendingDelete?.kind === 'row'
                ? `${pendingDelete.rowLabel} in ${pendingDelete.subFlowTitle} contains data.`
                : `${pendingDelete?.subFlowTitle ?? 'This sub-flow'} contains draft details.`}
            </Typography>
            <Alert severity="warning">This action cannot be undone.</Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(feedbackMessage)}
        autoHideDuration={2500}
        onClose={() => setFeedbackMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {feedbackMessage ? (
          <Alert onClose={() => setFeedbackMessage(null)} severity="success" sx={{ width: '100%' }}>
            {feedbackMessage}
          </Alert>
        ) : null}
      </Snackbar>
    </Stack>
  );
}

