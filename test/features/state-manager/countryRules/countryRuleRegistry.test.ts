import { describe, expect, it } from 'vitest';
import { getCountryPolicy, REGISTERED_COUNTRY_POLICY_CODES } from '../../../../src/features/state-manager/countryRules/countryRuleRegistry';
import { brPolicy } from '../../../../src/features/state-manager/countryRules/brPolicy';
import { defaultCountryPolicy } from '../../../../src/features/state-manager/countryRules/defaultCountryPolicy';

describe('getCountryPolicy', () => {
  it('returns the BR policy for BR requests', () => {
    expect(getCountryPolicy('br')).toBe(brPolicy);
    expect(getCountryPolicy('BR').countryCode).toBe('BR');
  });

  it('returns AR policy shape for AR requests without leaking BR builders', () => {
    const policy = getCountryPolicy('AR');

    expect(policy.countryCode).toBe('AR');
    expect(policy.semanticActionBuilders?.POSTING_FAILURE).toBeUndefined();
  });

  it('returns a country-aware default policy for unknown countries', () => {
    const policy = getCountryPolicy('CL');

    expect(policy).not.toBe(defaultCountryPolicy);
    expect(policy.countryCode).toBe('CL');
    expect(policy.semanticActionBuilders).toBe(defaultCountryPolicy.semanticActionBuilders);
  });

  it('exposes the registered policy country codes deterministically', () => {
    expect(REGISTERED_COUNTRY_POLICY_CODES).toEqual(['AR', 'BR']);
  });
});
