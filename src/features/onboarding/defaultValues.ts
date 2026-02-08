import type { CountryOnboardingInput } from './schema';

export const onboardingDefaultValues: CountryOnboardingInput = {
  countryName: '',
  iso2: '',
  region: 'EMEA',
  regulatoryTier: 'Tier 2',
  launchDate: '',
  settlementCurrency: 'USD',
  enableSanctionsScreening: true,
  riskThreshold: 40,
  goLiveChecklistComplete: false,
  workflowConfig: {
    approvalMode: 'dual',
    autoProvision: true,
    settlementCutoff: '17:00',
    alertChannel: 'email',
    escalationHours: 12
  }
};
