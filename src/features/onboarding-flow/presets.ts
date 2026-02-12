import type { StateSpec, TransitionSpec, WorkflowSpec } from '../../models/snapshot';

export type WorkflowPreset = {
  id: string;
  label: string;
  description: string;
  startState?: string;
  states: StateSpec[];
};

const baseFailureRecoverable = 'EnrichmentFailureRecoverable';
const baseFailureNotRecoverable = 'EnrichmentFailureNotRecoverable';
const retryEventName = 'OnRetry';

function normalizeName(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeActions(actions: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  actions.forEach((action) => {
    const next = action.trim();
    if (!next || seen.has(next)) {
      return;
    }
    seen.add(next);
    result.push(next);
  });
  return result;
}

function buildTransition(target: string, actions: string[]): TransitionSpec {
  return {
    target,
    actions: normalizeActions(actions)
  };
}

function buildState(name: string, transitions: Record<string, TransitionSpec>): StateSpec {
  return {
    name,
    onEvent: transitions
  };
}

const complexPresetStates: StateSpec[] = [
  buildState('INIT', {
    INITSuccessful: buildTransition('BANKCODE_ENRICHMENT', ['persist-txn']),
    [baseFailureRecoverable]: buildTransition('INIT', ['notify-bd-intermediate']),
    [baseFailureNotRecoverable]: buildTransition('FAILED', ['notify-bd-error']),
    [retryEventName]: buildTransition('INIT', ['reset-mtp'])
  }),
  buildState('BANKCODE_ENRICHMENT', {
    BANKCODE_ENRICHMENTSuccessful: buildTransition('PSP_ENRICHMENT', ['initiate-psp-enrichment']),
    [baseFailureRecoverable]: buildTransition('BANKCODE_ENRICHMENT', ['notify-bd-intermediate']),
    [baseFailureNotRecoverable]: buildTransition('FAILED', ['notify-bd-error']),
    [retryEventName]: buildTransition('BANKCODE_ENRICHMENT', ['reset-mtp'])
  }),
  buildState('PSP_ENRICHMENT', {
    PSP_ENRICHMENTSuccessful: buildTransition('SPN_CHECK', ['send-sanctions-request']),
    [baseFailureRecoverable]: buildTransition('PSP_ENRICHMENT', ['notify-bd-intermediate']),
    [baseFailureNotRecoverable]: buildTransition('FAILED', ['notify-bd-error']),
    [retryEventName]: buildTransition('PSP_ENRICHMENT', ['reset-mtp'])
  }),
  buildState('SPN_CHECK', {
    SPN_CHECKSuccessful: buildTransition('SPN_SENT', ['send-sanctions-request']),
    [baseFailureRecoverable]: buildTransition('SPN_CHECK', ['notify-bd-intermediate']),
    [baseFailureNotRecoverable]: buildTransition('FAILED', ['notify-bd-error']),
    [retryEventName]: buildTransition('SPN_CHECK', ['reset-mtp'])
  }),
  buildState('SPN_SENT', {
    SPN_SENTSuccessful: buildTransition('CLEARED', ['persist-txn']),
    [baseFailureRecoverable]: buildTransition('SPN_SENT', ['notify-bd-intermediate']),
    [baseFailureNotRecoverable]: buildTransition('FAILED', ['notify-bd-error']),
    [retryEventName]: buildTransition('SPN_SENT', ['reset-mtp'])
  }),
  buildState('CLEARED', {}),
  buildState('FAILED', {})
];

const simplePresetStates: StateSpec[] = [
  buildState('RECEIVED', {
    VALIDATE: buildTransition('VALIDATED', [])
  }),
  buildState('VALIDATED', {
    CLEAR: buildTransition('CLEARED', [])
  }),
  buildState('CLEARED', {})
];

export const workflowPresets: WorkflowPreset[] = [
  {
    id: 'bankcode-psp-sanctions',
    label: 'BankCode Enrichment + PSP Enrichment + Sanctions',
    description:
      'Adds a staged enrichment + sanctions flow with success, failure, and retry patterns.',
    startState: 'INIT',
    states: complexPresetStates
  },
  {
    id: 'simple-received-validated-cleared',
    label: 'Simple Received -> Validated -> Cleared',
    description: 'Minimal 3-state lifecycle matching the default page.',
    startState: 'RECEIVED',
    states: simplePresetStates
  }
];

function mergeActions(existing: string[], incoming: string[]): string[] {
  const normalizedExisting = normalizeActions(existing);
  const normalizedIncoming = normalizeActions(incoming);
  const seen = new Set(normalizedExisting);
  const next = [...normalizedExisting];
  normalizedIncoming.forEach((action) => {
    if (seen.has(action)) {
      return;
    }
    seen.add(action);
    next.push(action);
  });
  return next;
}

export function applyPreset(spec: WorkflowSpec, preset: WorkflowPreset): WorkflowSpec {
  const nextStates = [...spec.states];
  const stateIndexByNormalized = new Map<string, number>();
  nextStates.forEach((state, index) => {
    stateIndexByNormalized.set(normalizeName(state.name), index);
  });

  preset.states.forEach((presetState) => {
    const normalizedName = normalizeName(presetState.name);
    const existingIndex = stateIndexByNormalized.get(normalizedName);
    if (existingIndex === undefined) {
      nextStates.push({
        name: presetState.name,
        onEvent: { ...presetState.onEvent }
      });
      stateIndexByNormalized.set(normalizedName, nextStates.length - 1);
      return;
    }

    const existingState = nextStates[existingIndex];
    const existingEntries = Object.entries(existingState.onEvent ?? {});
    const eventKeyMap = new Map(
      existingEntries.map(([eventName]) => [normalizeName(eventName), eventName])
    );

    const mergedEntries = new Map(existingEntries);
    Object.entries(presetState.onEvent ?? {}).forEach(([eventName, transition]) => {
      const normalizedEvent = normalizeName(eventName);
      const existingEventKey = eventKeyMap.get(normalizedEvent);
      if (existingEventKey) {
        const currentTransition = mergedEntries.get(existingEventKey) as TransitionSpec | undefined;
        const currentTarget = currentTransition?.target ?? '';
        const nextTarget = currentTarget.trim() ? currentTarget : transition.target;
        mergedEntries.set(existingEventKey, {
          target: nextTarget,
          actions: mergeActions(currentTransition?.actions ?? [], transition.actions ?? [])
        });
        return;
      }
      mergedEntries.set(eventName, {
        target: transition.target,
        actions: normalizeActions(transition.actions ?? [])
      });
    });

    nextStates[existingIndex] = {
      ...existingState,
      onEvent: Object.fromEntries(mergedEntries)
    };
  });

  const mergedStateNames = nextStates.map((state) => state.name);
  const currentStart = spec.startState?.trim();
  let nextStart = currentStart && mergedStateNames.includes(currentStart) ? currentStart : '';
  if (!nextStart && preset.startState && mergedStateNames.includes(preset.startState)) {
    nextStart = preset.startState;
  }
  if (!nextStart && mergedStateNames.length > 0) {
    nextStart = mergedStateNames[0];
  }

  return {
    ...spec,
    startState: nextStart,
    states: nextStates
  };
}
