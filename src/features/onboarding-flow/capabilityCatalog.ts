import type { CapabilityKey } from '../../models/snapshot';

export type CapabilityCatalogEntry = {
  key: CapabilityKey;
  label: string;
  description: string;
};

export const capabilityCatalog: CapabilityCatalogEntry[] = [
  {
    key: 'PAYMENT_INITIATION',
    label: 'Payment Initiation',
    description: 'Initiate payments across all channels, with enrichment and validations.'
  },
  {
    key: 'PAYMENT_ORCHESTRATION',
    label: 'Payment Orchestration',
    description: 'Manage payment workflows and states.'
  },
  {
    key: 'CLIENT_ONBOARDING',
    label: 'Client Onboarding',
    description: 'CRM, client migration, and CTE activities.'
  },
  {
    key: 'SANCTIONS',
    label: 'Sanctions',
    description: 'Manage Sanctions and SPM.'
  },
  {
    key: 'LIQUIDITY',
    label: 'Liquidity',
    description: 'Provide Advance Earmarking and Microbatch processing.'
  },
  {
    key: 'DATA',
    label: 'Data',
    description: 'CDM, Statements, Reports.'
  },
  {
    key: 'REFERENCE_DATA',
    label: 'Reference Data',
    description: 'Reference Data upload such as membership, accounts, and onboarding data.'
  },
  {
    key: 'POSTING',
    label: 'Posting',
    description: 'Handle posting operations such as itemized, consolidated posting.'
  },
  {
    key: 'CLEARING',
    label: 'Clearing',
    description: 'Mapping all Pmt & Non-Pmt messages into Canonical Pojo.'
  },
  {
    key: 'PLATFORM_RESILIENCY',
    label: 'Platform & Resiliency',
    description: 'Provide infrastructure libraries, resiliency and performance.'
  },
  {
    key: 'DEVOPS_MAINTENANCE',
    label: 'Devops Maintenance',
    description: 'Utilities for AWS and Onprem(FW checks), infrastructure - Zero touch.'
  },
  {
    key: 'DATABASE_UTILITIES',
    label: 'Database Utilities',
    description: 'MongoDB scripts and replay utilities.'
  },
  {
    key: 'SRE_OBSERVABILITY',
    label: 'SRE Observability',
    description: 'SRE Dashboard services.'
  }
];
