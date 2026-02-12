import { describe, expect, it } from 'vitest';
import {
  validateCountryCodeUppercase,
  validateNoDuplicateCapabilityKey,
  validateNoDuplicateRuleKeys,
  validateTransitionsReferToValidStates
} from './snapshot';

describe('snapshot validation helpers', () => {
  it('requires countryCode and enforces uppercase', () => {
    expect(validateCountryCodeUppercase('')).toHaveLength(1);
    expect(validateCountryCodeUppercase('us')[0].message).toMatch(/uppercase/i);
    expect(validateCountryCodeUppercase('US')).toHaveLength(0);
  });

  it('detects duplicate capability keys', () => {
    const errors = validateNoDuplicateCapabilityKey([
      { capabilityKey: 'PAYMENT_ORCHESTRATION', enabled: true },
      { capabilityKey: 'PAYMENT_ORCHESTRATION', enabled: false }
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/PAYMENT_ORCHESTRATION/);
  });

  it('detects duplicate rule keys across validations/enrichments/actions', () => {
    const errors = validateNoDuplicateRuleKeys(
      [
        { key: 'RULE_A', enabled: true },
        { key: 'rule_a', enabled: false }
      ],
      [{ key: 'ENRICH_A', enabled: true }],
      [
        { key: 'ACTION_X', enabled: true },
        { key: 'ACTION_X', enabled: false }
      ]
    );
    expect(errors).toHaveLength(2);
    expect(errors.map((error) => error.path)).toEqual(['validations', 'actions']);
  });

  it('validates workflow transitions reference valid states', () => {
    const workflow = {
      workflowKey: 'PAYMENT_INGRESS',
      states: [
        {
          name: 'RECEIVED',
          onEvent: {
            VALIDATE: { target: 'VALIDATED', actions: [] }
          }
        },
        {
          name: 'MISSING',
          onEvent: {
            INVALID: { target: 'VALIDATED', actions: [] }
          }
        }
      ]
    };
    const errors = validateTransitionsReferToValidStates(workflow);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toContain('target');
  });
});
