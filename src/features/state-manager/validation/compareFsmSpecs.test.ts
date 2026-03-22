import { describe, expect, it } from 'vitest';
import type { WorkflowSpec } from '../../../models/snapshot';
import { compareFsmSpecs } from './compareFsmSpecs';
import { formatBrOutgoingValidationReport } from './brOutgoingValidationReport';

function makeActualSpec(): WorkflowSpec {
  return {
    workflowKey: 'WF',
    startState: 'Init',
    states: [
      {
        name: 'Init',
        onEvent: {
          Go: { target: 'Review', actions: ['start'] },
          Retry: { target: 'Init', actions: ['reset'] }
        }
      },
      {
        name: 'Review',
        onEvent: {
          Finish: { target: 'Done', actions: ['persist', 'notify'] }
        }
      },
      {
        name: 'Done',
        onEvent: {}
      }
    ]
  };
}

describe('compareFsmSpecs', () => {
  it('detects missing and extra states, transitions, and action mismatches', () => {
    const actual = makeActualSpec();
    const generated: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'Init',
          onEvent: {
            Go: { target: 'Review', actions: ['start'] },
            Extra: { target: 'Sandbox', actions: ['noop'] }
          }
        },
        {
          name: 'Review',
          onEvent: {
            Finish: { target: 'Done', actions: ['notify', 'persist'] }
          }
        },
        {
          name: 'Done',
          onEvent: {}
        },
        {
          name: 'Sandbox',
          onEvent: {}
        }
      ]
    };

    expect(compareFsmSpecs(actual, generated)).toEqual({
      startStateMatches: true,
      missingStates: [],
      extraStates: ['Sandbox'],
      missingTerminalStates: [],
      extraTerminalStates: ['Sandbox'],
      missingTransitions: ['Init::Retry::Init'],
      extraTransitions: ['Init::Extra::Sandbox'],
      actionMismatches: [
        {
          source: 'Review',
          eventName: 'Finish',
          target: 'Done',
          expectedActions: ['persist', 'notify'],
          actualActions: ['notify', 'persist']
        }
      ],
      orderingIssues: [],
      summary: {
        exactStateParity: false,
        exactTerminalParity: false,
        exactTransitionParity: false,
        exactActionParity: false
      }
    });
  });

  it('flags start-state-first ordering and terminals mixed before non-terminals', () => {
    const actual = makeActualSpec();
    const generated: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'Review',
          onEvent: {
            Finish: { target: 'Done', actions: ['persist', 'notify'] }
          }
        },
        {
          name: 'Done',
          onEvent: {}
        },
        {
          name: 'Init',
          onEvent: {
            Go: { target: 'Review', actions: ['start'] },
            Retry: { target: 'Init', actions: ['reset'] }
          }
        }
      ]
    };

    const report = compareFsmSpecs(actual, generated);

    expect(report.startStateMatches).toBe(true);
    expect(report.orderingIssues).toEqual([
      'Start state "Init" is not first in spec.states.',
      'Terminal state "Done" appears before non-terminal state "Init".'
    ]);
  });

  it('formats action mismatches and ordering issues in a developer-friendly report', () => {
    const report = compareFsmSpecs(makeActualSpec(), {
      workflowKey: 'WF',
      startState: 'Review',
      states: [
        {
          name: 'Done',
          onEvent: {}
        },
        {
          name: 'Init',
          onEvent: {
            Go: { target: 'Review', actions: ['start'] }
          }
        },
        {
          name: 'Review',
          onEvent: {
            Finish: { target: 'Done', actions: ['notify', 'persist'] }
          }
        }
      ]
    });

    const formatted = formatBrOutgoingValidationReport(report);

    expect(formatted).toContain('## Start state');
    expect(formatted).toContain('- Matches expected baseline: no');
    expect(formatted).toContain('## Action mismatches');
    expect(formatted).toContain('Review::Finish::Done');
    expect(formatted).toContain('expected: [ persist, notify ]');
    expect(formatted).toContain('actual: [ notify, persist ]');
    expect(formatted).toContain('## Ordering issues');
    expect(formatted).toContain('Start state "Review" is not first in spec.states.');
  });
});

