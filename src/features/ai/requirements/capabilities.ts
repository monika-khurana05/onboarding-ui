export type CapabilityId =
  | 'PAYMENT_INITIATION'
  | 'PAYMENT_ORCHESTRATION'
  | 'SANCTIONS'
  | 'CLEARING'
  | 'POSTING'
  | 'LIQUIDITY'
  | 'DATA';

export type CapabilityDef = {
  id: CapabilityId;
  label: string;
  description: string;
  owners?: string[];
};

export const CAPABILITIES: CapabilityDef[] = [
  { id: 'PAYMENT_INITIATION', label: 'Payment Initiation', description: 'Ingress validation + enrichment pre-workflow' },
  {
    id: 'PAYMENT_ORCHESTRATION',
    label: 'Payment Orchestration (State Manager)',
    description: 'Workflow transitions + state controls'
  },
  { id: 'SANCTIONS', label: 'Sanctions', description: 'Screening / watchlist / OFAC / AML checks' },
  { id: 'CLEARING', label: 'Clearing', description: 'Clearing routing + clearing-specific field mapping' },
  { id: 'POSTING', label: 'Posting', description: 'Ledger posting + accounting events' },
  { id: 'LIQUIDITY', label: 'Liquidity', description: 'Liquidity reservation / balance checks' },
  { id: 'DATA', label: 'Data', description: 'Persistence, reporting, analytics feeds' }
];
