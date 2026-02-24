import { CAPABILITY_TO_JIRA } from '../../../config/jiraAutoMap';
import type { JiraChildDraft, JiraEpicDraft } from './analysisTypes';
import type { CapabilityId } from './capabilities';

const BASE_LABELS = ['workspace-output', 'jira-auto'] as const;

type CapabilityAutoKey = keyof typeof CAPABILITY_TO_JIRA;

const CAPABILITY_KEY_BY_ID: Record<CapabilityId, CapabilityAutoKey> = {
  POSTING: 'posting',
  PAYMENT_INITIATION: 'paymentInitiation',
  PAYMENT_ORCHESTRATION: 'stateManager',
  SANCTIONS: 'sanctions',
  CLEARING: 'clearing',
  LIQUIDITY: 'liquidity',
  DATA: 'data'
};

function mergeUniqueStrings(base: string[], extra: string[] = []): string[] {
  const next = new Set<string>(base);
  for (const value of extra) {
    if (value) {
      next.add(value);
    }
  }
  return Array.from(next);
}

function buildCountryLabel(countryCode?: string): string {
  const token = (countryCode || 'UNKNOWN').toUpperCase();
  return `country-${token}`;
}

export function buildJiraAutoEnrichment(args: { capabilityId: CapabilityId; countryCode?: string }) {
  const key = CAPABILITY_KEY_BY_ID[args.capabilityId];
  const mapping = key ? CAPABILITY_TO_JIRA[key] : undefined;
  const baseLabels = [...BASE_LABELS, buildCountryLabel(args.countryCode)];
  return {
    labels: mergeUniqueStrings(baseLabels, mapping?.labels ? [...mapping.labels] : []),
    components: mapping?.components ? [...mapping.components] : [],
    owner: mapping?.owner
  };
}

function applyLabelsAndComponentsToChild(
  child: JiraChildDraft,
  labels: string[],
  components: string[]
): JiraChildDraft {
  return {
    ...child,
    labels: mergeUniqueStrings(child.labels ?? [], labels),
    components: mergeUniqueStrings(child.components ?? [], components)
  };
}

export function applyJiraAutoEnrichmentToEpic(args: {
  epic: JiraEpicDraft;
  countryCode?: string;
}): JiraEpicDraft {
  const enrichment = buildJiraAutoEnrichment({
    capabilityId: args.epic.capabilityId,
    countryCode: args.countryCode
  });
  const labels = mergeUniqueStrings(args.epic.labels ?? [], enrichment.labels);
  const components = mergeUniqueStrings(args.epic.components ?? [], enrichment.components);
  const owner = args.epic.owner ?? enrichment.owner;
  const children = args.epic.children
    ? args.epic.children.map((child) => applyLabelsAndComponentsToChild(child, labels, components))
    : args.epic.children;
  return {
    ...args.epic,
    labels,
    components,
    owner,
    children
  };
}
