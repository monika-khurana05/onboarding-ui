import { RequirementDocSource } from './types';

export const MOCK_DOCS: RequirementDocSource[] = [
  {
    id: 'AR-REG-001',
    label: 'Argentina Instant Payments Spec (Mock)',
    countryCode: 'AR',
    type: 'PDF',
    tags: ['regulatory', 'instant-payments'],
    mockContentKey: 'ar_reg_001',
    origin: 'PRESET'
  },
  {
    id: 'AR-SANC-EMAIL-01',
    label: 'Sanctions Ops Email Thread (Mock)',
    countryCode: 'AR',
    type: 'EMAIL',
    tags: ['sanctions', 'ops'],
    mockContentKey: 'ar_sanctions_email_01',
    origin: 'PRESET'
  },
  {
    id: 'AR-CLEAR-REQ-02',
    label: 'Clearing Field Mapping Notes (Mock)',
    countryCode: 'AR',
    type: 'DOCX',
    tags: ['clearing', 'field-mapping'],
    mockContentKey: 'ar_clearing_notes_02',
    origin: 'PRESET'
  },
  {
    id: 'AR-POST-EPIC-03',
    label: 'Posting Team Jira Epic Export (Mock)',
    countryCode: 'AR',
    type: 'JIRA',
    tags: ['posting', 'ledger'],
    mockContentKey: 'ar_posting_jira_03',
    origin: 'PRESET'
  },
  {
    id: 'AR-LIQ-RULES-01',
    label: 'Liquidity Rules & Limits (Mock)',
    countryCode: 'AR',
    type: 'PDF',
    tags: ['liquidity', 'limits'],
    mockContentKey: 'ar_liquidity_rules_01',
    origin: 'PRESET'
  },
  {
    id: 'AR-DATA-FEEDS-01',
    label: 'Data/Reporting Feed Requirements (Mock)',
    countryCode: 'AR',
    type: 'TEXT',
    tags: ['data', 'reporting'],
    mockContentKey: 'ar_data_feeds_01',
    origin: 'PRESET'
  }
];
