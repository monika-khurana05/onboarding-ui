export const capabilityKeys = [
  'PAYMENT_INITIATION',
  'PAYMENT_ORCHESTRATION',
  'CLIENT_ONBOARDING',
  'SANCTIONS',
  'LIQUIDITY',
  'DATA',
  'REFERENCE_DATA',
  'POSTING',
  'CLEARING',
  'PLATFORM_RESILIENCY',
  'DEVOPS_MAINTENANCE',
  'DATABASE_UTILITIES',
  'SRE_OBSERVABILITY'
] as const;

export type CapabilityKey = (typeof capabilityKeys)[number];

export type SnapshotCapability = {
  capabilityKey: CapabilityKey;
  enabled: boolean;
  params?: Record<string, any>;
};

export type SnapshotRule = {
  key: string;
  enabled: boolean;
  severity?: string;
  params?: Record<string, any>;
};

export type SelectedCapability = {
  id: string;
  enabled: boolean;
  params: Record<string, unknown>;
};

export type RulesConfigMetadata = {
  schemaVersion: string;
  producer: {
    system: string;
    artifact: string;
    version: string;
  };
};

export type RulesConfig = {
  metadata?: RulesConfigMetadata;
  validations: SelectedCapability[];
  enrichments: SelectedCapability[];
};

export type SnapshotAction = {
  key: string;
  enabled: boolean;
  params?: Record<string, any>;
};

export type WorkflowSpec = {
  workflowKey: string;
  statesClass?: string;
  eventsClass?: string;
  startState?: string;
  states: StateSpec[];
};

export type StateSpec = {
  name: string;
  onEvent: Record<string, TransitionSpec>;
};

export type TransitionSpec = {
  target: string;
  actions: string[];
};

export type WorkflowLintTab = 'transitions' | 'state';

export type WorkflowLintLevel = 'error' | 'warning';

export type WorkflowLintIssue = {
  id: string;
  level: WorkflowLintLevel;
  tab: WorkflowLintTab;
  message: string;
  stateName?: string;
  eventName?: string;
  field?: 'event' | 'target' | 'actions' | 'state';
};

export type WorkflowLintResult = {
  errors: WorkflowLintIssue[];
  warnings: WorkflowLintIssue[];
  issues: WorkflowLintIssue[];
};

export type WorkflowTransitionRow = {
  from: string;
  eventName: string;
  target: string;
  actions: string[];
};

export type SnapshotModel = {
  countryCode: string;
  region?: string;
  capabilities: SnapshotCapability[];
  validations: SnapshotRule[];
  enrichments: SnapshotRule[];
  rulesConfig?: RulesConfig;
  actions: SnapshotAction[];
  workflow: WorkflowSpec;
  integrationConfig?: Record<string, any>;
  deploymentOverrides?: Record<string, any>;
};

export type SnapshotValidationError = {
  path: string;
  message: string;
};

function normalizeActionList(actions: unknown): string[] {
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
}

function normalizeTransitionTarget(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

type LegacyTransition = {
  from?: unknown;
  to?: unknown;
  onEvent?: unknown;
  eventName?: unknown;
  target?: unknown;
  targetState?: unknown;
  actions?: unknown;
};

function normalizeLegacyTransitionRows(transitions: unknown): WorkflowTransitionRow[] {
  if (!Array.isArray(transitions)) {
    return [];
  }
  const rows: WorkflowTransitionRow[] = [];
  transitions.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const candidate = item as LegacyTransition & { onEvent?: unknown };
    if (Array.isArray(candidate.onEvent)) {
      const from = typeof candidate.from === 'string' ? candidate.from : '';
      candidate.onEvent.forEach((event) => {
        if (!event || typeof event !== 'object') {
          return;
        }
        const ev = event as LegacyTransition;
        const eventName =
          typeof ev.eventName === 'string'
            ? ev.eventName
            : typeof ev.onEvent === 'string'
              ? ev.onEvent
              : '';
        const target = normalizeTransitionTarget(ev.target ?? ev.targetState ?? ev.to);
        rows.push({
          from,
          eventName,
          target,
          actions: normalizeActionList(ev.actions)
        });
      });
      return;
    }

    const from = typeof candidate.from === 'string' ? candidate.from : '';
    const eventName =
      typeof candidate.eventName === 'string'
        ? candidate.eventName
        : typeof candidate.onEvent === 'string'
          ? candidate.onEvent
          : '';
    const target = normalizeTransitionTarget(candidate.target ?? candidate.targetState ?? candidate.to);
    rows.push({
      from,
      eventName,
      target,
      actions: normalizeActionList(candidate.actions)
    });
  });
  return rows;
}

export function listAllTransitions(spec: WorkflowSpec): WorkflowTransitionRow[] {
  const rows: WorkflowTransitionRow[] = [];
  spec.states.forEach((state) => {
    Object.entries(state.onEvent ?? {}).forEach(([eventName, transition]) => {
      rows.push({
        from: state.name,
        eventName,
        target: transition?.target ?? '',
        actions: normalizeActionList(transition?.actions)
      });
    });
  });
  return rows;
}

export function upsertTransition(
  spec: WorkflowSpec,
  fromState: string,
  eventName: string,
  transition: TransitionSpec
): WorkflowSpec {
  const stateIndex = spec.states.findIndex((state) => state.name === fromState);
  if (stateIndex === -1) {
    return spec;
  }

  const currentState = spec.states[stateIndex];
  const entries = Object.entries(currentState.onEvent ?? {});
  const normalized = {
    target: transition.target,
    actions: normalizeActionList(transition.actions)
  };
  let replaced = false;
  const nextEntries = entries.map(([key, value]) => {
    if (key === eventName) {
      replaced = true;
      return [key, normalized] as const;
    }
    return [key, value] as const;
  });
  if (!replaced) {
    nextEntries.push([eventName, normalized]);
  }
  const nextState: StateSpec = {
    ...currentState,
    onEvent: Object.fromEntries(nextEntries)
  };
  const nextStates = spec.states.map((state, index) => (index === stateIndex ? nextState : state));
  return { ...spec, states: nextStates };
}

export function deleteTransition(spec: WorkflowSpec, fromState: string, eventName: string): WorkflowSpec {
  const stateIndex = spec.states.findIndex((state) => state.name === fromState);
  if (stateIndex === -1) {
    return spec;
  }
  const currentState = spec.states[stateIndex];
  const nextEntries = Object.entries(currentState.onEvent ?? {}).filter(([key]) => key !== eventName);
  const nextState: StateSpec = {
    ...currentState,
    onEvent: Object.fromEntries(nextEntries)
  };
  const nextStates = spec.states.map((state, index) => (index === stateIndex ? nextState : state));
  return { ...spec, states: nextStates };
}

export function renameState(spec: WorkflowSpec, oldName: string, newName: string): WorkflowSpec {
  if (!oldName.trim() || oldName === newName) {
    return spec;
  }
  const exists = spec.states.some((state) => state.name === newName);
  if (exists) {
    return spec;
  }

  const nextStartState = spec.startState === oldName ? newName : spec.startState;
  const nextStates = spec.states.map((state) => {
    const renamedState: StateSpec =
      state.name === oldName
        ? {
            ...state,
            name: newName
          }
        : state;
    const nextOnEvent = Object.fromEntries(
      Object.entries(renamedState.onEvent ?? {}).map(([eventName, transition]) => [
        eventName,
        transition.target === oldName ? { ...transition, target: newName } : transition
      ])
    );
    return { ...renamedState, onEvent: nextOnEvent };
  });

  return { ...spec, startState: nextStartState, states: nextStates };
}

function normalizeKey(value: string): string {
  return value.trim().toUpperCase();
}

export function lintWorkflowSpec(spec: WorkflowSpec): WorkflowLintResult {
  const errors: WorkflowLintIssue[] = [];
  const warnings: WorkflowLintIssue[] = [];
  const stateNames = spec.states.map((state) => state.name);
  const stateSet = new Set(stateNames);
  const stateCounts = new Map<string, number>();
  stateNames.forEach((name) => {
    const normalized = normalizeKey(name);
    if (!normalized) {
      return;
    }
    stateCounts.set(normalized, (stateCounts.get(normalized) ?? 0) + 1);
  });
  stateNames.forEach((name, index) => {
    const normalized = normalizeKey(name);
    if (!normalized) {
      return;
    }
    if ((stateCounts.get(normalized) ?? 0) > 1) {
      errors.push({
        id: `state-dup-${normalized}-${index}`,
        level: 'error',
        tab: 'state',
        message: `Duplicate state name "${name}".`,
        stateName: name,
        field: 'state'
      });
    }
  });

  const stateByName = new Map(spec.states.map((state) => [state.name, state]));

  spec.states.forEach((state, index) => {
    const events = Object.entries(state.onEvent ?? {});
    if (events.length === 0) {
      warnings.push({
        id: `state-empty-${state.name}-${index}`,
        level: 'warning',
        tab: 'state',
        message: `State "${state.name}" has no events.`,
        stateName: state.name,
        field: 'state'
      });
    }

    const eventCounts = new Map<string, number>();
    events.forEach(([eventName]) => {
      const normalizedEvent = normalizeKey(eventName);
      if (!normalizedEvent) {
        return;
      }
      eventCounts.set(normalizedEvent, (eventCounts.get(normalizedEvent) ?? 0) + 1);
    });

    events.forEach(([eventName, transition], eventIndex) => {
      const trimmedEvent = eventName.trim();
      if (!trimmedEvent) {
        errors.push({
          id: `event-empty-${state.name}-${eventIndex}`,
          level: 'error',
          tab: 'transitions',
          message: `Event name is required for state "${state.name}".`,
          stateName: state.name,
          eventName,
          field: 'event'
        });
      } else if ((eventCounts.get(normalizeKey(eventName)) ?? 0) > 1) {
        errors.push({
          id: `event-dup-${state.name}-${trimmedEvent}-${eventIndex}`,
          level: 'error',
          tab: 'transitions',
          message: `Duplicate event "${trimmedEvent}" under "${state.name}".`,
          stateName: state.name,
          eventName,
          field: 'event'
        });
      }

      const target = transition?.target ?? '';
      if (!stateSet.has(target)) {
        errors.push({
          id: `target-invalid-${state.name}-${eventName}-${eventIndex}`,
          level: 'error',
          tab: 'transitions',
          message: `Target "${target || 'Unset'}" is not a valid state.`,
          stateName: state.name,
          eventName,
          field: 'target'
        });
      }

      const actions = normalizeActionList(transition?.actions ?? []);
      if (actions.length === 0) {
        warnings.push({
          id: `actions-empty-${state.name}-${eventName}-${eventIndex}`,
          level: 'warning',
          tab: 'transitions',
          message: `Transition "${eventName || 'Unnamed'}" has no actions.`,
          stateName: state.name,
          eventName,
          field: 'actions'
        });
      }
    });
  });

  if (stateNames.length > 0) {
    const candidateStart = spec.startState?.trim() || stateNames[0];
    const startState = stateSet.has(candidateStart) ? candidateStart : stateNames[0];
    if (startState) {
      const reachable = new Set<string>();
      const queue: string[] = [startState];
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current || reachable.has(current)) {
          continue;
        }
        reachable.add(current);
        const currentState = stateByName.get(current);
        if (!currentState) {
          continue;
        }
        Object.values(currentState.onEvent ?? {}).forEach((transition) => {
          const target = transition?.target;
          if (target && stateSet.has(target) && !reachable.has(target)) {
            queue.push(target);
          }
        });
      }
      stateNames.forEach((name, index) => {
        if (!reachable.has(name)) {
          warnings.push({
            id: `state-unreachable-${name}-${index}`,
            level: 'warning',
            tab: 'state',
            message: `State "${name}" is unreachable from "${startState}".`,
            stateName: name,
            field: 'state'
          });
        }
      });
    }
  }

  return {
    errors,
    warnings,
    issues: [...errors, ...warnings]
  };
}

export function migrateLegacyTransitions(stateNames: string[], transitions: unknown): StateSpec[] {
  const baseStates = stateNames.map((name) => ({ name, onEvent: {} as Record<string, TransitionSpec> }));
  let spec: WorkflowSpec = {
    workflowKey: '',
    states: baseStates
  };
  const rows = normalizeLegacyTransitionRows(transitions);
  rows.forEach((row) => {
    if (!row.from) {
      return;
    }
    spec = upsertTransition(spec, row.from, row.eventName, {
      target: row.target,
      actions: row.actions
    });
  });
  return spec.states;
}

function listDuplicateKeys(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      continue;
    }
    const next = counts.get(normalized) ?? 0;
    counts.set(normalized, next + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

export function validateCountryCodeUppercase(
  countryCode: string,
  path = 'countryCode'
): SnapshotValidationError[] {
  const trimmed = countryCode.trim();
  if (!trimmed) {
    return [{ path, message: 'Country code is required.' }];
  }
  if (trimmed !== trimmed.toUpperCase()) {
    return [{ path, message: 'Country code must be uppercase.' }];
  }
  if (!/^[A-Z]+$/.test(trimmed)) {
    return [{ path, message: 'Country code must contain only uppercase letters.' }];
  }
  return [];
}

export function validateNoDuplicateCapabilityKey(
  capabilities: SnapshotCapability[],
  path = 'capabilities'
): SnapshotValidationError[] {
  const duplicates = listDuplicateKeys(capabilities.map((capability) => capability.capabilityKey));
  if (!duplicates.length) {
    return [];
  }
  return [
    {
      path,
      message: `Duplicate capabilityKey values: ${duplicates.join(', ')}.`
    }
  ];
}

export function validateNoDuplicateRuleKeys(
  validations: SnapshotRule[],
  enrichments: SnapshotRule[],
  actions: SnapshotAction[]
): SnapshotValidationError[] {
  const errors: SnapshotValidationError[] = [];
  const validationDuplicates = listDuplicateKeys(validations.map((rule) => rule.key));
  const enrichmentDuplicates = listDuplicateKeys(enrichments.map((rule) => rule.key));
  const actionDuplicates = listDuplicateKeys(actions.map((action) => action.key));

  if (validationDuplicates.length) {
    errors.push({
      path: 'validations',
      message: `Duplicate validation keys: ${validationDuplicates.join(', ')}.`
    });
  }
  if (enrichmentDuplicates.length) {
    errors.push({
      path: 'enrichments',
      message: `Duplicate enrichment keys: ${enrichmentDuplicates.join(', ')}.`
    });
  }
  if (actionDuplicates.length) {
    errors.push({
      path: 'actions',
      message: `Duplicate action keys: ${actionDuplicates.join(', ')}.`
    });
  }

  return errors;
}

export function validateTransitionsReferToValidStates(
  workflow: WorkflowSpec,
  path = 'workflow'
): SnapshotValidationError[] {
  const errors: SnapshotValidationError[] = [];
  const stateSet = new Set(workflow.states.map((state) => state.name));

  workflow.states.forEach((state, index) => {
    const fromName = state.name;
    if (!stateSet.has(fromName)) {
      errors.push({
        path: `${path}.states[${index}].name`,
        message: `State "${fromName}" is not in workflow.states.`
      });
    }
    Object.entries(state.onEvent ?? {}).forEach(([eventName, eventSpec]) => {
      if (!stateSet.has(eventSpec.target)) {
        errors.push({
          path: `${path}.states[${index}].onEvent.${eventName}.target`,
          message: `Transition target state "${eventSpec.target}" is not in workflow.states.`
        });
      }
    });
  });

  return errors;
}

export function validateSnapshotModel(snapshot: SnapshotModel): SnapshotValidationError[] {
  return [
    ...validateCountryCodeUppercase(snapshot.countryCode),
    ...validateNoDuplicateCapabilityKey(snapshot.capabilities),
    ...validateNoDuplicateRuleKeys(snapshot.validations, snapshot.enrichments, snapshot.actions),
    ...validateTransitionsReferToValidStates(snapshot.workflow)
  ];
}
