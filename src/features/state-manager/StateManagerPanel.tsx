import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
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
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { createDefaultScenarios } from './defaultScenarios';
import { previewConversion } from './scenariosToFsm';
import { ScenarioTable } from './ScenarioTable';
import type { ScenarioCategory, StateManagerConfig, SubFlow } from './types';

type StateManagerPanelProps = {
  value: StateManagerConfig;
  onChange: (next: StateManagerConfig) => void;
  onGenerateFsm?: (config: StateManagerConfig) => Promise<void> | void;
  isGenerating?: boolean;
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
  onGenerateFsm,
  isGenerating = false
}: StateManagerPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const conversionPreview = useMemo(() => previewConversion(value.scenarios), [value.scenarios]);
  const activeScenario = value.scenarios[activeTab] ?? null;

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
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', lg: 'flex-start' }}
          spacing={2}
        >
          <Stack spacing={1.25}>
            <Typography variant="h6">State Manager Configuration</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 880 }}>
              Define message status/substatus transitions, notification rules, and customer-facing
              statuses for each payment scenario.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`${conversionPreview.scenarioCount} scenarios`} color="primary" variant="outlined" />
              <Chip label={`${conversionPreview.totalRows} total rows`} variant="outlined" />
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={handleAddScenario} disabled={isGenerating}>
              Add Scenario
            </Button>
            <Button
              startIcon={<RefreshIcon />}
              variant="outlined"
              onClick={handleResetDefaults}
              disabled={isGenerating}
            >
              Reset Defaults
            </Button>
            <Button
              variant="contained"
              onClick={() => setConfirmOpen(true)}
              disabled={isGenerating || !onGenerateFsm || value.scenarios.length === 0}
            >
              Save &amp; Generate FSM
            </Button>
          </Stack>
        </Stack>

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
                disabled={isGenerating}
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
                Add a scenario or reset to the seeded defaults to begin editing state-manager rules.
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
            </Stack>
            <Alert severity="warning">
              Generating an FSM here will replace the current workflow. Review the scenario data before continuing.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleConfirmGenerate} variant="contained" disabled={isGenerating || !onGenerateFsm}>
            Generate
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
