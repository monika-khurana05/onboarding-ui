import { describe, expect, it } from 'vitest';
import { createDefaultScenarios } from '../../../src/features/state-manager/defaultScenarios';

function countRows() {
  return createDefaultScenarios().reduce(
    (scenarioTotal, scenario) =>
      scenarioTotal + scenario.subFlows.reduce((rowTotal, subFlow) => rowTotal + subFlow.rows.length, 0),
    0
  );
}

describe('createDefaultScenarios', () => {
  it('returns the seeded category and row counts', () => {
    const scenarios = createDefaultScenarios();

    expect(scenarios).toHaveLength(8);
    expect(countRows()).toBe(105);
  });

  it('resets generated ids on each call', () => {
    const first = createDefaultScenarios();
    const second = createDefaultScenarios();

    expect(first[0]?.id).toBe('default-1');
    expect(second[0]?.id).toBe('default-1');
    expect(first[0]?.subFlows[0]?.id).toBe(second[0]?.subFlows[0]?.id);
    expect(first[0]?.subFlows[0]?.rows[0]?.id).toBe(second[0]?.subFlows[0]?.rows[0]?.id);
  });

  it('returns deep clones', () => {
    const first = createDefaultScenarios();
    const second = createDefaultScenarios();

    first[0]!.name = 'Changed Scenario';
    first[0]!.subFlows[0]!.title = 'Changed Sub-flow';
    first[0]!.subFlows[0]!.rows[0]!.msgStatus = 'UPDATED';

    expect(second[0]?.name).toBe('Happy Flow Non BOOK');
    expect(second[0]?.subFlows[0]?.title).toBe('Happy Flow - Current dated payment');
    expect(second[0]?.subFlows[0]?.rows[0]?.msgStatus).not.toBe('UPDATED');
  });
});
