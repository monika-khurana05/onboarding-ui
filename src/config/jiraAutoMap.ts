export const CAPABILITY_TO_JIRA = {
  posting: { components: ['Posting'], labels: ['cap-posting'], owner: { team: 'Posting', name: 'TBD' } },
  validation: { components: ['Validation'], labels: ['cap-validation'], owner: { team: 'Validation', name: 'TBD' } },
  clearing: { components: ['Clearing'], labels: ['cap-clearing'], owner: { team: 'Clearing', name: 'TBD' } },
  sanctions: { components: ['Sanctions'], labels: ['cap-sanctions'], owner: { team: 'Sanctions', name: 'TBD' } },
  liquidity: { components: ['Liquidity'], labels: ['cap-liquidity'], owner: { team: 'Liquidity', name: 'TBD' } },
  data: { components: ['Data'], labels: ['cap-data'], owner: { team: 'Data', name: 'TBD' } },
  stateManager: {
    components: ['State Manager'],
    labels: ['cap-state-manager'],
    owner: { team: 'Orchestration', name: 'TBD' }
  },
  paymentInitiation: {
    components: ['Payment Initiation'],
    labels: ['cap-payment-initiation'],
    owner: { team: 'PI', name: 'TBD' }
  }
} as const;
