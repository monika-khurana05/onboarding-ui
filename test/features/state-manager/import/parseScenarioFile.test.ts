import { utils, write } from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseScenarioFile } from '../../../../src/features/state-manager/import/parseScenarioFile';

describe('parseScenarioFile', () => {
  it('parses CSV with canonical headers', async () => {
    const file = new File(
      [
        'scenarioName,subFlowTitle,msgStatus,msgSubStatus,transactionStatus,transactionStatusReason\n' +
          'Happy Flow,Current Flow,received,validated,pdng,Accepted'
      ],
      'scenarios.csv',
      { type: 'text/csv' }
    );

    const result = await parseScenarioFile(file);

    expect(result.fileType).toBe('csv');
    expect(result.normalizedRows).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        scenarioName: 'Happy Flow',
        subFlowTitle: 'Current Flow',
        msgStatus: 'RECEIVED',
        msgSubStatus: 'VALIDATED',
        transactionStatus: 'PDNG',
        transactionStatusReason: 'Accepted'
      })
    ]);
    expect(result.issues).toEqual([]);
  });

  it('parses alias headers and warns when multiple columns map to the same field', async () => {
    const file = new File(
      [
        'Scenario Name,scenario_name,sub_flow_title,msg status,msg sub status,txn status,reason desc,ignored column\n' +
          'Scenario A,Scenario A Duplicate,Sub Flow A,pending,posting_complete,accc,Done,skip me'
      ],
      'aliases.csv',
      { type: 'text/csv' }
    );

    const result = await parseScenarioFile(file);

    expect(result.normalizedRows).toEqual([
      expect.objectContaining({
        scenarioName: 'Scenario A',
        subFlowTitle: 'Sub Flow A',
        msgStatus: 'PENDING',
        msgSubStatus: 'POSTING_COMPLETE',
        transactionStatus: 'ACCC',
        reasonDescription: 'Done'
      })
    ]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'WARN',
        code: 'DUPLICATE_MAPPED_COLUMNS'
      })
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'WARN',
        code: 'IGNORED_COLUMNS'
      })
    );
  });

  it('handles exact duplicate headers without losing the first non-empty value', async () => {
    const file = new File(
      [
        'scenarioName,scenarioName,subFlowTitle,msgStatus,msgSubStatus\n' +
          ',Scenario From Duplicate Header,Sub Flow A,PENDING,VALIDATED\n' +
          'Scenario From First Header,,Sub Flow B,COMPLETE,POSTING_COMPLETE'
      ],
      'duplicate-headers.csv',
      { type: 'text/csv' }
    );

    const result = await parseScenarioFile(file);

    expect(result.normalizedRows[0]).toEqual(
      expect.objectContaining({
        scenarioName: 'Scenario From Duplicate Header',
        subFlowTitle: 'Sub Flow A'
      })
    );
    expect(result.normalizedRows[1]).toEqual(
      expect.objectContaining({
        scenarioName: 'Scenario From First Header',
        subFlowTitle: 'Sub Flow B'
      })
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'WARN',
        code: 'DUPLICATE_MAPPED_COLUMNS'
      })
    );
  });

  it('parses boolean variants correctly and warns on invalid values', async () => {
    const file = new File(
      [
        'scenarioName,subFlowTitle,msgStatus,msgSubStatus,channel push,cdm,trigger reversal\n' +
          'Scenario A,Sub Flow A,PENDING,VALIDATED,yes,0,checked\n' +
          'Scenario B,Sub Flow B,PENDING,VALIDATED,no,1,maybe'
      ],
      'booleans.csv',
      { type: 'text/csv' }
    );

    const result = await parseScenarioFile(file);

    expect(result.normalizedRows[0]).toEqual(
      expect.objectContaining({
        channelPushNotification: true,
        cdmNotification: false,
        triggerReversal: true
      })
    );
    expect(result.normalizedRows[1]).toEqual(
      expect.objectContaining({
        channelPushNotification: false,
        cdmNotification: true,
        triggerReversal: false
      })
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        rowNumber: 3,
        severity: 'WARN',
        code: 'INVALID_BOOLEAN'
      })
    );
  });

  it('prefers the Scenarios worksheet when parsing XLSX', async () => {
    const workbook = utils.book_new();
    const firstSheet = utils.aoa_to_sheet([
      ['scenarioName', 'subFlowTitle', 'msgStatus', 'msgSubStatus'],
      ['Wrong Sheet', 'Wrong Flow', 'PENDING', 'VALIDATED']
    ]);
    const scenariosSheet = utils.aoa_to_sheet([
      ['scenarioName', 'subFlowTitle', 'msgStatus', 'msgSubStatus'],
      ['Right Sheet', 'Right Flow', 'COMPLETE', 'POSTING_COMPLETE']
    ]);

    utils.book_append_sheet(workbook, firstSheet, 'Sheet1');
    utils.book_append_sheet(workbook, scenariosSheet, 'Scenarios');

    const file = new File([write(workbook, { type: 'array', bookType: 'xlsx' })], 'scenarios.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const result = await parseScenarioFile(file);

    expect(result.fileType).toBe('xlsx');
    expect(result.normalizedRows).toEqual([
      expect.objectContaining({
        scenarioName: 'Right Sheet',
        subFlowTitle: 'Right Flow',
        msgStatus: 'COMPLETE',
        msgSubStatus: 'POSTING_COMPLETE'
      })
    ]);
    expect(result.issues).not.toContainEqual(
      expect.objectContaining({
        code: 'MULTIPLE_WORKSHEETS'
      })
    );
  });

  it('reports missing required fields', async () => {
    const file = new File(
      ['scenarioName,subFlowTitle,msgStatus,msgSubStatus\nScenario A,Sub Flow A,PENDING,'],
      'missing-fields.csv',
      { type: 'text/csv' }
    );

    const result = await parseScenarioFile(file);

    expect(result.normalizedRows).toHaveLength(0);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        rowNumber: 2,
        severity: 'ERROR',
        code: 'MISSING_REQUIRED_FIELDS'
      })
    );
  });

  it('reports unsupported file type', async () => {
    const file = new File(['unsupported'], 'scenarios.txt', { type: 'text/plain' });

    await expect(parseScenarioFile(file)).rejects.toThrow('Only .csv, .xlsx, and .xls files are supported.');
  });
});
