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
      { capabilityKey: 'STATE_MANAGER', enabled: true },
      { capabilityKey: 'STATE_MANAGER', enabled: false }
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/STATE_MANAGER/);
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
      states: ['RECEIVED', 'VALIDATED'],
      transitions: [
        { from: 'RECEIVED', to: 'VALIDATED', onEvent: 'VALIDATE' },
        { from: 'MISSING', to: 'VALIDATED', onEvent: 'INVALID' }
      ]
    };
    const errors = validateTransitionsReferToValidStates(workflow);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toContain('from');
  });
});
