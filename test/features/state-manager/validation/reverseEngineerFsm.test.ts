import { describe, expect, it } from 'vitest';
import type { WorkflowSpec } from '../../../../src/models/snapshot';
import { reverseEngineerFsm } from '../../../../src/features/state-manager/validation/reverseEngineerFsm';

describe('reverseEngineerFsm', () => {
  it('normalizes state names, terminals, and transitions deterministically', () => {
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      startState: ' Init ',
      states: [
        {
          name: ' Done ',
          onEvent: {}
        },
        {
          name: 'B',
          onEvent: {
            Zeta: { target: ' Done ', actions: ['persist', 'notify'] },
            Alpha: { target: 'B', actions: [' retry ', 'persist '] }
          }
        },
        {
          name: 'Init',
          onEvent: {
            Start: { target: 'B', actions: ['first', 'second'] }
          }
        }
      ]
    };

    expect(reverseEngineerFsm(spec)).toEqual({
      startState: 'Init',
      stateNames: ['B', 'Done', 'Init'],
      terminalStates: ['Done'],
      transitions: [
        { source: 'B', eventName: 'Alpha', target: 'B', actions: ['retry', 'persist'] },
        { source: 'B', eventName: 'Zeta', target: 'Done', actions: ['persist', 'notify'] },
        { source: 'Init', eventName: 'Start', target: 'B', actions: ['first', 'second'] }
      ]
    });
  });

  it('classifies empty-event states as terminal states', () => {
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'Init',
          onEvent: {
            Continue: { target: 'Review', actions: [] }
          }
        },
        {
          name: 'Review',
          onEvent: {
            Finish: { target: 'Done', actions: ['persist'] }
          }
        },
        {
          name: 'Cancelled',
          onEvent: {}
        },
        {
          name: 'Done',
          onEvent: {}
        }
      ]
    };

    expect(reverseEngineerFsm(spec).terminalStates).toEqual(['Cancelled', 'Done']);
  });
});

