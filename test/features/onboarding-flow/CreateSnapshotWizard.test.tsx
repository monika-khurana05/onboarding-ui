import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppTheme } from '../../../src/app/theme';
import type { WorkflowLintResult, WorkflowSpec, SnapshotModel } from '../../../src/models/snapshot';
import { createDefaultStateManagerConfig } from '../../../src/features/state-manager/defaultScenarios';
import type { AnalysisModel } from '../../../src/features/state-manager/analysis/types';
import type { FsmGenerationResult } from '../../../src/features/state-manager/scenariosToFsm';
import { CreateSnapshotWizard } from '../../../src/features/onboarding-flow/CreateSnapshotWizard';

const mocks = vi.hoisted(() => ({
  showError: vi.fn(),
  previewConversion: vi.fn(),
  scenariosToWorkflowSpec: vi.fn(),
  loadPresetYaml: vi.fn(),
  parseFsmYamlToSpec: vi.fn(),
  saveScenarioConfig: vi.fn()
}));

vi.mock('../../../src/app/GlobalErrorContext', () => ({
  useGlobalError: () => ({ showError: mocks.showError })
}));

vi.mock('../../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../../src/api/client');
  return {
    ...actual,
    createSnapshot: vi.fn(),
    createSnapshotVersion: vi.fn(),
    saveScenarioConfig: mocks.saveScenarioConfig
  };
});

vi.mock('../../../src/components/WorkflowEditor', () => ({
  WorkflowTabPanels: ({
    value,
    onChange
  }: {
    value: WorkflowSpec;
    onChange?: (workflow: WorkflowSpec) => void;
  }) => (
    <div>
      <div>Workflow preview: {value.workflowKey}</div>
      {onChange ? (
        <button
          onClick={() =>
            onChange({
              workflowKey: 'PAYMENT_INGRESS',
              statesClass: 'com.citi.cpx.statemanager.fsm.State',
              eventsClass: 'com.citi.cpx.statemanager.fsm.Event',
              startState: 'RECEIVED',
              states: [
                {
                  name: 'RECEIVED',
                  onEvent: {
                    VALIDATE: { target: 'VALIDATED', actions: [] }
                  }
                },
                {
                  name: 'VALIDATED',
                  onEvent: {
                    CLEAR: { target: 'CLEARED', actions: [] }
                  }
                },
                {
                  name: 'CLEARED',
                  onEvent: {}
                }
              ]
            })
          }
        >
          Reset Workflow Preview
        </button>
      ) : null}
    </div>
  ),
  generateFsmYaml: (spec: WorkflowSpec) => JSON.stringify(spec)
}));

vi.mock('../../../src/components/JsonMonacoPanel', () => ({
  JsonMonacoPanel: () => <div>Json editor</div>
}));

vi.mock('../../../src/components/CatalogSelector', () => ({
  CatalogSelector: () => <div>Catalog selector</div>
}));

vi.mock('../../../src/components/ParamsEditorDrawer', () => ({
  ParamsEditorDrawer: () => null
}));

vi.mock('../../../src/components/SectionCard', () => ({
  SectionCard: ({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
      {actions}
      {children}
    </section>
  )
}));

vi.mock('../../../src/features/state-manager/StateManagerPanel', () => ({
  StateManagerPanel: ({
    value,
    onChange,
    onCountryChange,
    onFlowDirectionChange,
    onSaveScenarios,
    onGenerateFsm,
    generationPreview,
    isSaving,
    isGenerating
  }: {
    value: ReturnType<typeof createDefaultStateManagerConfig>;
    onChange: (config: ReturnType<typeof createDefaultStateManagerConfig>) => void;
    onCountryChange?: (countryCode: string) => void;
    onFlowDirectionChange?: (flowDirection: 'INCOMING' | 'OUTGOING') => void;
    onSaveScenarios?: (config: ReturnType<typeof createDefaultStateManagerConfig>) => Promise<void> | void;
    onGenerateFsm?: (config: ReturnType<typeof createDefaultStateManagerConfig>) => Promise<void> | void;
    generationPreview?: {
      topArchetype?: string;
      warningCount?: number;
    };
    isSaving?: boolean;
    isGenerating?: boolean;
  }) => (
    <div>
      <div>Panel archetype: {generationPreview?.topArchetype ?? 'none'}</div>
      <div>Panel warnings: {generationPreview?.warningCount ?? 0}</div>
      <div>Panel country: {value.countryCode}</div>
      <div>Panel flow: {value.flowDirection}</div>
      <div>Panel scenarios: {value.scenarios.length}</div>
      <button onClick={() => onCountryChange?.('SG')}>Change Country</button>
      <button onClick={() => onFlowDirectionChange?.('INCOMING')}>Change Flow</button>
      <button
        onClick={() =>
          onChange({
            ...value,
            scenarios: [
              {
                id: 'imported-scenario',
                name: 'Imported Scenario',
                description: 'Imported from file',
                hasScenarioColumn: false,
                hasResponsibleColumn: false,
                hasTriggerReversalColumn: false,
                subFlows: [
                  {
                    id: 'imported-sub-flow',
                    title: 'Imported Sub-flow',
                    rows: [
                      {
                        id: 'imported-row',
                        msgStatus: 'RECEIVED',
                        msgSubStatus: 'VALIDATED',
                        channelPushNotification: false,
                        cdmNotification: false,
                        transactionStatus: 'PDNG',
                        transactionStatusReason: 'ACCEPTED',
                        reasonDescription: 'Imported row'
                      }
                    ]
                  }
                ]
              }
            ]
          })
        }
      >
        Import Scenario
      </button>
      <button
        onClick={() =>
          onChange({
            ...value,
            scenarios: value.scenarios.map((scenario, index) =>
              index === 0 ? { ...scenario, name: 'Edited Scenario' } : scenario
            )
          })
        }
      >
        Edit Scenario
      </button>
      <button onClick={() => onChange(createDefaultStateManagerConfig(value.countryCode, value.flowDirection))}>
        Reset Defaults
      </button>
      <button onClick={() => onSaveScenarios?.(value)} disabled={isSaving}>
        Save Scenarios
      </button>
      <button onClick={() => onGenerateFsm?.(value)} disabled={isGenerating}>
        Generate FSM
      </button>
    </div>
  )
}));

vi.mock('../../../src/features/state-manager/scenariosToFsm', () => ({
  previewConversion: mocks.previewConversion,
  scenariosToWorkflowSpec: mocks.scenariosToWorkflowSpec
}));

vi.mock('../../../src/features/workflow/presets/loadPresetYaml', () => ({
  loadPresetYaml: mocks.loadPresetYaml
}));

vi.mock('../../../src/features/workflow/presets/parseFsmYamlToSpec', () => ({
  parseFsmYamlToSpec: mocks.parseFsmYamlToSpec
}));

vi.mock('../../../src/features/workflow/presets/presetsRegistry', () => ({
  FSM_PRESETS: [{ url: '/presets/br-outgoing.yaml' }, { url: '/presets/ar-outgoing.yaml' }],
  findPresetUrl: () => '/presets/br-outgoing.yaml'
}));

function makeWorkflow(workflowKey: string): WorkflowSpec {
  return {
    workflowKey,
    statesClass: 'com.citi.cpx.statemanager.fsm.State',
    eventsClass: 'com.citi.cpx.statemanager.fsm.Event',
    startState: 'Init',
    states: [
      {
        name: 'Init',
        onEvent: {
          Advance: { target: 'Done', actions: ['persist-txn'] }
        }
      },
      {
        name: 'Done',
        onEvent: {}
      }
    ]
  };
}

function makeDefaultWorkflow(): WorkflowSpec {
  return {
    workflowKey: 'PAYMENT_INGRESS',
    statesClass: 'com.citi.cpx.statemanager.fsm.State',
    eventsClass: 'com.citi.cpx.statemanager.fsm.Event',
    startState: 'RECEIVED',
    states: [
      {
        name: 'RECEIVED',
        onEvent: {
          VALIDATE: { target: 'VALIDATED', actions: [] }
        }
      },
      {
        name: 'VALIDATED',
        onEvent: {
          CLEAR: { target: 'CLEARED', actions: [] }
        }
      },
      {
        name: 'CLEARED',
        onEvent: {}
      }
    ]
  };
}

function makeLint(): WorkflowLintResult {
  return {
    errors: [],
    warnings: [],
    issues: []
  };
}

function makeAnalysis(overrides: Partial<AnalysisModel> = {}): AnalysisModel {
  return {
    normalizedRows: [],
    discoveredStates: new Set(['Init', 'BalanceCheckPending', 'NormalPostingPending', 'FinalPostingComplete']),
    rawSequences: [['Init', 'BalanceCheckPending', 'NormalPostingPending', 'FinalPostingComplete']],
    prunedTransitions: new Map([
      ['Init', new Set(['BalanceCheckPending'])],
      ['BalanceCheckPending', new Set(['NormalPostingPending'])],
      ['NormalPostingPending', new Set(['FinalPostingComplete'])]
    ]),
    lifecycleFlags: {
      hasSpm: false,
      hasSanctions: false,
      hasBalanceCheck: true,
      hasClearing: false,
      hasPosting: true,
      hasWarehousing: false,
      hasBookTransfer: false,
      hasIncomingFlow: false,
      hasOutgoingFlow: true
    },
    inferredTargets: {
      nextAfterInit: 'BalanceCheckPending',
      postSanctionsTarget: 'BalanceCheckPending',
      balanceTarget: 'NormalPostingPending',
      warehousedReleaseTarget: undefined
    },
    additionalTerminals: new Set(['FinalPostingComplete']),
    conflicts: [],
    warnings: [],
    evidence: [
      {
        decision: 'nextAfterInit',
        chosenValue: 'BalanceCheckPending',
        reason: 'Balance-check lifecycle dominates the observed scenario paths.',
        sources: ['Happy Flow / Current'],
        confidence: 'HIGH' as const
      }
    ],
    archetypeMatches: [
      {
        archetype: 'OUTGOING_SIMPLE_POSTING' as const,
        score: 0.92,
        reasons: ['Posting path dominates observed transitions.']
      }
    ],
    ...overrides
  };
}

function makeGenerationResult(overrides: Partial<FsmGenerationResult> = {}): FsmGenerationResult {
  return {
    spec: makeWorkflow('GENERATED_FLOW'),
    newTransitions: new Set(['Init::Advance']),
    lint: makeLint(),
    analysis: makeAnalysis(),
    graphValidation: { issues: [], hasErrors: false },
    scenarioReplay: {
      results: [
        {
          scenarioName: 'Happy Flow',
          subFlowTitle: 'Current',
          expectedStates: ['Init', 'BalanceCheckPending', 'NormalPostingPending', 'FinalPostingComplete'],
          matched: true,
          missingTransitions: [],
          unexpectedStates: []
        }
      ],
      failedCount: 0,
      passedCount: 1
    },
    presetBackedTransitionKeys: new Set(['Init::PresetPath']),
    fallbackTransitionKeys: new Set(['Init::Advance']),
    ...overrides
  };
}

function makeInitialSnapshot(workflowKey = 'EXISTING_FLOW'): SnapshotModel {
  return {
    countryCode: 'BR',
    region: undefined,
    capabilities: [],
    validations: [],
    enrichments: [],
    selectedValidations: [],
    selectedEnrichments: [],
    actions: [],
    workflow: makeWorkflow(workflowKey),
    stateManagerConfig: createDefaultStateManagerConfig('BR', 'OUTGOING'),
    integrationConfig: {},
    deploymentOverrides: {}
  };
}

function renderWizard(initialSnapshot = makeInitialSnapshot()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={createAppTheme('dark')}>
        <MemoryRouter initialEntries={['/snapshots/new?flow=OUTGOING']}>
          <CreateSnapshotWizard initialSnapshot={initialSnapshot} />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

async function goToStateManagerStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^next$/i }));
  await screen.findByText(/Step 2: CPX Capability Selection/i);
  await user.click(screen.getByRole('button', { name: /^next$/i }));
  await screen.findByText(/Step 3: Validation & Enrichment/i);
  await user.click(screen.getByRole('button', { name: /^next$/i }));
  await screen.findByText(/Step 4: State Manager \/ Workflow/i);
  await screen.findByRole('button', { name: /generate fsm/i });
}

describe('CreateSnapshotWizard FSM analysis UI', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.previewConversion.mockReturnValue({
      scenarioCount: 8,
      totalRows: 105,
      discoveredStateCount: 18,
      topArchetype: 'OUTGOING_SIMPLE_POSTING',
      warningCount: 0,
      conflictCount: 0
    });
    mocks.loadPresetYaml.mockResolvedValue('preset-yaml');
    mocks.parseFsmYamlToSpec.mockReturnValue(makeWorkflow('PRESET_FLOW'));
  });

  it(
    'does not auto-generate on load and shows the empty preview state until generation is requested',
    async () => {
      renderWizard({
        ...makeInitialSnapshot('EXISTING_FLOW'),
        workflow: makeDefaultWorkflow()
      });
      const user = userEvent.setup();

      await goToStateManagerStep(user);

      expect(screen.getByText('No FSM generated yet')).toBeInTheDocument();
      expect(mocks.scenariosToWorkflowSpec).not.toHaveBeenCalled();
    },
    20000
  );

  it(
    'does not regenerate when the previewed workflow is manually reset and falls back to the empty preview state',
    async () => {
      renderWizard(makeInitialSnapshot('EXISTING_FLOW'));
      const user = userEvent.setup();

      await goToStateManagerStep(user);
      expect(screen.getByText('Workflow preview: EXISTING_FLOW')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /reset workflow preview/i }));

      expect(screen.getByText('No FSM generated yet')).toBeInTheDocument();
      expect(mocks.scenariosToWorkflowSpec).not.toHaveBeenCalled();
    },
    20000
  );

  it(
    'shows a persisted workflow preview without regenerating it on load',
    async () => {
      renderWizard(makeInitialSnapshot('EXISTING_FLOW'));
      const user = userEvent.setup();

      await goToStateManagerStep(user);

      expect(screen.getByText('Workflow preview: EXISTING_FLOW')).toBeInTheDocument();
      expect(mocks.scenariosToWorkflowSpec).not.toHaveBeenCalled();
    },
    20000
  );

  it(
    'shows analysis summary, inferred targets, and transition source counts on successful generation',
    async () => {
      mocks.scenariosToWorkflowSpec.mockReturnValue(makeGenerationResult());
      renderWizard();
      const user = userEvent.setup();

      await goToStateManagerStep(user);
      await user.click(screen.getByRole('button', { name: /generate fsm/i }));

      expect(await screen.findByText('FSM Analysis Summary')).toBeInTheDocument();
      expect(screen.getByText('OUTGOING_SIMPLE_POSTING')).toBeInTheDocument();
      expect(screen.getAllByText('BalanceCheckPending').length).toBeGreaterThan(0);
      expect(screen.getByText('NormalPostingPending')).toBeInTheDocument();
      expect(screen.getByText('1 KB-backed')).toBeInTheDocument();
      expect(screen.getByText('1 fallback')).toBeInTheDocument();
      expect(screen.getByText('Workflow preview: GENERATED_FLOW')).toBeInTheDocument();
      expect(mocks.showError).not.toHaveBeenCalled();
    },
    20000
  );

  it(
    'keeps warning-only generation successful and still renders the workflow preview',
    async () => {
      mocks.scenariosToWorkflowSpec.mockReturnValue(
        makeGenerationResult({
          spec: makeWorkflow('GENERATED_WITH_WARNING'),
          analysis: makeAnalysis({
            warnings: [
              {
                code: 'WAREHOUSE_TARGET_INFERRED',
                severity: 'WARN',
                message: 'Warehoused release target inferred from limited evidence.',
                details: ['Observed once in Current sub-flow']
              }
            ]
          })
        })
      );
      renderWizard();
      const user = userEvent.setup();

      await goToStateManagerStep(user);
      await user.click(screen.getByRole('button', { name: /generate fsm/i }));

      expect(await screen.findByText('FSM Analysis Summary')).toBeInTheDocument();
      expect(screen.getByText(/WAREHOUSE_TARGET_INFERRED/i)).toBeInTheDocument();
      expect(screen.getByText('Workflow preview: GENERATED_WITH_WARNING')).toBeInTheDocument();
    },
    20000
  );

  it(
    'shows failure details and preserves the previous workflow preview when generation fails',
    async () => {
      const failure = Object.assign(new Error('FSM analysis failed: BALANCE_TARGET_AMBIGUOUS: Balance target is ambiguous'), {
        analysis: makeAnalysis({
          conflicts: [
            {
              code: 'BALANCE_TARGET_AMBIGUOUS',
              severity: 'ERROR',
              message: 'Balance target is ambiguous',
              details: ['Equal evidence for NormalPostingPending and SendClearingPostingPending']
            }
          ]
        }),
        graphValidation: { issues: [], hasErrors: false },
        scenarioReplay: { results: [], failedCount: 0, passedCount: 0 },
        newTransitions: new Set<string>(),
        presetBackedTransitionKeys: new Set<string>(),
        fallbackTransitionKeys: new Set<string>()
      });
      mocks.scenariosToWorkflowSpec.mockImplementation(() => {
        throw failure;
      });
      renderWizard(makeInitialSnapshot('EXISTING_FLOW'));
      const user = userEvent.setup();

      await goToStateManagerStep(user);
      await user.click(screen.getByRole('button', { name: /generate fsm/i }));

      expect((await screen.findAllByText(/FSM analysis failed: BALANCE_TARGET_AMBIGUOUS/i)).length).toBeGreaterThan(0);
      expect(screen.getByText('FSM Analysis Summary')).toBeInTheDocument();
      expect(screen.queryByText(/Generation blocked:/i)).not.toBeInTheDocument();
      expect(screen.getAllByText(/BALANCE_TARGET_AMBIGUOUS/i).length).toBeGreaterThan(0);
      expect(screen.getByText('Workflow preview: EXISTING_FLOW')).toBeInTheDocument();
      expect(screen.queryByText('Workflow preview: GENERATED_FLOW')).not.toBeInTheDocument();
      expect(mocks.showError).toHaveBeenCalledWith(
        'FSM analysis failed: BALANCE_TARGET_AMBIGUOUS: Balance target is ambiguous'
      );
    },
    20000
  );

  it(
    'shows a plain generation error without rendering an empty analysis summary',
    async () => {
      mocks.scenariosToWorkflowSpec.mockImplementation(() => {
        throw new Error('Preset load failed for BR_OUTGOING_PAYMENT');
      });
      renderWizard(makeInitialSnapshot('EXISTING_FLOW'));
      const user = userEvent.setup();

      await goToStateManagerStep(user);
      await user.click(screen.getByRole('button', { name: /generate fsm/i }));

      expect(await screen.findByText('Preset load failed for BR_OUTGOING_PAYMENT')).toBeInTheDocument();
      expect(screen.queryByText('FSM Analysis Summary')).not.toBeInTheDocument();
      expect(screen.getByText('Workflow preview: EXISTING_FLOW')).toBeInTheDocument();
    },
    20000
  );
});





describe('CreateSnapshotWizard scenario save flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.previewConversion.mockReturnValue({
      scenarioCount: 8,
      totalRows: 105,
      discoveredStateCount: 18,
      topArchetype: 'OUTGOING_SIMPLE_POSTING',
      warningCount: 0,
      conflictCount: 0
    });
    mocks.loadPresetYaml.mockResolvedValue('preset-yaml');
    mocks.parseFsmYamlToSpec.mockReturnValue(makeWorkflow('PRESET_FLOW'));
    mocks.scenariosToWorkflowSpec.mockReturnValue(makeGenerationResult());
    mocks.saveScenarioConfig.mockResolvedValue({
      success: true,
      message: 'Scenario configuration saved successfully',
      updatedAt: '2026-03-21T10:00:00.000Z'
    });
  });

  it(
    'keeps country and flow aligned with the wizard state and sends them in the save payload',
    async () => {
      renderWizard();
      const user = userEvent.setup();

      await goToStateManagerStep(user);
      expect(screen.getByText('Panel country: BR')).toBeInTheDocument();
      expect(screen.getByText('Panel flow: OUTGOING')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /change country/i }));
      await user.click(screen.getByRole('button', { name: /change flow/i }));

      expect(await screen.findByText('Panel country: SG')).toBeInTheDocument();
      expect(await screen.findByText('Panel flow: INCOMING')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^save scenarios$/i }));

      await waitFor(() => expect(mocks.saveScenarioConfig).toHaveBeenCalledTimes(1));
      expect(mocks.scenariosToWorkflowSpec).not.toHaveBeenCalled();
      expect(mocks.saveScenarioConfig.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          countryCode: 'SG',
          flowDirection: 'INCOMING',
          stateManagerConfig: expect.objectContaining({
            countryCode: 'SG',
            flowDirection: 'INCOMING'
          })
        })
      );
      expect(await screen.findByText('Scenario configuration saved successfully')).toBeInTheDocument();
    },
    20000
  );

  it(
    'does not auto-generate on edit, import, country change, flow change, or reset defaults and marks the preview stale',
    async () => {
      renderWizard(makeInitialSnapshot('EXISTING_FLOW'));
      const user = userEvent.setup();

      await goToStateManagerStep(user);
      expect(screen.getByText('Workflow preview: EXISTING_FLOW')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /edit scenario/i }));
      await user.click(screen.getByRole('button', { name: /import scenario/i }));
      await user.click(screen.getByRole('button', { name: /change country/i }));
      await user.click(screen.getByRole('button', { name: /change flow/i }));
      await user.click(screen.getByRole('button', { name: /reset defaults/i }));

      expect(mocks.scenariosToWorkflowSpec).not.toHaveBeenCalled();
      expect(
        screen.getByText(/Scenario configuration changed\. Click Save & Generate FSM to refresh the FSM\./i)
      ).toBeInTheDocument();
    },
    20000
  );

  it(
    'marks the generated workflow preview as stale after a later scenario edit',
    async () => {
      mocks.scenariosToWorkflowSpec.mockReturnValue(makeGenerationResult());
      renderWizard(makeInitialSnapshot('EXISTING_FLOW'));
      const user = userEvent.setup();

      await goToStateManagerStep(user);
      await user.click(screen.getByRole('button', { name: /generate fsm/i }));
      expect(await screen.findByText('Workflow preview: GENERATED_FLOW')).toBeInTheDocument();
      expect(mocks.scenariosToWorkflowSpec).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('button', { name: /edit scenario/i }));

      expect(mocks.scenariosToWorkflowSpec).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(/Scenario configuration changed\. Click Save & Generate FSM to refresh the FSM\./i)
      ).toBeInTheDocument();
    },
    20000
  );

  it(
    'shows save failure feedback and keeps Save Scenarios separate from Generate FSM',
    async () => {
      mocks.saveScenarioConfig.mockRejectedValueOnce(new Error('Scenario save failed'));
      renderWizard();
      const user = userEvent.setup();

      await goToStateManagerStep(user);
      await user.click(screen.getByRole('button', { name: /^save scenarios$/i }));

      expect(await screen.findByText('Scenario save failed')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /generate fsm/i }));
      await waitFor(() => expect(mocks.saveScenarioConfig).toHaveBeenCalledTimes(1));
    },
    20000
  );

  it(
    'saves imported scenarios from the latest panel state',
    async () => {
      renderWizard();
      const user = userEvent.setup();

      await goToStateManagerStep(user);
      await user.click(screen.getByRole('button', { name: /import scenario/i }));
      expect(await screen.findByText('Panel scenarios: 1')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^save scenarios$/i }));

      await waitFor(() => expect(mocks.saveScenarioConfig).toHaveBeenCalledTimes(1));
      expect(mocks.scenariosToWorkflowSpec).not.toHaveBeenCalled();
      expect(mocks.saveScenarioConfig.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          stateManagerConfig: expect.objectContaining({
            scenarios: [expect.objectContaining({ name: 'Imported Scenario' })]
          })
        })
      );
    },
    20000
  );
});






