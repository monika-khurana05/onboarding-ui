import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import type { SyntheticEvent } from 'react';
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
  minWidth?: number;
  onChange: (next: string) => void;
};

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
    rows: []
  };
}

function stopAccordionToggle(event: SyntheticEvent): void {
  event.stopPropagation();
}

function FreeSoloAutocompleteCell({
  value,
  options,
  placeholder,
  minWidth = 160,
  onChange
}: FreeSoloAutocompleteCellProps) {
  return (
    <Autocomplete
      freeSolo
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
        <TextField {...params} size="small" placeholder={placeholder} fullWidth />
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
    handleSubFlowChange(subFlowId, (subFlow) => ({
      ...subFlow,
      rows: [...subFlow.rows, createEmptyRow()]
    }));
  };

  const handleDeleteRow = (subFlowId: string, rowId: string) => {
    handleSubFlowChange(subFlowId, (subFlow) => ({
      ...subFlow,
      rows: subFlow.rows.filter((row) => row.id !== rowId)
    }));
  };

  const handleDeleteSubFlow = (subFlowId: string) => {
    onChange({
      ...scenario,
      subFlows: scenario.subFlows.filter((subFlow) => subFlow.id !== subFlowId)
    });
  };

  const handleAddSubFlow = () => {
    onChange({
      ...scenario,
      subFlows: [...scenario.subFlows, createEmptySubFlow(`Sub-flow ${scenario.subFlows.length + 1}`)]
    });
  };

  return (
    <Stack spacing={2}>
      {scenario.subFlows.map((subFlow, subFlowIndex) => (
        <Accordion key={subFlow.id} defaultExpanded disableGutters variant="outlined" sx={{ borderRadius: 2 }}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              px: 2,
              '& .MuiAccordionSummary-content': {
                alignItems: 'center',
                gap: 1.5,
                my: 1
              }
            }}
          >
            <TextField
              value={subFlow.title}
              onChange={(event) =>
                handleSubFlowChange(subFlow.id, (current) => ({ ...current, title: event.target.value }))
              }
              label={`Sub-flow ${subFlowIndex + 1}`}
              size="small"
              fullWidth
              onClick={stopAccordionToggle}
              onFocus={stopAccordionToggle}
            />
            <Chip label={`${subFlow.rows.length} rows`} size="small" variant="outlined" />
            {scenario.subFlows.length > 1 ? (
              <IconButton
                size="small"
                color="error"
                component="span"
                onClick={(event) => {
                  stopAccordionToggle(event);
                  handleDeleteSubFlow(subFlow.id);
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            ) : null}
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pt: 0 }}>
            <Box sx={{ overflowX: 'auto' }}>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 0, borderLeft: 0, borderRight: 0 }}>
                <Table size="small" sx={{ minWidth: 1280 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>#</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>msgStatus</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>msgSubStatus</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }} align="center">Channel Push</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }} align="center">CDM</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Txn Status</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Txn Reason</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Reason Description</TableCell>
                      {scenario.hasScenarioColumn ? <TableCell sx={{ whiteSpace: 'nowrap' }}>Scenario</TableCell> : null}
                      {scenario.hasResponsibleColumn ? (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>Who Does It / Responsible</TableCell>
                      ) : null}
                      {scenario.hasTriggerReversalColumn ? (
                        <TableCell sx={{ whiteSpace: 'nowrap' }} align="center">Trigger Reversal</TableCell>
                      ) : null}
                      <TableCell sx={{ whiteSpace: 'nowrap' }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subFlow.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={columnCount}>
                          <Typography variant="body2" color="text.secondary">
                            No rows yet. Add a status transition row for this sub-flow.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {subFlow.rows.map((row, rowIndex) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{rowIndex + 1}</TableCell>
                        <TableCell>
                          <FreeSoloAutocompleteCell
                            value={row.msgStatus}
                            options={MSG_STATUS_OPTIONS}
                            placeholder="RECEIVED"
                            onChange={(nextValue) =>
                              handleRowChange(subFlow.id, row.id, (current) => ({ ...current, msgStatus: nextValue }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <FreeSoloAutocompleteCell
                            value={row.msgSubStatus}
                            options={MSG_SUB_STATUS_OPTIONS}
                            placeholder="VALIDATED"
                            minWidth={220}
                            onChange={(nextValue) =>
                              handleRowChange(subFlow.id, row.id, (current) => ({ ...current, msgSubStatus: nextValue }))
                            }
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Checkbox
                            size="small"
                            checked={row.channelPushNotification}
                            onChange={(event) =>
                              handleRowChange(subFlow.id, row.id, (current) => ({
                                ...current,
                                channelPushNotification: event.target.checked
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Checkbox
                            size="small"
                            checked={row.cdmNotification}
                            onChange={(event) =>
                              handleRowChange(subFlow.id, row.id, (current) => ({
                                ...current,
                                cdmNotification: event.target.checked
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <FreeSoloAutocompleteCell
                            value={row.transactionStatus}
                            options={TRANSACTION_STATUS_OPTIONS}
                            placeholder="PDNG"
                            onChange={(nextValue) =>
                              handleRowChange(subFlow.id, row.id, (current) => ({
                                ...current,
                                transactionStatus: nextValue
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={row.transactionStatusReason}
                            placeholder="Txn reason"
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
                        <TableCell>
                          <TextField
                            size="small"
                            value={row.reasonDescription}
                            placeholder="Reason description"
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
                          <TableCell>
                            <TextField
                              size="small"
                              value={row.scenario ?? ''}
                              placeholder="Scenario"
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
                          <TableCell>
                            <TextField
                              size="small"
                              value={row.responsibleComponent ?? ''}
                              placeholder="Responsible"
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
                          <TableCell align="center">
                            <Checkbox
                              size="small"
                              checked={Boolean(row.triggerReversal)}
                              onChange={(event) =>
                                handleRowChange(subFlow.id, row.id, (current) => ({
                                  ...current,
                                  triggerReversal: event.target.checked
                                }))
                              }
                            />
                          </TableCell>
                        ) : null}
                        <TableCell align="right">
                          <IconButton size="small" color="error" onClick={() => handleDeleteRow(subFlow.id, row.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
            <Stack direction="row" justifyContent="flex-start" sx={{ px: 2, py: 1.5 }}>
              <Button startIcon={<AddIcon />} onClick={() => handleAddRow(subFlow.id)}>
                Add row
              </Button>
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}

      <Box>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddSubFlow}>
          Add sub-flow
        </Button>
      </Box>
    </Stack>
  );
}

