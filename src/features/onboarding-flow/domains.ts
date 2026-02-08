import type { CapabilityDomainDefinition, CapabilityDomainSlug } from './types';

export const capabilityDomains: CapabilityDomainDefinition[] = [
  {
    slug: 'glsClearing',
    label: 'GLS Clearing',
    description: 'Clearing setup, participant mapping, and market-level clearing controls.',
    repositoryHint: 'cpx-gls-clearing-config'
  },
  {
    slug: 'sanctions',
    label: 'Sanctions',
    description: 'Pre-trade and post-trade sanctions checks, policy links, and escalation routes.',
    repositoryHint: 'cpx-sanctions-policy'
  },
  {
    slug: 'posting',
    label: 'Posting',
    description: 'Accounting/posting rules, ledger events, and posting route assignment.',
    repositoryHint: 'cpx-posting-rules'
  },
  {
    slug: 'routing',
    label: 'Routing',
    description: 'Venue and participant routing behavior, fallback paths, and cutover controls.',
    repositoryHint: 'cpx-routing-config'
  },
  {
    slug: 'initiation',
    label: 'Initiation',
    description: 'Onboarding entry orchestration, request validation, and workflow initiation rules.',
    repositoryHint: 'cpx-initiation-fsm'
  },
  {
    slug: 'stateManager',
    label: 'State Manager',
    description: 'Country lifecycle state transitions and persisted state consistency rules.',
    repositoryHint: 'cpx-state-manager'
  },
  {
    slug: 'notificationsBigdata',
    label: 'Notifications & Big Data',
    description: 'Notification routes, data lake sinks, and observability telemetry mappings.',
    repositoryHint: 'cpx-notifications-bigdata'
  }
];

export function createDefaultDomainState(
  enabledByDefault: boolean
): Record<CapabilityDomainSlug, { enabled: boolean; notes?: string }> {
  return {
    glsClearing: { enabled: enabledByDefault },
    sanctions: { enabled: true },
    posting: { enabled: enabledByDefault },
    routing: { enabled: true },
    initiation: { enabled: true },
    stateManager: { enabled: true },
    notificationsBigdata: { enabled: enabledByDefault }
  };
}
