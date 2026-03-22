import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { createAppTheme } from '../../app/theme';
import { ScenarioTable } from './ScenarioTable';
import type { ScenarioCategory, StatusRow, SubFlow } from './types';

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

function buildEmptyRow(id: string): StatusRow {
  return {
    id,
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

function buildSubFlow(id: string, title: string, rows: StatusRow[]): SubFlow {
  return {
    id,
    title,
    rows
  };
}

function buildScenario(subFlows: SubFlow[]): ScenarioCategory {
  return {
    id: 'scenario-1',
    name: 'Happy Path',
    description: 'Scenario description',
    hasScenarioColumn: false,
    hasResponsibleColumn: false,
    hasTriggerReversalColumn: false,
    subFlows
  };
}

function TestHarness({ initialScenario }: { initialScenario: ScenarioCategory }) {
  const [scenario, setScenario] = useState(initialScenario);

  return (
    <ThemeProvider theme={createAppTheme('dark')}>
      <ScenarioTable scenario={scenario} onChange={setScenario} />
      <div>Sub-flow count: {scenario.subFlows.length}</div>
      <div>First sub-flow rows: {scenario.subFlows[0]?.rows.length ?? 0}</div>
      <div>First row status: {scenario.subFlows[0]?.rows[0]?.msgStatus ?? 'none'}</div>
    </ThemeProvider>
  );
}

describe('ScenarioTable', () => {
  it(
    'allows inline editing of an existing row',
    async () => {
      render(
        <TestHarness
          initialScenario={buildScenario([buildSubFlow('subflow-1', 'Current Flow', [buildRow('row-1')])])}
        />
      );

      const statusInput = screen.getByLabelText(/row 1 message status/i);
      fireEvent.change(statusInput, { target: { value: 'SENT' } });

      await waitFor(() => expect(screen.getByDisplayValue('SENT')).toBeInTheDocument());
      expect(screen.getByText('First row status: SENT')).toBeInTheDocument();
    },
    20000
  );

  it(
    'adds a new editable row to the active sub-flow',
    async () => {
      render(
        <TestHarness
          initialScenario={buildScenario([buildSubFlow('subflow-1', 'Current Flow', [buildRow('row-1')])])}
        />
      );
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /^add row$/i }));

      expect(await screen.findByText('First sub-flow rows: 2')).toBeInTheDocument();
      const newRowStatus = screen.getByLabelText(/row 2 message status/i);
      fireEvent.change(newRowStatus, { target: { value: 'REJECTED' } });

      await waitFor(() => expect(screen.getByDisplayValue('REJECTED')).toBeInTheDocument());
    },
    20000
  );

  it('deletes an empty row immediately', async () => {
    render(
      <TestHarness
        initialScenario={buildScenario([
          buildSubFlow('subflow-1', 'Current Flow', [buildRow('row-1'), buildEmptyRow('row-2')])
        ])}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /delete row 2/i }));

    await waitFor(() => expect(screen.getByText('First sub-flow rows: 1')).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('requires confirmation before deleting a non-empty row', async () => {
    render(
      <TestHarness
        initialScenario={buildScenario([buildSubFlow('subflow-1', 'Current Flow', [buildRow('row-1')])])}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /delete row 1/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/delete this row/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/this action cannot be undone/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(screen.getByText('First sub-flow rows: 0')).toBeInTheDocument());
    expect(screen.getByText(/no rows yet/i)).toBeInTheDocument();
  });

  it('adds a new expanded sub-flow with an editable title', async () => {
    render(
      <TestHarness
        initialScenario={buildScenario([buildSubFlow('subflow-1', 'Current Flow', [buildRow('row-1')])])}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^add sub-flow$/i }));

    expect(await screen.findByText('Sub-flow count: 2')).toBeInTheDocument();
    expect(screen.getByLabelText(/sub-flow 2 title/i)).toHaveValue('New Sub-flow 2');
    expect(screen.getAllByLabelText(/row 1 message status/i).length).toBeGreaterThan(1);
  });

  it('adds the first sub-flow from the empty state', async () => {
    render(<TestHarness initialScenario={buildScenario([])} />);
    const user = userEvent.setup();

    expect(screen.getByText(/no sub-flows yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^add sub-flow$/i }));

    expect(await screen.findByText('Sub-flow count: 1')).toBeInTheDocument();
    expect(screen.getByLabelText(/sub-flow 1 title/i)).toHaveValue('New Sub-flow 1');
    expect(screen.getByLabelText(/row 1 message status/i)).toBeInTheDocument();
  });

  it('requires confirmation before deleting a titled but otherwise empty sub-flow', async () => {
    render(
      <TestHarness
        initialScenario={buildScenario([
          buildSubFlow('subflow-1', 'Current Flow', [buildRow('row-1')]),
          buildSubFlow('subflow-2', 'Review Flow', [])
        ])}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /delete review flow/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/delete this sub-flow/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/contains draft details/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(screen.getByText('Sub-flow count: 1')).toBeInTheDocument());
    expect(screen.queryByDisplayValue('Review Flow')).not.toBeInTheDocument();
  });
  it('confirms before deleting a non-empty sub-flow', async () => {
    render(
      <TestHarness
        initialScenario={buildScenario([
          buildSubFlow('subflow-1', 'Current Flow', [buildRow('row-1')]),
          buildSubFlow('subflow-2', 'Review Flow', [buildRow('row-2', { msgStatus: 'SENT' })])
        ])}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /delete review flow/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/delete this sub-flow/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(screen.getByText('Sub-flow count: 1')).toBeInTheDocument());
    expect(screen.queryByDisplayValue('Review Flow')).not.toBeInTheDocument();
  });
});

