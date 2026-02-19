import type { CapabilityKey } from '../../models/snapshot';

export type CapabilityCatalogEntry = {
  key: CapabilityKey;
  label: string;
  description: string;
  epicUrl: string;
};

export const capabilityCatalog: CapabilityCatalogEntry[] = [
  {
    key: 'DUP_CHECK',
    label: 'Dup Check',
    description: 'Configure duplicate checking keys and matching fields.',
    epicUrl: 'https://google.com'
  },
  {
    key: 'PAYMENT_INITIATION',
    label: 'Payment Initiation',
    description: 'Initiate payments across all channels, with enrichment and validations.',
    epicUrl: 'https://google.com'
  },
  {
    key: 'PAYMENT_ORCHESTRATION',
    label: 'Payment Orchestration',
    description: 'Manage payment workflows and states.',
    epicUrl: 'https://google.com'
  },
  {
    key: 'CLIENT_ONBOARDING',
    label: 'Client Onboarding',
    description: 'CRM, client migration, and CTE activities.',
    epicUrl: 'https://google.com'
  },
  {
    key: 'SANCTIONS',
    label: 'Sanctions',
    description: 'Manage Sanctions and SPM.',
    epicUrl: 'https://google.com'
  },
  {
    key: 'LIQUIDITY',
    label: 'Liquidity',
    description: 'Provide Advance Earmarking and Microbatch processing.',
    epicUrl: 'https://google.com'
  },
  {
    key: 'DATA',
    label: 'Data',
    description: 'CDM, Statements, Reports.',
    epicUrl: 'https://google.com'
  },
  {
    key: 'REFERENCE_DATA',
    label: 'Reference Data',
    description: 'Reference Data upload such as membership, accounts, and onboarding data.',
    epicUrl: 'https://google.com'
  },
  {
    key: 'POSTING',
    label: 'Posting',
    description: 'Handle posting operations such as itemized, consolidated posting.',
    epicUrl: 'https://google.com'
  },
  {
    key: 'CLEARING',
    label: 'Clearing',
    description: 'Mapping all Pmt & Non-Pmt messages into Canonical Pojo.',
    epicUrl: 'https://google.com'
  },
  {
    key: 'PLATFORM_RESILIENCY',
    label: 'Platform & Resiliency',
    description: 'Provide infrastructure libraries, resiliency and performance.',
    epicUrl: 'https://google.com'
  },
  {
    key: 'DEVOPS_MAINTENANCE',
    label: 'Devops Maintenance',
    description: 'Utilities for AWS and Onprem(FW checks), infrastructure - Zero touch.',
    epicUrl: 'https://google.com'
  },
  {
    key: 'DATABASE_UTILITIES',
    label: 'Database Utilities',
    description: 'MongoDB scripts and replay utilities.',
    epicUrl: 'https://google.com'
  },
  {
    key: 'SRE_OBSERVABILITY',
    label: 'SRE Observability',
    description: 'SRE Dashboard services.',
    epicUrl: 'https://google.com'
  }
];
