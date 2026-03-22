import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createAppTheme } from '../../../app/theme';
import { ImportScenariosPanel } from './ImportScenariosPanel';
import type { ScenarioImportParseResult } from './types';

const parserMocks = vi.hoisted(() => ({
  parseScenarioFile: vi.fn(),
  buildStateManagerConfigFromImportRows: vi.fn()
}));

vi.mock('./parseScenarioFile', () => ({
  parseScenarioFile: parserMocks.parseScenarioFile
}));

vi.mock('./buildStateManagerConfigFromImport', () => ({
  buildStateManagerConfigFromImportRows: parserMocks.buildStateManagerConfigFromImportRows
}));

describe('ImportScenariosPanel', () => {
  it('shows import summary and returns a config on confirmation', async () => {
    const parseResult: ScenarioImportParseResult = {
      fileType: 'csv',
      rawRows: [{ scenarioName: 'Imported Scenario' }],
      normalizedRows: [
        {
          rowNumber: 2,
          scenarioName: 'Imported Scenario',
          scenarioDescription: 'Imported description',
          subFlowTitle: 'Imported Flow',
          msgStatus: 'PENDING',
          msgSubStatus: 'VALIDATED',
          channelPushNotification: false,
          cdmNotification: false,
          transactionStatus: 'PDNG',
          transactionStatusReason: '',
          reasonDescription: ''
        }
      ],
      issues: []
    };

    parserMocks.parseScenarioFile.mockResolvedValue(parseResult);
    parserMocks.buildStateManagerConfigFromImportRows.mockReturnValue({
      scenarios: [
        {
          id: 'import-scenario-1',
          name: 'Imported Scenario',
          description: 'Imported description',
          hasScenarioColumn: false,
          hasResponsibleColumn: false,
          hasTriggerReversalColumn: false,
          subFlows: [
            {
              id: 'import-scenario-1-subflow-1',
              title: 'Imported Flow',
              rows: [
                {
                  id: 'import-scenario-1-subflow-1-row-1',
                  msgStatus: 'PENDING',
                  msgSubStatus: 'VALIDATED',
                  channelPushNotification: false,
                  cdmNotification: false,
                  transactionStatus: 'PDNG',
                  transactionStatusReason: '',
                  reasonDescription: ''
                }
              ]
            }
          ]
        }
      ],
      issues: [],
      summary: {
        scenarioCount: 1,
        subFlowCount: 1,
        rowCount: 1,
        warningCount: 0,
        errorCount: 0
      }
    });

    const onImportSuccess = vi.fn();
    const user = userEvent.setup();

    render(
      <ThemeProvider theme={createAppTheme('dark')}>
        <ImportScenariosPanel countryCode="BR" flowDirection="OUTGOING" onImportSuccess={onImportSuccess} />
      </ThemeProvider>
    );

    const fileInput = screen.getByLabelText(/scenario import file/i) as HTMLInputElement;
    const file = new File(['scenarioName,subFlowTitle,msgStatus,msgSubStatus'], 'scenarios.csv', {
      type: 'text/csv'
    });

    await user.upload(fileInput, file);

    await waitFor(() => expect(screen.getByText('1 scenarios')).toBeInTheDocument());
    expect(screen.getByText('Import ready. Confirm to replace the current scenarios in the editor.')).toBeInTheDocument();
    expect(screen.getByText(/nothing is persisted until save scenarios/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /replace current scenarios/i }));

    await waitFor(() => expect(onImportSuccess).toHaveBeenCalledTimes(1));
    expect(onImportSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        countryCode: 'BR',
        flowDirection: 'OUTGOING',
        scenarios: expect.arrayContaining([
          expect.objectContaining({
            name: 'Imported Scenario'
          })
        ])
      }),
      expect.objectContaining({
        summary: expect.objectContaining({
          scenarioCount: 1
        })
      })
    );
  });

  it('keeps import replace-only and blocks confirmation when errors exist', async () => {
    const parseResult: ScenarioImportParseResult = {
      fileType: 'csv',
      rawRows: [{ scenarioName: 'Broken Scenario' }],
      normalizedRows: [],
      issues: [
        {
          severity: 'ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Row 2: missing required field(s): msgSubStatus.'
        }
      ]
    };

    parserMocks.parseScenarioFile.mockResolvedValue(parseResult);
    parserMocks.buildStateManagerConfigFromImportRows.mockReturnValue({
      scenarios: [],
      issues: [
        {
          severity: 'ERROR',
          code: 'NO_VALID_ROWS',
          message: 'No valid scenario rows remain after validation.'
        }
      ],
      summary: {
        scenarioCount: 0,
        subFlowCount: 0,
        rowCount: 0,
        warningCount: 0,
        errorCount: 1
      }
    });

    const onImportSuccess = vi.fn();
    const user = userEvent.setup();

    render(
      <ThemeProvider theme={createAppTheme('dark')}>
        <ImportScenariosPanel countryCode="BR" flowDirection="OUTGOING" onImportSuccess={onImportSuccess} />
      </ThemeProvider>
    );

    const fileInput = screen.getByLabelText(/scenario import file/i) as HTMLInputElement;
    const file = new File(['broken'], 'broken.csv', { type: 'text/csv' });

    await user.upload(fileInput, file);

    await waitFor(() => expect(screen.getByText(/resolve the import errors before replacing/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /replace current scenarios/i })).toBeDisabled();
    expect(onImportSuccess).not.toHaveBeenCalled();
  });
});
