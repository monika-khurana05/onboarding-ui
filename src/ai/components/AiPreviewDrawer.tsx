import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography
} from '@mui/material';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type {
  AiDrawerScrollTarget,
  AiPreviewTab,
  AiSuggestionStatus,
  AiSuggestionType,
  RequirementsAnalysis,
  PojoMappingSheet,
  SyntheticDataPlan
} from '../types';
import { PojoMappingGrid } from './PojoMappingGrid';
import { TraceabilityPanel } from './TraceabilityPanel';

export type AiSuggestionItem = {
  id: string;
  label: string;
  description?: string;
  meta?: string;
  status: AiSuggestionStatus;
  applied: boolean;
};

export type AiWorkflowSuggestionItem = {
  id: string;
  from: string;
  event: string;
  target: string;
  actions: string[];
  rationale?: string;
  status: AiSuggestionStatus;
  applied: boolean;
};

type AiPreviewDrawerProps = {
  open: boolean;
  activeTab: AiPreviewTab;
  onTabChange: (tab: AiPreviewTab) => void;
  onClose: () => void;
  scrollTarget?: AiDrawerScrollTarget;
  onScrollTargetHandled?: () => void;
  analysis: RequirementsAnalysis | null;
  mappingSheet: PojoMappingSheet | null;
  syntheticPlan: SyntheticDataPlan | null;
  loading: {
    requirements: boolean;
    mapping: boolean;
    synthetic: boolean;
  };
  capabilitySuggestions: AiSuggestionItem[];
  validationSuggestions: AiSuggestionItem[];
  enrichmentSuggestions: AiSuggestionItem[];
  workflowSuggestions: AiWorkflowSuggestionItem[];
  onApplySuggestion: (type: AiSuggestionType, id: string) => void;
  onIgnoreSuggestion: (type: AiSuggestionType, id: string) => void;
  onOpenQuestion: (type: AiSuggestionType, id: string) => void;
  onApplyMappingRows: () => void;
  mappingAppliedRows: number;
  traceabilityProps: ComponentProps<typeof TraceabilityPanel>;
};

const statusChipConfig: Record<AiSuggestionStatus, { label: string; color: 'success' | 'warning' | 'default' }> = {
  pending: { label: 'Suggested', color: 'default' },
  applied: { label: 'Applied', color: 'success' },
  ignored: { label: 'Ignored', color: 'warning' },
  question: { label: 'Open Question', color: 'warning' }
};

function renderSuggestionCard(
  suggestion: AiSuggestionItem,
  type: AiSuggestionType,
  onApply: AiPreviewDrawerProps['onApplySuggestion'],
  onIgnore: AiPreviewDrawerProps['onIgnoreSuggestion'],
  onQuestion: AiPreviewDrawerProps['onOpenQuestion']
) {
  const status = suggestion.applied ? 'applied' : suggestion.status;
  const chip = statusChipConfig[status];
  return (
    <Paper key={suggestion.id} variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
          <Stack spacing={0.25}>
            <Typography variant="subtitle2">{suggestion.label}</Typography>
            {suggestion.description ? (
              <Typography variant="body2" color="text.secondary">
                {suggestion.description}
              </Typography>
            ) : null}
            {suggestion.meta ? (
              <Typography variant="caption" color="text.secondary">
                {suggestion.meta}
              </Typography>
            ) : null}
          </Stack>
          <Chip label={chip.label} size="small" color={chip.color} variant={status === 'applied' ? 'filled' : 'outlined'} />
        </Stack>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            onClick={() => onApply(type, suggestion.id)}
            disabled={suggestion.applied}
          >
            Apply
          </Button>
          <Button size="small" variant="text" color="warning" onClick={() => onIgnore(type, suggestion.id)}>
            Ignore
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => onQuestion(type, suggestion.id)}
            disabled={suggestion.status === 'question'}
          >
            Add Open Question
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function AiPreviewDrawer({
  open,
  activeTab,
  onTabChange,
  onClose,
  scrollTarget,
  onScrollTargetHandled,
  analysis,
  mappingSheet,
  syntheticPlan,
  loading,
  capabilitySuggestions,
  validationSuggestions,
  enrichmentSuggestions,
  workflowSuggestions,
  onApplySuggestion,
  onIgnoreSuggestion,
  onOpenQuestion,
  onApplyMappingRows,
  mappingAppliedRows,
  traceabilityProps
}: AiPreviewDrawerProps) {
  const requirementsRef = useRef<HTMLDivElement | null>(null);
  const capabilitiesRef = useRef<HTMLDivElement | null>(null);
  const rulesRef = useRef<HTMLDivElement | null>(null);
  const workflowRef = useRef<HTMLDivElement | null>(null);

  const scrollLookup = useMemo(
    () => ({
      requirements: requirementsRef,
      capabilities: capabilitiesRef,
      rules: rulesRef,
      workflow: workflowRef
    }),
    []
  );

  useEffect(() => {
    if (!open || activeTab !== 'requirements' || !scrollTarget) {
      return;
    }
    const ref = scrollLookup[scrollTarget];
    ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onScrollTargetHandled?.();
  }, [activeTab, onScrollTargetHandled, open, scrollLookup, scrollTarget]);

  const mappingRows = mappingSheet?.rows.length ?? 0;
  const requirementsMeta = analysis?.meta;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: { xs: '100%', md: 640 },
          top: { xs: 56, sm: 64 },
          height: { xs: 'calc(100% - 56px)', sm: 'calc(100% - 64px)' }
        }
      }}
    >
      <Stack sx={{ height: '100%' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, pb: 1.5 }}>
          <Stack spacing={0.5}>
            <Typography variant="h6">AI Assisted Mode</Typography>
            <Chip
              label="Preview / Demo Mode (R2D2 Pending)"
              size="small"
              color="warning"
              variant="outlined"
              sx={{ alignSelf: 'flex-start' }}
            />
          </Stack>
          <IconButton aria-label="Close AI drawer" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Divider />
        <Tabs
          value={activeTab}
          onChange={(_, value) => onTabChange(value as AiPreviewTab)}
          variant="scrollable"
          sx={{ px: 1.5 }}
        >
          <Tab value="requirements" label="Requirements -> Capabilities" />
          <Tab value="mapping" label="POJO Mapping (Excel-style grid)" />
          <Tab value="synthetic" label="Synthetic Smoke Pack" />
          <Tab value="traceability" label="Traceability" />
        </Tabs>
        <Divider />
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
          {activeTab === 'requirements' ? (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">Dataset</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Country: {requirementsMeta?.countryCode ?? '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Generated: {requirementsMeta?.generatedAt ?? '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Mode: {requirementsMeta?.mode ?? '-'} | Provider: {requirementsMeta?.provider ?? '-'}
                  </Typography>
                </Stack>
              </Paper>
              {requirementsMeta?.sourceDocuments?.length ? (
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2">Source Documents</Typography>
                    <Stack spacing={0.5}>
                      {requirementsMeta.sourceDocuments.map((doc) => (
                        <Typography key={doc.id} variant="body2" color="text.secondary">
                          {doc.id}: {doc.title} ({doc.type})
                        </Typography>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
              ) : null}

              <Box ref={requirementsRef}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1">Requirements</Typography>
                  {analysis?.summary?.headline ? (
                    <Typography variant="body2" color="text.secondary">
                      {analysis.summary.headline}
                    </Typography>
                  ) : null}
                  {loading.requirements ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">
                        Loading requirements analysis...
                      </Typography>
                    </Stack>
                  ) : analysis?.requirements?.length ? (
                    <Stack spacing={1}>
                      {analysis.requirements.map((req) => (
                        <Paper key={req.id} variant="outlined" sx={{ p: 1.5 }}>
                          <Stack spacing={0.5}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography variant="subtitle2">{req.text}</Typography>
                              <Chip label={req.category} size="small" variant="outlined" />
                              <Chip label={req.priority} size="small" color="warning" variant="outlined" />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              Requirement ID: {req.id}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Confidence: {Math.round(req.confidence * 100)}%
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Evidence: {req.evidence.length} | Open questions: {req.openQuestions.length} | Validation suggestions:{' '}
                              {req.suggestions.validations.length} | Enrichment suggestions: {req.suggestions.enrichments.length}
                            </Typography>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Alert severity="info">Load a mock analysis to see requirements.</Alert>
                  )}
                </Stack>
              </Box>

              <Box ref={capabilitiesRef}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1">Capability Suggestions</Typography>
                  {capabilitySuggestions.length ? (
                    <Stack spacing={1}>
                      {capabilitySuggestions.map((suggestion) =>
                        renderSuggestionCard(
                          suggestion,
                          'capability',
                          onApplySuggestion,
                          onIgnoreSuggestion,
                          onOpenQuestion
                        )
                      )}
                    </Stack>
                  ) : (
                    <Alert severity="info">No capability suggestions available yet.</Alert>
                  )}
                </Stack>
              </Box>

              <Box ref={rulesRef}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1">Validation/Enrichment Suggestions</Typography>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Validations</Typography>
                    {validationSuggestions.length ? (
                      <Stack spacing={1}>
                        {validationSuggestions.map((suggestion) =>
                          renderSuggestionCard(
                            suggestion,
                            'validation',
                            onApplySuggestion,
                            onIgnoreSuggestion,
                            onOpenQuestion
                          )
                        )}
                      </Stack>
                    ) : (
                      <Alert severity="info">No validation suggestions available yet.</Alert>
                    )}
                  </Stack>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Enrichments</Typography>
                    {enrichmentSuggestions.length ? (
                      <Stack spacing={1}>
                        {enrichmentSuggestions.map((suggestion) =>
                          renderSuggestionCard(
                            suggestion,
                            'enrichment',
                            onApplySuggestion,
                            onIgnoreSuggestion,
                            onOpenQuestion
                          )
                        )}
                      </Stack>
                    ) : (
                      <Alert severity="info">No enrichment suggestions available yet.</Alert>
                    )}
                  </Stack>
                </Stack>
              </Box>

              <Box ref={workflowRef}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1">Workflow Transition Suggestions</Typography>
                  {workflowSuggestions.length ? (
                    <Stack spacing={1}>
                      {workflowSuggestions.map((suggestion) => {
                        const status = suggestion.applied ? 'applied' : suggestion.status;
                        const chip = statusChipConfig[status];
                        return (
                          <Paper key={suggestion.id} variant="outlined" sx={{ p: 1.5 }}>
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                                <Stack spacing={0.5}>
                                  <Typography variant="subtitle2">
                                    {suggestion.from} -> {suggestion.target}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Event: {suggestion.event}
                                  </Typography>
                                  {suggestion.actions.length ? (
                                    <Typography variant="body2" color="text.secondary">
                                      Actions: {suggestion.actions.join(', ')}
                                    </Typography>
                                  ) : null}
                                  {suggestion.rationale ? (
                                    <Typography variant="caption" color="text.secondary">
                                      {suggestion.rationale}
                                    </Typography>
                                  ) : null}
                                </Stack>
                                <Chip
                                  label={chip.label}
                                  size="small"
                                  color={chip.color}
                                  variant={status === 'applied' ? 'filled' : 'outlined'}
                                />
                              </Stack>
                              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => onApplySuggestion('workflow', suggestion.id)}
                                  disabled={suggestion.applied}
                                >
                                  Apply
                                </Button>
                                <Button
                                  size="small"
                                  variant="text"
                                  color="warning"
                                  onClick={() => onIgnoreSuggestion('workflow', suggestion.id)}
                                >
                                  Ignore
                                </Button>
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => onOpenQuestion('workflow', suggestion.id)}
                                  disabled={suggestion.status === 'question'}
                                >
                                  Add Open Question
                                </Button>
                              </Stack>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Alert severity="info">No workflow suggestions available yet.</Alert>
                  )}
                </Stack>
              </Box>
            </Stack>
          ) : null}

          {activeTab === 'mapping' ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                <Stack spacing={0.25}>
                  <Typography variant="subtitle1">POJO Mapping Sheet</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {mappingSheet?.summary?.headline ?? 'Load a sheet to preview the grid.'}
                  </Typography>
                  {mappingSheet ? (
                    <Typography variant="caption" color="text.secondary">
                      Sheet: {mappingSheet.meta.sheetId} | Confidence: {Math.round(mappingSheet.summary.confidence * 100)}%
                    </Typography>
                  ) : null}
                </Stack>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={onApplyMappingRows}
                  disabled={!mappingSheet?.rows.length}
                >
                  Mark All Rows Applied
                </Button>
              </Stack>
              {loading.mapping ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    Loading mapping sheet...
                  </Typography>
                </Stack>
              ) : mappingSheet ? (
                <>
                  <PojoMappingGrid rows={mappingSheet.rows} />
                  <Typography variant="caption" color="text.secondary">
                    Applied rows: {Math.min(mappingAppliedRows, mappingRows)} / {mappingRows}
                  </Typography>
                </>
              ) : (
                <Alert severity="info">Use the AI button to load a mock mapping sheet.</Alert>
              )}
            </Stack>
          ) : null}

          {activeTab === 'synthetic' ? (
            <Stack spacing={2}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1">Synthetic Smoke Pack</Typography>
                <Typography variant="body2" color="text.secondary">
                  {syntheticPlan?.summary?.headline ?? 'Mock scenarios that validate the onboarding configuration.'}
                </Typography>
                {syntheticPlan ? (
                  <Typography variant="caption" color="text.secondary">
                    Confidence: {Math.round(syntheticPlan.summary.confidence * 100)}% | Coverage:{' '}
                    {syntheticPlan.summary.impact.coverageNote}
                  </Typography>
                ) : null}
              </Stack>
              {syntheticPlan?.maskingPolicy ? (
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2">Masking Policy</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Principles: {syntheticPlan.maskingPolicy.principles.join(', ')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Rules: {syntheticPlan.maskingPolicy.rules.length}
                    </Typography>
                  </Stack>
                </Paper>
              ) : null}
              {loading.synthetic ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    Loading synthetic smoke pack...
                  </Typography>
                </Stack>
              ) : syntheticPlan?.scenarios?.length ? (
                <Stack spacing={1}>
                  {syntheticPlan.scenarios.map((scenario) => (
                    <Paper key={scenario.scenarioId} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack spacing={0.5}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography variant="subtitle2">{scenario.title}</Typography>
                          <Chip label={scenario.type} size="small" variant="outlined" />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Scenario ID: {scenario.scenarioId}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Inputs: {JSON.stringify(scenario.inputs)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Expected: {JSON.stringify(scenario.expected)}
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Alert severity="info">No synthetic smoke pack loaded yet.</Alert>
              )}
            </Stack>
          ) : null}

          {activeTab === 'traceability' ? <TraceabilityPanel {...traceabilityProps} /> : null}
        </Box>
      </Stack>
    </Drawer>
  );
}
