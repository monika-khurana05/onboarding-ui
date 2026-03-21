import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppTheme } from '../../app/theme';
import type { WorkflowLintResult, WorkflowSpec, SnapshotModel } from '../../models/snapshot';
import { createDefaultStateManagerConfig } from '../state-manager/defaultScenarios';
import type { AnalysisModel } from '../state-manager/analysis/types';
import type { FsmGenerationResult } from '../state-manager/scenariosToFsm';
import { CreateSnapshotWizard } from './CreateSnapshotWizard';

const mocks = vi.hoisted(() => ({
  showError: vi.fn(),
  previewConversion: vi.fn(),
  scenariosToWorkflowSpec: vi.fn(),
  loadPresetYaml: vi.fn(),
  parseFsmYamlToSpec: vi.fn()
}));

vi.mock('../../app/GlobalErrorContext', () => ({
  useGlobalError: () => ({ showError: mocks.showError })
}));

vi.mock('../../components/WorkflowEditor', () => ({
  WorkflowTabPanels: ({ value }: { value: WorkflowSpec }) => <div>Workflow preview: {value.workflowKey}</div>,
  generateFsmYaml: (spec: WorkflowSpec) => JSON.stringify(spec)
}));

vi.mock('../../components/JsonMonacoPanel', () => ({
  JsonMonacoPanel: () => <div>Json editor</div>
}));

vi.mock('../../components/CatalogSelector', () => ({
  CatalogSelector: () => <div>Catalog selector</div>
}));

vi.mock('../../components/ParamsEditorDrawer', () => ({
  ParamsEditorDrawer: () => null
}));

vi.mock('../../components/SectionCard', () => ({
  SectionCard: ({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
      {actions}
      {children}
    </section>
  )
}));

vi.mock('../state-manager/StateManagerPanel', () => ({
  StateManagerPanel: ({
    value,
    onGenerateFsm,
    generationPreview,
    isGenerating
  }: {
    value: ReturnType<typeof createDefaultStateManagerConfig>;
    onGenerateFsm?: (config: ReturnType<typeof createDefaultStateManagerConfig>) => Promise<void> | void;
    generationPreview?: {
      topArchetype?: string;
      warningCount?: number;
    };
    isGenerating?: boolean;
  }) => (
    <div>
      <div>Panel archetype: {generationPreview?.topArchetype ?? 'none'}</div>
      <div>Panel warnings: {generationPreview?.warningCount ?? 0}</div>
      <button onClick={() => onGenerateFsm?.(value)} disabled={isGenerating}>
        Generate FSM
      </button>
    </div>
  )
}));

vi.mock('../state-manager/scenariosToFsm', () => ({
  previewConversion: mocks.previewConversion,
  scenariosToWorkflowSpec: mocks.scenariosToWorkflowSpec
}));

vi.mock('../workflow/presets/loadPresetYaml', () => ({
  loadPresetYaml: mocks.loadPresetYaml
}));

vi.mock('../workflow/presets/parseFsmYamlToSpec', () => ({
  parseFsmYamlToSpec: mocks.parseFsmYamlToSpec
}));

vi.mock('../workflow/presets/presetsRegistry', () => ({
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

