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
import type { FlowDirection, ScenarioCategory, StateManagerConfig, SubFlow } from './types';
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

function createEmptySubFlow(): SubFlow {
  return {
    id: createLocalId('subflow'),
    title: 'Sub-flow 1',
    rows: []
  };
}

function createEmptyScenario(index: number): ScenarioCategory {
  return {
    id: createLocalId('scenario'),
    name: `New Scenario ${index + 1}`,
    description: '',
    subFlows: [createEmptySubFlow()],
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
  };

  const handleResetDefaults = () => {
    emitScenariosChange(createDefaultScenarios());
    setActiveTab(0);
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
  };

  const handleActiveScenarioChange = (nextScenario: ScenarioCategory) => {
    if (!activeScenario) {
      return;
    }
    emitScenariosChange(
      value.scenarios.map((scenario) => (scenario.id === activeScenario.id ? nextScenario : scenario))
    );
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
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
              <TextField
                label="Scenario Name"
                value={activeScenario.name}
                onChange={(event) =>
                  handleActiveScenarioChange({
                    ...activeScenario,
                    name: event.target.value
                  })
                }
                fullWidth
              />
              <Button
                color="error"
                variant="outlined"
                startIcon={<DeleteOutlineIcon />}
                onClick={handleDeleteActiveScenario}
                disabled={isGenerating || isSaving}
              >
                Delete Scenario
              </Button>
            </Stack>

            <TextField
              label="Scenario Description"
              value={activeScenario.description}
              onChange={(event) =>
                handleActiveScenarioChange({
                  ...activeScenario,
                  description: event.target.value
                })
              }
              multiline
              minRows={2}
              fullWidth
            />

            <ScenarioTable scenario={activeScenario} onChange={handleActiveScenarioChange} />
          </Stack>
        ) : (
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle1">No scenarios configured</Typography>
              <Typography variant="body2" color="text.secondary">
                Add a scenario, import a scenario file, or reset to the seeded defaults to begin editing state-manager rules.
              </Typography>
            </Stack>
          </Paper>
        )}
      </Stack>

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
    </Paper>
  );
}
