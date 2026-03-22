import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormHelperText,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { CountryCodeField } from '../../components/CountryCodeField';
import { previewConversion } from './scenariosToFsm';
import type { FlowDirection } from './types';

type StateManagerContextBarProps = {
  countryCode: string;
  flowDirection: FlowDirection;
  onCountryChange: (countryCode: string) => void;
  onFlowDirectionChange: (flowDirection: FlowDirection) => void;
  onAddScenario: () => void;
  onResetDefaults: () => void;
  onSaveScenarios?: () => void;
  onOpenGenerateConfirm: () => void;
  isSaving?: boolean;
  isGenerating?: boolean;
  canSaveScenarios: boolean;
  canGenerateFsm: boolean;
  validationMessages: string[];
  preview: ReturnType<typeof previewConversion>;
};

export function StateManagerContextBar({
  countryCode,
  flowDirection,
  onCountryChange,
  onFlowDirectionChange,
  onAddScenario,
  onResetDefaults,
  onSaveScenarios,
  onOpenGenerateConfirm,
  isSaving = false,
  isGenerating = false,
  canSaveScenarios,
  canGenerateFsm,
  validationMessages,
  preview
}: StateManagerContextBarProps) {
  const countryError = validationMessages.some((message) => message.startsWith('Country code'));
  const flowError = validationMessages.some((message) => message.startsWith('Flow direction'));
  const helperText = countryError
    ? validationMessages.find((message) => message.startsWith('Country code'))
    : 'Country code and flow are saved together with this scenario set.';

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
      <Stack spacing={2.5}>
        <Stack spacing={0.75}>
          <Typography variant="h6">State Manager Configuration</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 900 }}>
            Define and manage message status/substatus transitions for a selected country and flow.
          </Typography>
        </Stack>

        <Stack
          direction={{ xs: 'column', xl: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', xl: 'flex-start' }}
          spacing={2}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ flex: 1, minWidth: 0 }}>
            <CountryCodeField value={countryCode} onChange={onCountryChange} error={countryError} helperText={helperText} />
            <FormControl error={flowError} sx={{ minWidth: { xs: '100%', md: 250 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75 }}>
                Flow Direction
              </Typography>
              <ToggleButtonGroup
                value={flowDirection}
                exclusive
                onChange={(_, value) => {
                  if (value) {
                    onFlowDirectionChange(value as FlowDirection);
                  }
                }}
                size="small"
                color="primary"
                aria-label="Flow direction"
              >
                <ToggleButton value="INCOMING">INCOMING</ToggleButton>
                <ToggleButton value="OUTGOING">OUTGOING</ToggleButton>
              </ToggleButtonGroup>
              <FormHelperText>
                {flowError
                  ? validationMessages.find((message) => message.startsWith('Flow direction'))
                  : 'Scenario imports and saves are scoped to the selected direction.'}
              </FormHelperText>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent={{ xs: 'flex-start', xl: 'flex-end' }}>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={onAddScenario} disabled={isGenerating || isSaving}>
              Add Scenario
            </Button>
            <Button
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
              variant="contained"
              onClick={onSaveScenarios}
              disabled={!onSaveScenarios || !canSaveScenarios || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Scenarios'}
            </Button>
            <Button
              startIcon={<RefreshIcon />}
              variant="outlined"
              onClick={onResetDefaults}
              disabled={isGenerating || isSaving}
            >
              Reset Defaults
            </Button>
            <Button variant="contained" color="secondary" onClick={onOpenGenerateConfirm} disabled={!canGenerateFsm}>
              {isGenerating ? 'Generating...' : 'Save & Generate FSM'}
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`${preview.scenarioCount} scenarios`} color="primary" variant="outlined" />
          <Chip label={`${preview.totalRows} total rows`} variant="outlined" />
          <Chip label={`${preview.discoveredStateCount} discovered states`} variant="outlined" />
          {preview.topArchetype ? <Chip label={`Archetype: ${preview.topArchetype}`} variant="outlined" /> : null}
        </Stack>

        {validationMessages.length > 0 ? <Alert severity="warning">{validationMessages.join(' ')}</Alert> : null}
      </Stack>
    </Paper>
  );
}
