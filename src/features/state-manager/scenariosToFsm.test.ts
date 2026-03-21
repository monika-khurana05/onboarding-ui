import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listAllTransitions } from '../../models/snapshot';
import { parseFsmYamlToSpec } from '../workflow/presets/parseFsmYamlToSpec';
import { createDefaultScenarios } from './defaultScenarios';
import { previewConversion, scenariosToWorkflowSpec } from './scenariosToFsm';

const brPresetYaml = readFileSync(resolve(process.cwd(), 'public/fsm-presets/br-outgoing-fsm.yaml'), 'utf8');
const brPresetSpec = parseFsmYamlToSpec(brPresetYaml);

describe('scenariosToWorkflowSpec', () => {
  it('converts seeded defaults deterministically', () => {
    const scenarios = createDefaultScenarios();
    const resultA = scenariosToWorkflowSpec(scenarios, undefined, [], 'AR_OUTGOING_PAYMENT', 'AR', 'OUTGOING');
    const resultB = scenariosToWorkflowSpec(
      createDefaultScenarios(),
      undefined,
      [],
      'AR_OUTGOING_PAYMENT',
      'AR',
      'OUTGOING'
    );

    expect(previewConversion(scenarios)).toEqual({
      scenarioCount: 8,
      totalRows: 105,
      discoveredStateCount: 19
    });
    expect(resultA.spec).toEqual(resultB.spec);
    expect([...resultA.newTransitions]).toEqual([...resultB.newTransitions]);
    expect(resultA.spec.workflowKey).toBe('AR_OUTGOING_PAYMENT');
    expect(resultA.spec.startState).toBe('Init');
  });

  it('adds expansion transitions and stable highlight keys', () => {
    const { spec, newTransitions } = scenariosToWorkflowSpec(
      createDefaultScenarios(),
      undefined,
      [],
      'BR_OUTGOING_PAYMENT',
      'BR',
      'OUTGOING'
    );
    const stateByName = new Map(spec.states.map((state) => [state.name, state]));

    expect(stateByName.get('Init')?.onEvent.DupCheckCompleted?.target).toBe('Init');
    expect(stateByName.get('Init')?.onEvent.DupCheckPassed?.target).toBe('SpmCheck');
    expect(stateByName.get('SpmCheck')?.onEvent.SpmEnabled?.target).toBe('SpmSent');
    expect(newTransitions.has('Init::DupCheckPassed')).toBe(true);
    expect(newTransitions.has('SpmCheck::SpmEnabled')).toBe(true);
  });

  it('preserves preset metadata and avoids duplicate transitions when merging', () => {
    const { spec, newTransitions } = scenariosToWorkflowSpec(
      createDefaultScenarios(),
      brPresetSpec,
      [brPresetSpec],
      'BR_OUTGOING_PAYMENT',
      'BR',
      'OUTGOING'
    );
    const transitions = listAllTransitions(spec);
    const uniqueKeys = new Set(transitions.map((row) => `${row.from}::${row.eventName}`));

    expect(spec.statesClass).toBe('com.citi.cpx.statemanager.br.outgoing.State');
    expect(spec.eventsClass).toBe('com.citi.cpx.statemanager.br.outgoing.Event');
    expect(spec.startState).toBe('PaymentReceived');
    expect(spec.states.some((state) => state.name === 'PaymentReceived')).toBe(true);
    expect(spec.states.some((state) => state.name === 'Init')).toBe(true);
    expect(uniqueKeys.size).toBe(transitions.length);
    expect(newTransitions.has('Init::DupCheckPassed')).toBe(true);
  });
});
