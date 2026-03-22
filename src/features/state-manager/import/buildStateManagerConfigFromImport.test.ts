import { describe, expect, it } from 'vitest';
import { buildStateManagerConfigFromImportRows } from './buildStateManagerConfigFromImport';
import type { NormalizedImportRow } from './types';

function createRow(overrides: Partial<NormalizedImportRow>): NormalizedImportRow {
  return {
    rowNumber: 2,
    scenarioName: 'Scenario A',
    scenarioDescription: '',
    subFlowTitle: 'Sub Flow A',
    msgStatus: 'PENDING',
    msgSubStatus: 'VALIDATED',
    channelPushNotification: false,
    cdmNotification: false,
    transactionStatus: 'PDNG',
    transactionStatusReason: '',
    reasonDescription: '',
    ...overrides
  };
}

describe('buildStateManagerConfigFromImportRows', () => {
  it('groups rows into scenarios and subflows', () => {
    const result = buildStateManagerConfigFromImportRows(
      [
        createRow({ rowNumber: 2, scenarioName: 'Scenario A', subFlowTitle: 'Sub Flow A' }),
        createRow({ rowNumber: 3, scenarioName: 'Scenario A', subFlowTitle: 'Sub Flow B' }),
        createRow({ rowNumber: 4, scenarioName: 'Scenario B', subFlowTitle: 'Sub Flow C' })
      ],
      'BR',
      'OUTGOING'
    );

    expect(result.summary.scenarioCount).toBe(2);
    expect(result.summary.subFlowCount).toBe(3);
    expect(result.scenarios[0]?.name).toBe('Scenario A');
    expect(result.scenarios[0]?.subFlows.map((subFlow) => subFlow.title)).toEqual(['Sub Flow A', 'Sub Flow B']);
    expect(result.scenarios[1]?.name).toBe('Scenario B');
  });

  it('derives scenario flags from row content while preserving the editor row shape', () => {
    const result = buildStateManagerConfigFromImportRows(
      [
        createRow({ rowNumber: 2, scenario: 'Derived scenario' }),
        createRow({ rowNumber: 3, responsibleComponent: 'Ops' }),
        createRow({ rowNumber: 4, triggerReversal: true })
      ],
      'BR',
      'OUTGOING'
    );

    expect(result.scenarios[0]).toEqual(
      expect.objectContaining({
        hasScenarioColumn: true,
        hasResponsibleColumn: true,
        hasTriggerReversalColumn: true
      })
    );
    expect(result.scenarios[0]?.subFlows[0]?.rows[0]).toEqual(
      expect.objectContaining({
        scenario: 'Derived scenario',
        responsibleComponent: undefined,
        triggerReversal: false
      })
    );
    expect(result.scenarios[0]?.subFlows[0]?.rows[2]?.triggerReversal).toBe(true);
  });

  it('sorts by explicit order columns and uses the lowest conflicting order value', () => {
    const result = buildStateManagerConfigFromImportRows(
      [
        createRow({
          rowNumber: 2,
          scenarioName: 'Scenario B',
          scenarioOrder: 4,
          subFlowTitle: 'Sub Flow B',
          subFlowOrder: 3,
          rowOrder: 2
        }),
        createRow({
          rowNumber: 3,
          scenarioName: 'Scenario B',
          scenarioOrder: 2,
          subFlowTitle: 'Sub Flow B',
          subFlowOrder: 1,
          rowOrder: 1
        }),
        createRow({
          rowNumber: 4,
          scenarioName: 'Scenario A',
          scenarioOrder: 3,
          subFlowTitle: 'Sub Flow A',
          subFlowOrder: 1,
          rowOrder: 1
        })
      ],
      'BR',
      'OUTGOING'
    );

    expect(result.scenarios.map((scenario) => scenario.name)).toEqual(['Scenario B', 'Scenario A']);
    expect(result.scenarios[0]?.subFlows[0]?.title).toBe('Sub Flow B');
    expect(result.scenarios[0]?.subFlows[0]?.rows[0]?.id).toBe('import-scenario-1-subflow-1-row-1');
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'WARN',
        code: 'CONFLICTING_SCENARIO_ORDER'
      })
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'WARN',
        code: 'CONFLICTING_SUBFLOW_ORDER'
      })
    );
  });

  it('falls back to first-seen order when explicit order is absent', () => {
    const result = buildStateManagerConfigFromImportRows(
      [
        createRow({ rowNumber: 2, scenarioName: 'Scenario B' }),
        createRow({ rowNumber: 3, scenarioName: 'Scenario A' })
      ],
      'BR',
      'OUTGOING'
    );

    expect(result.scenarios.map((scenario) => scenario.name)).toEqual(['Scenario B', 'Scenario A']);
  });

  it('warns on conflicting descriptions and duplicate logical rows', () => {
    const result = buildStateManagerConfigFromImportRows(
      [
        createRow({ rowNumber: 2, scenarioDescription: 'First description' }),
        createRow({ rowNumber: 3, scenarioDescription: 'Second description' }),
        createRow({ rowNumber: 4, scenarioDescription: 'First description' })
      ],
      'BR',
      'OUTGOING'
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'WARN',
        code: 'CONFLICTING_SCENARIO_DESCRIPTIONS'
      })
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        rowNumber: 3,
        severity: 'WARN',
        code: 'DUPLICATE_LOGICAL_ROW'
      })
    );
    expect(result.scenarios[0]?.description).toBe('First description');
  });

  it('errors when no valid rows remain', () => {
    const result = buildStateManagerConfigFromImportRows([], 'BR', 'OUTGOING');

    expect(result.scenarios).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'ERROR',
        code: 'NO_VALID_ROWS'
      })
    );
    expect(result.summary.errorCount).toBeGreaterThan(0);
  });
});
