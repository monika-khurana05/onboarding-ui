import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createAppTheme } from '../../app/theme';
import { createDefaultStateManagerConfig } from './defaultScenarios';
import { StateManagerPanel } from './StateManagerPanel';
import type { ScenarioCategory, StateManagerConfig, StatusRow } from './types';

vi.mock('./import/ImportScenariosPanel', () => ({
  ImportScenariosPanel: () => <div>Import Scenarios</div>
}));

vi.mock('./ScenarioTable', () => ({
  ScenarioTable: ({
    scenario,
    onChange
  }: {
    scenario: ScenarioCategory;
    onChange: (nextScenario: ScenarioCategory) => void;
  }) => {
    const buildRow = (): StatusRow => ({
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
                  rows: [...firstSubFlow.rows, buildRow()]
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
                  id: `subflow-${scenario.subFlows.length + 1}`,
                  title: `Sub-flow ${scenario.subFlows.length + 1}`,
                  rows: []
                }
              ]
            })
          }
        >
          Add Sub-flow
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
  it('renders country and flow context controls', () => {
    render(<TestHarness />);

    expect(screen.getByRole('textbox', { name: /country code/i })).toHaveValue('BR');
    expect(screen.getByRole('button', { name: 'OUTGOING' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'INCOMING' })).toBeInTheDocument();
  });

  it('updates country and flow from the context bar', async () => {
    render(<TestHarness />);
    const user = userEvent.setup();

    const countryInput = screen.getByRole('textbox', { name: /country code/i });
    await user.clear(countryInput);
    await user.type(countryInput, 'sg');
    expect(countryInput).toHaveValue('SG');

    await user.click(screen.getByRole('button', { name: 'INCOMING' }));
    expect(screen.getByRole('button', { name: 'INCOMING' })).toHaveAttribute('aria-pressed', 'true');
  });

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
      render(<TestHarness />);
      const user = userEvent.setup();

      await user.click(screen.getAllByRole('button', { name: /add row/i })[0]!);
      await waitFor(() => expect(screen.getByText('106 total rows')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /add sub-flow/i }));
      await waitFor(() => expect(screen.getByText('Sub-flow 3')).toBeInTheDocument());
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
