import { arPolicy } from './arPolicy';
import { brPolicy } from './brPolicy';
import { defaultCountryPolicy } from './defaultCountryPolicy';
import type { CountryActionPolicy } from './types';

const countryPolicies = new Map<string, CountryActionPolicy>([
  ['AR', arPolicy],
  ['BR', brPolicy]
]);

export const REGISTERED_COUNTRY_POLICY_CODES = [...countryPolicies.keys()].sort((left, right) =>
  left.localeCompare(right)
);

export function getCountryPolicy(countryCode: string): CountryActionPolicy {
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  const knownPolicy = countryPolicies.get(normalizedCountryCode);
  if (knownPolicy) {
    return knownPolicy;
  }

  if (!normalizedCountryCode) {
    return defaultCountryPolicy;
  }

  return {
    ...defaultCountryPolicy,
    countryCode: normalizedCountryCode
  };
}
