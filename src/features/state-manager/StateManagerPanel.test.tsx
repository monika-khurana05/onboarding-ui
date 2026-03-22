import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createAppTheme } from '../../app/theme';
import { createDefaultStateManagerConfig } from './defaultScenarios';
import { StateManagerPanel } from './StateManagerPanel';
import type { ScenarioCategory, StateManagerConfig, StatusRow, SubFlow } from './types';

function buildRow(id: string, overrides: Partial<StatusRow> = {}): StatusRow {
  return {
    id,
    msgStatus: 'PENDING',
    msgSubStatus: 'VALIDATED',
    channelPushNotification: false,
    cdmNotification: false,
    transactionStatus: 'PDNG',
    transactionStatusReason: '',
    reasonDescription: '',
    scenario: '',
    responsibleComponent: '',
    triggerReversal: false,
    ...overrides
  };
}

function buildSubFlow(title: string, rows: StatusRow[] = [buildRow(`${title}-row-1`)]): SubFlow {
  return {
    id: `subflow-${title.replace(/\s+/g, '-').toLowerCase()}`,
    title,
    rows
  };
}

function buildScenario(name: string, overrides: Partial<ScenarioCategory> = {}): ScenarioCategory {
  return {
    id: `scenario-${name.replace(/\s+/g, '-').toLowerCase()}`,
    name,
    description: `${name} description`,
    hasScenarioColumn: false,
    hasResponsibleColumn: false,
    hasTriggerReversalColumn: false,
    subFlows: [buildSubFlow(`${name} Flow`)],
    ...overrides
  };
}

function buildConfig(scenarios: ScenarioCategory[]): StateManagerConfig {
  return {
    countryCode: 'BR',
    flowDirection: 'OUTGOING',
    scenarios,
    lastUpdated: '2026-03-22T00:00:00.000Z'
  };
}

vi.mock('./import/ImportScenariosPanel', () => ({
  ImportScenariosPanel: ({
    countryCode,
    flowDirection,
    onImportSuccess
  }: {
    countryCode: string;
    flowDirection: 'INCOMING' | 'OUTGOING';
    onImportSuccess: (config: StateManagerConfig) => void;
  }) => (
    <button
      onClick={() =>
        onImportSuccess({
          ...createDefaultStateManagerConfig(countryCode, flowDirection),
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
                  rows: []
                }
              ]
            }
          ]
        })
      }
    >
      Replace Current Scenarios
    </button>
  )
}));

vi.mock('./ScenarioTable', () => ({
  ScenarioTable: ({
    scenario,
    onChange
  }: {
    scenario: ScenarioCategory;
    onChange: (nextScenario: ScenarioCategory) => void;
  }) => {
    const buildAddedRow = (): StatusRow => ({
      id: `row-${scenario.subFlows[0]?.rows.length ?? 0}`,
      msgStatus: 'PENDING',
      msgSubStatus: 'VALIDATED',
      channelPushNotification: false,
      cdmNotification: false,
      transactionStatus: 'PDNG',
      transactionStatusReason: '',
      reasonDescription: ''
    });

    return (
      <div>
        <button
          onClick={() => {
            const [firstSubFlow, ...rest] = scenario.subFlows;
            if (!firstSubFlow) {
              return;
            }
            onChange({
              ...scenario,
              subFlows: [
                {
                  ...firstSubFlow,
                  rows: [...firstSubFlow.rows, buildAddedRow()]
                },
                ...rest
              ]
            });
          }}
        >
          Add Row
        </button>
        <button
          onClick={() =>
            onChange({
              ...scenario,
              subFlows: [
                ...scenario.subFlows,
                {
                  id: `subflow-${scenario.id}-${scenario.subFlows.length + 1}`,
                  title: `Sub-flow ${scenario.subFlows.length + 1}`,
                  rows: []
                }
              ]
            })
          }
        >
          Table Add Sub-flow
        </button>
        {scenario.subFlows.map((subFlow) => (
          <label key={subFlow.id}>{subFlow.title}</label>
        ))}
      </div>
    );
  }
}));

function TestHarness({
  onGenerateFsm = vi.fn(),
  onSaveScenarios = vi.fn(),
  generationPreview,
  initialValue = createDefaultStateManagerConfig('BR', 'OUTGOING')
}: {
  onGenerateFsm?: (config: StateManagerConfig) => Promise<void> | void;
  onSaveScenarios?: (config: StateManagerConfig) => Promise<void> | void;
  generationPreview?: ComponentProps<typeof StateManagerPanel>['generationPreview'];
  initialValue?: StateManagerConfig;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <ThemeProvider theme={createAppTheme('dark')}>
      <StateManagerPanel
        value={value}
        onChange={setValue}
        onCountryChange={(countryCode) =>
          setValue((prev) => ({
            ...prev,
            countryCode,
            lastUpdated: new Date().toISOString()
          }))
        }
        onFlowDirectionChange={(flowDirection) =>
          setValue((prev) => ({
            ...prev,
            flowDirection,
            lastUpdated: new Date().toISOString()
          }))
        }
        onSaveScenarios={onSaveScenarios}
        onGenerateFsm={onGenerateFsm}
        generationPreview={generationPreview}
      />
    </ThemeProvider>
  );
}

describe('StateManagerPanel', () => {
  it(
    'renders country and flow context controls',
    () => {
      render(<TestHarness initialValue={buildConfig([buildScenario('Alpha Scenario')])} />);

      expect(screen.getByRole('textbox', { name: /country code/i })).toHaveValue('BR');
      expect(screen.getByRole('button', { name: 'OUTGOING' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'INCOMING' })).toBeInTheDocument();
    },
    20000
  );

  it(
    'updates country and flow from the context bar',
    async () => {
      render(<TestHarness initialValue={buildConfig([buildScenario('Alpha Scenario')])} />);
      const user = userEvent.setup();

      const countryInput = screen.getByRole('textbox', { name: /country code/i });
      await user.clear(countryInput);
      await user.type(countryInput, 'sg');
      expect(countryInput).toHaveValue('SG');

      await user.click(screen.getByRole('button', { name: 'INCOMING' }));
      expect(screen.getByRole('button', { name: 'INCOMING' })).toHaveAttribute('aria-pressed', 'true');
    },
    20000
  );

  it('disables Save Scenarios when the configuration is invalid', async () => {
    render(<TestHarness />);
    const user = userEvent.setup();

    const countryInput = screen.getByRole('textbox', { name: /country code/i });
    await user.clear(countryInput);

    expect(screen.getByRole('button', { name: /save scenarios/i })).toBeDisabled();
    expect(screen.getAllByText(/country code is required before saving scenarios/i).length).toBeGreaterThan(0);
  });

  it('invokes Save Scenarios with the current config', async () => {
    const onSaveScenarios = vi.fn();
    render(<TestHarness onSaveScenarios={onSaveScenarios} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /save scenarios/i }));

    await waitFor(() => expect(onSaveScenarios).toHaveBeenCalledTimes(1));
    expect(onSaveScenarios).toHaveBeenCalledWith(
      expect.objectContaining({
        countryCode: 'BR',
        flowDirection: 'OUTGOING',
        scenarios: expect.any(Array)
      })
    );
  });

  it(
    'supports adding rows and sub-flows',
    async () => {
      render(
        <TestHarness initialValue={buildConfig([buildScenario('Alpha Scenario')])} />
      );
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /^add row$/i }));
      await waitFor(() => expect(screen.getAllByText('2 rows').length).toBeGreaterThan(0));

      await user.click(screen.getByRole('button', { name: /table add sub-flow/i }));
      await waitFor(() => expect(screen.getByText('Sub-flow 2')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /^add sub-flow$/i }));
      await waitFor(() => expect(screen.getByText('3 sub-flows')).toBeInTheDocument());
    },
    20000
  );

  it(
    'edits scenario name and description locally without triggering FSM generation',
    async () => {
      const onGenerateFsm = vi.fn();
      render(
        <TestHarness
          onGenerateFsm={onGenerateFsm}
          initialValue={buildConfig([buildScenario('Alpha Scenario'), buildScenario('Beta Scenario')])}
        />
      );
      const user = userEvent.setup();

      const scenarioName = screen.getByRole('textbox', { name: /scenario name/i });
      await user.clear(scenarioName);
      await user.type(scenarioName, 'Priority Flow');

      const scenarioDescription = screen.getByRole('textbox', { name: /scenario description/i });
      await user.clear(scenarioDescription);
      await user.type(scenarioDescription, 'Updated description for architects');

      expect(await screen.findByText('Priority Flow')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Updated description for architects')).toBeInTheDocument();
      expect(onGenerateFsm).not.toHaveBeenCalled();
    },
    20000
  );

  it(
    'confirms scenario deletion before removing the active scenario',
    async () => {
      render(
        <TestHarness
          initialValue={buildConfig([
            buildScenario('Alpha Scenario'),
            buildScenario('Beta Scenario', { subFlows: [buildSubFlow('Beta Flow')] })
          ])}
        />
      );
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /^delete scenario$/i }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/alpha scenario/i)).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: /^delete scenario$/i }));

      await waitFor(() => expect(screen.queryByText('Alpha Scenario')).not.toBeInTheDocument());
      expect(screen.getByText('Beta Scenario')).toBeInTheDocument();
    },
    20000
  );

  it(
    'keeps generation explicit for scenario edits, imports, resets, and context changes',
    async () => {
      const onGenerateFsm = vi.fn();
      render(<TestHarness onGenerateFsm={onGenerateFsm} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /add scenario/i }));
      await user.click(screen.getByRole('button', { name: /^add row$/i }));
      await user.click(screen.getByRole('button', { name: /table add sub-flow/i }));
      await user.click(screen.getByRole('button', { name: /^add sub-flow$/i }));

      const nameField = screen.getByRole('textbox', { name: /scenario name/i });
      await user.clear(nameField);
      await user.type(nameField, 'Edited Scenario');

      const descriptionField = screen.getByRole('textbox', { name: /scenario description/i });
      await user.clear(descriptionField);
      await user.type(descriptionField, 'Edited description');

      await user.click(screen.getByRole('button', { name: /delete scenario/i }));
      const deleteDialog = await screen.findByRole('dialog');
      await user.click(within(deleteDialog).getByRole('button', { name: /^delete scenario$/i }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /replace current scenarios/i }));
      await user.click(screen.getByRole('button', { name: /reset defaults/i }));

      const countryInput = screen.getByRole('textbox', { name: /country code/i });
      await user.clear(countryInput);
      await user.type(countryInput, 'sg');
      await user.click(screen.getByRole('button', { name: 'INCOMING' }));

      expect(onGenerateFsm).not.toHaveBeenCalled();
    },
    20000
  );

  it(
    'opens the generate dialog and confirms generation',
    async () => {
      const onGenerateFsm = vi.fn();
      render(<TestHarness onGenerateFsm={onGenerateFsm} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /save & generate fsm/i }));

      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      expect(screen.getAllByText('18 discovered states').length).toBeGreaterThan(0);

      await user.click(screen.getByRole('button', { name: /^generate$/i }));

      await waitFor(() => expect(onGenerateFsm).toHaveBeenCalledTimes(1));
    },
    20000
  );

  it('shows preview archetype and warning counts in the generate dialog', async () => {
    render(
      <TestHarness
        generationPreview={{
          scenarioCount: 8,
          totalRows: 105,
          discoveredStateCount: 18,
          topArchetype: 'OUTGOING_SIMPLE_POSTING',
          warningCount: 2,
          conflictCount: 1
        }}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /save & generate fsm/i }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getAllByText('Archetype: OUTGOING_SIMPLE_POSTING')[0]).toBeInTheDocument();
    expect(screen.getByText('2 warnings')).toBeInTheDocument();
    expect(screen.getByText('1 conflicts')).toBeInTheDocument();
  });
});
