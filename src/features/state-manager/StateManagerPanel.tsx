import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Button
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { createDefaultScenarios } from './defaultScenarios';
import { ImportScenariosPanel } from './import/ImportScenariosPanel';
import { ScenarioTable } from './ScenarioTable';
import { previewConversion } from './scenariosToFsm';
import { StateManagerContextBar } from './StateManagerContextBar';
import type { FlowDirection, ScenarioCategory, StateManagerConfig, StatusRow, SubFlow } from './types';
import { validateStateManagerConfig } from './validateStateManagerConfig';

type StateManagerPanelProps = {
  value: StateManagerConfig;
  onChange: (next: StateManagerConfig) => void;
  onCountryChange?: (countryCode: string) => void;
  onFlowDirectionChange?: (flowDirection: FlowDirection) => void;
  onSaveScenarios?: (config: StateManagerConfig) => Promise<void> | void;
  onGenerateFsm?: (config: StateManagerConfig) => Promise<void> | void;
  isSaving?: boolean;
  isGenerating?: boolean;
  generationPreview?: ReturnType<typeof previewConversion>;
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

function createEmptySubFlow(title = 'New Sub-flow 1'): SubFlow {
  return {
    id: createLocalId('subflow'),
    title,
    rows: [createEmptyRow()]
  };
}

function createEmptyScenario(index: number): ScenarioCategory {
  return {
    id: createLocalId('scenario'),
    name: `New Scenario ${index + 1}`,
    description: '',
    subFlows: [createEmptySubFlow('New Sub-flow 1')],
    hasScenarioColumn: false,
    hasResponsibleColumn: false,
    hasTriggerReversalColumn: false
  };
}

function countScenarioRows(scenario: ScenarioCategory): number {
  return scenario.subFlows.reduce((total, subFlow) => total + subFlow.rows.length, 0);
}

export function StateManagerPanel({
  value,
  onChange,
  onCountryChange,
  onFlowDirectionChange,
  onSaveScenarios,
  onGenerateFsm,
  isSaving = false,
  isGenerating = false,
  generationPreview
}: StateManagerPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scenarioDeleteOpen, setScenarioDeleteOpen] = useState(false);
  const [editorFeedback, setEditorFeedback] = useState<string | null>(null);

  const computedConversionPreview = useMemo(() => previewConversion(value.scenarios), [value.scenarios]);
  const conversionPreview = generationPreview ?? computedConversionPreview;
  const validationMessages = useMemo(() => validateStateManagerConfig(value), [value]);
  const activeScenario = value.scenarios[activeTab] ?? null;
  const canSaveScenarios = validationMessages.length === 0;
  const canGenerateFsm = Boolean(onGenerateFsm) && value.scenarios.length > 0 && !isGenerating && !isSaving;

  useEffect(() => {
    if (activeTab >= value.scenarios.length) {
      setActiveTab(Math.max(value.scenarios.length - 1, 0));
    }
  }, [activeTab, value.scenarios.length]);

  const emitScenariosChange = (nextScenarios: ScenarioCategory[]) => {
    onChange({
      ...value,
      scenarios: nextScenarios,
      lastUpdated: new Date().toISOString()
    });
  };

  const handleCountryFieldChange = (countryCode: string) => {
    if (onCountryChange) {
      onCountryChange(countryCode);
      return;
    }
    onChange({
      ...value,
      countryCode,
      lastUpdated: new Date().toISOString()
    });
  };

  const handleFlowFieldChange = (flowDirection: FlowDirection) => {
    if (onFlowDirectionChange) {
      onFlowDirectionChange(flowDirection);
      return;
    }
    onChange({
      ...value,
      flowDirection,
      lastUpdated: new Date().toISOString()
    });
  };

  const handleAddScenario = () => {
    const nextScenario = createEmptyScenario(value.scenarios.length);
    const nextScenarios = [...value.scenarios, nextScenario];
    emitScenariosChange(nextScenarios);
    setActiveTab(nextScenarios.length - 1);
    setEditorFeedback('Added a new scenario to the editor.');
  };

  const handleResetDefaults = () => {
    emitScenariosChange(createDefaultScenarios());
    setActiveTab(0);
    setEditorFeedback('Reset the scenario editor to the seeded defaults.');
  };

  const handleDeleteActiveScenario = () => {
    if (!activeScenario) {
      return;
    }
    const nextScenarios = value.scenarios.filter((scenario) => scenario.id !== activeScenario.id);
    emitScenariosChange(nextScenarios);
    setActiveTab((current) => {
      if (nextScenarios.length === 0) {
        return 0;
      }
      return Math.min(current, nextScenarios.length - 1);
    });
    setScenarioDeleteOpen(false);
    setEditorFeedback('Deleted the current scenario from the draft editor.');
  };

  const handleActiveScenarioChange = (nextScenario: ScenarioCategory) => {
    if (!activeScenario) {
      return;
    }
    emitScenariosChange(
      value.scenarios.map((scenario) => (scenario.id === activeScenario.id ? nextScenario : scenario))
    );
  };

  const handleAddSubFlowToActiveScenario = () => {
    if (!activeScenario) {
      return;
    }

    const nextSubFlow = createEmptySubFlow(`New Sub-flow ${activeScenario.subFlows.length + 1}`);
    handleActiveScenarioChange({
      ...activeScenario,
      subFlows: [...activeScenario.subFlows, nextSubFlow]
    });
    setEditorFeedback('Added a new sub-flow to the current scenario.');
  };

  const handleSave = async () => {
    if (!onSaveScenarios || validationMessages.length > 0) {
      return;
    }
    await Promise.resolve(
      onSaveScenarios({
        ...value,
        countryCode: value.countryCode.trim().toUpperCase(),
        lastUpdated: new Date().toISOString()
      })
    );
  };

  const handleConfirmGenerate = async () => {
    if (!onGenerateFsm) {
      return;
    }
    await Promise.resolve(onGenerateFsm(value));
    setConfirmOpen(false);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 3,
        backgroundColor: 'background.paper'
      }}
    >
      <Stack spacing={3}>
        <StateManagerContextBar
          countryCode={value.countryCode}
          flowDirection={value.flowDirection}
          onCountryChange={handleCountryFieldChange}
          onFlowDirectionChange={handleFlowFieldChange}
          onAddScenario={handleAddScenario}
          onResetDefaults={handleResetDefaults}
          onSaveScenarios={handleSave}
          onOpenGenerateConfirm={() => setConfirmOpen(true)}
          isSaving={isSaving}
          isGenerating={isGenerating}
          canSaveScenarios={canSaveScenarios}
          canGenerateFsm={canGenerateFsm}
          validationMessages={validationMessages}
          preview={conversionPreview}
        />

        <ImportScenariosPanel
          countryCode={value.countryCode}
          flowDirection={value.flowDirection}
          disabled={isGenerating || isSaving}
          onImportSuccess={(nextConfig) => {
            onChange(nextConfig);
            setActiveTab(0);
            setEditorFeedback('Imported scenarios into the editor. Save Scenarios when you are ready.');
          }}
        />

        <Divider />

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeScenario ? activeTab : false}
            onChange={(_, nextValue) => setActiveTab(nextValue)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            {value.scenarios.map((scenario, index) => (
              <Tab
                key={scenario.id}
                value={index}
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">{scenario.name.trim() || `Scenario ${index + 1}`}</Typography>
                    <Chip size="small" label={countScenarioRows(scenario)} variant="outlined" />
                  </Stack>
                }
                sx={{ textTransform: 'none', alignItems: 'flex-start', py: 1.25 }}
              />
            ))}
          </Tabs>
        </Box>

        {activeScenario ? (
          <Stack spacing={2.5}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  justifyContent="space-between"
                >
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1">Scenario Details</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Update the business context first, then refine the sub-flows and status rows below.
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip label={`${activeScenario.subFlows.length} sub-flows`} variant="outlined" />
                    <Chip label={`${countScenarioRows(activeScenario)} rows`} variant="outlined" />
                  </Stack>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'flex-start' }}>
                  <TextField
                    label="Scenario Name"
                    value={activeScenario.name}
                    placeholder="e.g. Happy Path"
                    onChange={(event) =>
                      handleActiveScenarioChange({
                        ...activeScenario,
                        name: event.target.value
                      })
                    }
                    fullWidth
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ minWidth: { md: 320 } }}>
                    <Button
                      variant="outlined"
                      onClick={handleAddSubFlowToActiveScenario}
                      disabled={isGenerating || isSaving}
                    >
                      Add Sub-flow
                    </Button>
                    <Button
                      color="error"
                      variant="outlined"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={() => setScenarioDeleteOpen(true)}
                      disabled={isGenerating || isSaving}
                    >
                      Delete Scenario
                    </Button>
                  </Stack>
                </Stack>

                <TextField
                  label="Scenario Description"
                  value={activeScenario.description}
                  placeholder="Describe the business intent, exceptions, or operational notes for this scenario."
                  onChange={(event) =>
                    handleActiveScenarioChange({
                      ...activeScenario,
                      description: event.target.value
                    })
                  }
                  helperText="Capture the business context Solution Architects need while editing rows and sub-flows."
                  multiline
                  minRows={3}
                  fullWidth
                />
              </Stack>
            </Paper>

            <ScenarioTable scenario={activeScenario} onChange={handleActiveScenarioChange} />
          </Stack>
        ) : (
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1">No scenarios configured</Typography>
              <Typography variant="body2" color="text.secondary">
                Add a scenario, import a scenario file, or reset to the seeded defaults to begin editing state-manager rules.
              </Typography>
              <Box>
                <Button variant="contained" onClick={handleAddScenario}>
                  Add Scenario
                </Button>
              </Box>
            </Stack>
          </Paper>
        )}
      </Stack>

      <Dialog
        open={scenarioDeleteOpen}
        onClose={() => {
          if (!isGenerating && !isSaving) {
            setScenarioDeleteOpen(false);
          }
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete this scenario?</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {activeScenario?.name.trim() || 'This scenario'} and all of its sub-flows and rows will be removed from the current draft.
            </Typography>
            <Alert severity="warning">This action cannot be undone.</Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScenarioDeleteOpen(false)} disabled={isGenerating || isSaving}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleDeleteActiveScenario} disabled={isGenerating || isSaving}>
            Delete Scenario
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (!isGenerating) {
            setConfirmOpen(false);
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Generate FSM from current scenarios?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`${conversionPreview.scenarioCount} scenarios`} variant="outlined" />
              <Chip label={`${conversionPreview.totalRows} total rows`} variant="outlined" />
              <Chip label={`${conversionPreview.discoveredStateCount} discovered states`} variant="outlined" />
              {conversionPreview.topArchetype ? (
                <Chip label={`Archetype: ${conversionPreview.topArchetype}`} variant="outlined" />
              ) : null}
              {typeof conversionPreview.warningCount === 'number' ? (
                <Chip
                  label={`${conversionPreview.warningCount} warnings`}
                  variant="outlined"
                  color={conversionPreview.warningCount > 0 ? 'warning' : 'default'}
                />
              ) : null}
              {typeof conversionPreview.conflictCount === 'number' ? (
                <Chip
                  label={`${conversionPreview.conflictCount} conflicts`}
                  variant="outlined"
                  color={conversionPreview.conflictCount > 0 ? 'error' : 'default'}
                />
              ) : null}
            </Stack>
            <Alert severity="warning">
              Save &amp; Generate FSM is separate from Save Scenarios and will replace the current workflow preview.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleConfirmGenerate} variant="contained" disabled={!canGenerateFsm}>
            Generate
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(editorFeedback)}
        autoHideDuration={3000}
        onClose={() => setEditorFeedback(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {editorFeedback ? (
          <Alert onClose={() => setEditorFeedback(null)} severity="success" sx={{ width: '100%' }}>
            {editorFeedback}
          </Alert>
        ) : null}
      </Snackbar>
    </Paper>
  );
}
