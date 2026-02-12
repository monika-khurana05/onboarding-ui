import { load } from 'js-yaml';
import type { StateSpec, TransitionSpec, WorkflowSpec } from '../../../models/snapshot';

type RawTransition = {
  target?: unknown;
  actions?: unknown;
};

type RawState = {
  on_event?: unknown;
};

type RawFsmYaml = {
  statesClass?: unknown;
  eventsClass?: unknown;
  states?: unknown;
};

const normalizeActions = (actions: unknown): string[] => {
  if (!Array.isArray(actions)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  actions.forEach((action) => {
    const next = String(action).trim();
    if (!next || seen.has(next)) {
      return;
    }
    seen.add(next);
    result.push(next);
  });
  return result;
};

const normalizeTransition = (raw: RawTransition): TransitionSpec => {
  const target = typeof raw.target === 'string' ? raw.target : '';
  return {
    target,
    actions: normalizeActions(raw.actions)
  };
};

const normalizeOnEvent = (raw: RawState['on_event']): Record<string, TransitionSpec> => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  return Object.entries(raw as Record<string, unknown>).reduce<Record<string, TransitionSpec>>((acc, [eventName, transition]) => {
    if (!transition || typeof transition !== 'object') {
      return acc;
    }
    acc[eventName] = normalizeTransition(transition as RawTransition);
    return acc;
  }, {});
};

export function parseFsmYamlToSpec(yamlText: string): WorkflowSpec {
  const parsed = load(yamlText) as RawFsmYaml | undefined;
  const statesRaw = parsed?.states;
  const states: StateSpec[] = [];

  if (statesRaw && typeof statesRaw === 'object') {
    Object.entries(statesRaw as Record<string, unknown>).forEach(([stateName, stateValue]) => {
      if (!stateValue || typeof stateValue !== 'object') {
        states.push({ name: stateName, onEvent: {} });
        return;
      }
      const rawState = stateValue as RawState;
      states.push({
        name: stateName,
        onEvent: normalizeOnEvent(rawState.on_event)
      });
    });
  }

  const resolvedStatesClass = typeof parsed?.statesClass === 'string' ? parsed.statesClass : undefined;
  const resolvedEventsClass = typeof parsed?.eventsClass === 'string' ? parsed.eventsClass : undefined;
  const startState = states[0]?.name ?? '';

  return {
    workflowKey: '',
    statesClass: resolvedStatesClass,
    eventsClass: resolvedEventsClass,
    startState,
    states
  };
}
