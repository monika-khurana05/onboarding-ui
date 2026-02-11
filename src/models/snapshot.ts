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

export type SnapshotWorkflowTransition = {
  from: string;
  to: string;
  onEvent: string;
  guardKey?: string;
  actionKey?: string;
  params?: Record<string, any>;
};

export type SnapshotWorkflow = {
  workflowKey: string;
  states: string[];
  transitions: SnapshotWorkflowTransition[];
};

export type SnapshotModel = {
  countryCode: string;
  region?: string;
  capabilities: SnapshotCapability[];
  validations: SnapshotRule[];
  enrichments: SnapshotRule[];
  rulesConfig?: RulesConfig;
  actions: SnapshotAction[];
  workflow: SnapshotWorkflow;
  integrationConfig?: Record<string, any>;
  deploymentOverrides?: Record<string, any>;
};

export type SnapshotValidationError = {
  path: string;
  message: string;
};

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
  workflow: SnapshotWorkflow,
  path = 'workflow'
): SnapshotValidationError[] {
  const errors: SnapshotValidationError[] = [];
  const stateSet = new Set(workflow.states);

  workflow.transitions.forEach((transition, index) => {
    if (!stateSet.has(transition.from)) {
      errors.push({
        path: `${path}.transitions[${index}].from`,
        message: `Transition "from" state "${transition.from}" is not in workflow.states.`
      });
    }
    if (!stateSet.has(transition.to)) {
      errors.push({
        path: `${path}.transitions[${index}].to`,
        message: `Transition "to" state "${transition.to}" is not in workflow.states.`
      });
    }
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
