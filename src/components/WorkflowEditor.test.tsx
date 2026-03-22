import { describe, expect, it } from 'vitest';
import type { WorkflowSpec } from '../models/snapshot';
import { generateFsmYaml } from './WorkflowEditor';
import { parseFsmYamlToSpec } from '../features/workflow/presets/parseFsmYamlToSpec';

describe('generateFsmYaml', () => {
  it('emits Init first, keeps non-terminals before terminals, and preserves alphabetical event ordering', () => {
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      statesClass: 'custom.State',
      eventsClass: 'custom.Event',
      startState: 'Init',
      states: [
        {
          name: 'BalanceCheckPending',
          onEvent: {
            NotifyB2BToPosting: { target: 'NormalPostingPending', actions: ['notify-posting'] }
          }
        },
        {
          name: 'FinalPostingComplete',
          onEvent: {}
        },
        {
          name: 'NormalPostingPending',
          onEvent: {
            PostingQueued: { target: 'SendClearingPostingPending', actions: ['queue-posting'] }
          }
        },
        {
          name: 'SendClearingPostingPending',
          onEvent: {
            PostingSuccess: { target: 'FinalPostingComplete', actions: ['complete-posting'] }
          }
        },
        {
          name: 'Init',
          onEvent: {
            ZetaEvent: { target: 'BalanceCheckPending', actions: ['z-action'] },
            AlphaEvent: { target: 'BalanceCheckPending', actions: ['a-action'] }
          }
        },
        {
          name: 'TxnRejectedOnNSF',
          onEvent: {}
        }
      ]
    };

    const yaml = generateFsmYaml(spec);
    const stateLines = yaml.split('\n').filter((line) => /^ {2}[^ ].*:$/.test(line));

    expect(stateLines).toEqual([
      '  Init:',
      '  BalanceCheckPending:',
      '  NormalPostingPending:',
      '  SendClearingPostingPending:',
      '  FinalPostingComplete:',
      '  TxnRejectedOnNSF:'
    ]);
    expect(yaml.split('\n')[3]).toBe('  Init:');
    expect(yaml.indexOf('      AlphaEvent:')).toBeLessThan(yaml.indexOf('      ZetaEvent:'));

    const parsed = parseFsmYamlToSpec(yaml);
    expect(parsed.startState).toBe('Init');
    expect(parsed.states[0]?.name).toBe('Init');
  });

  it('respects spec.startState when the selected start state is not Init', () => {
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'PaymentReceived',
      states: [
        {
          name: 'BalanceCheckPending',
          onEvent: {
            NotifyPosting: { target: 'Completed', actions: ['notify-posting'] }
          }
        },
        {
          name: 'Completed',
          onEvent: {}
        },
        {
          name: 'PaymentReceived',
          onEvent: {
            ValidationPassed: { target: 'BalanceCheckPending', actions: ['persist-payment'] }
          }
        }
      ]
    };

    const yaml = generateFsmYaml(spec);
    const stateLines = yaml.split('\n').filter((line) => /^ {2}[^ ].*:$/.test(line));

    expect(stateLines).toEqual(['  PaymentReceived:', '  BalanceCheckPending:', '  Completed:']);

    const parsed = parseFsmYamlToSpec(yaml);
    expect(parsed.startState).toBe('PaymentReceived');
    expect(parsed.states[0]?.name).toBe('PaymentReceived');
  });

  it('fails fast when the configured start state does not exist', () => {
    const spec: WorkflowSpec = {
      workflowKey: 'WF',
      startState: 'Init',
      states: [
        {
          name: 'BalanceCheckPending',
          onEvent: {}
        }
      ]
    };

    expect(() => generateFsmYaml(spec)).toThrow(/Init/);
  });
});

