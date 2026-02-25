import { CAPABILITIES, type CapabilityId } from './capabilities';
import type { JiraEpicDraft } from './analysisTypes';
import type { MappingSummaryItem, OpenQuestion, WorkspaceArtifactsBundle } from './workspaceArtifactsTypes';

function capabilityByKeywords(text: string): CapabilityId | null {
  const t = text.toLowerCase();
  const rules: Array<{ id: CapabilityId; kw: string[] }> = [
    { id: 'POSTING', kw: ['posting', 'no debit', 'no credit', 'account status', 'posting restriction'] },
    { id: 'CLEARING', kw: ['clearing', 'settlement'] },
    { id: 'SANCTIONS', kw: ['sanction', 'screening', 'ofac'] },
    { id: 'LIQUIDITY', kw: ['liquidity', 'funding'] },
    { id: 'DATA', kw: ['schema', 'mongo', 'database', 'collection'] },
    { id: 'PAYMENT_ORCHESTRATION', kw: ['state manager', 'fsm', 'orchestrator', 'workflow'] },
    {
      id: 'PAYMENT_INITIATION',
      kw: ['payment initiation', 'initiation', 'pacs', 'pain', 'validation', 'validate', 'account check', 'duplicate detection', 'dup check']
    }
  ];

  let best: { id: CapabilityId; score: number } | null = null;
  for (const r of rules) {
    let score = 0;
    for (const k of r.kw) {
      if (t.includes(k)) score += k.includes(' ') ? 2 : 1;
    }
    if (!best || score > best.score) best = { id: r.id, score };
  }
  if (!best || best.score < 2) return null;
  return best.id;
}

function capLabel(id: CapabilityId) {
  return CAPABILITIES.find((c) => c.id === id)?.label ?? String(id);
}

function shouldCreateJira(item: MappingSummaryItem): boolean {
  const cls = (item.classification || '').toUpperCase();
  // Create Jira mainly for delta/new work
  return cls === 'GLOBAL_MODIFY' || cls === 'NET_NEW' || cls === 'GLOBAL_CONFIG';
}

export function generateJiraEpicsFromArtifacts(args: {
  bundle: WorkspaceArtifactsBundle;
  openQuestionAnswers: Record<string, string>;
}): JiraEpicDraft[] {
  const { bundle } = args;
  const mapping = bundle.files.mappingSummary?.json.classification_results ?? [];
  const country = bundle.meta.countryCode || 'XX';

  // group into capabilities
  const buckets = new Map<CapabilityId, MappingSummaryItem[]>();

  for (const item of mapping) {
    if (!shouldCreateJira(item)) continue;

    const signal = `${item.country_requirement_description}\n${item.matched_global_capability_description || ''}\n${item.reasoning || ''}`;
    const cap = capabilityByKeywords(signal);
    const capId = cap ?? 'DATA'; // fallback bucket
    const arr = buckets.get(capId) ?? [];
    arr.push(item);
    buckets.set(capId, arr);
  }

  const openQs: OpenQuestion[] = bundle.files.openQuestions?.questions ?? [];

  const epics: JiraEpicDraft[] = [];
  for (const [capId, items] of buckets.entries()) {
    const capabilityLabel = capLabel(capId);

    const descriptionLines: string[] = [];
    descriptionLines.push(`h2. Context`);
    descriptionLines.push(`Country: ${country}`);
    descriptionLines.push(`Flow: ${bundle.meta.flow}`);
    descriptionLines.push(`Region: ${bundle.meta.region}`);
    descriptionLines.push('');
    descriptionLines.push(`h2. Gap Summary (from Workspaces)`);
    descriptionLines.push(
      bundle.files.gapAnalysis?.markdown?.trim()
        ? bundle.files.gapAnalysis.markdown
        : '(gap analysis not uploaded)'
    );
    descriptionLines.push('');
    descriptionLines.push(`h2. Requirements in this Epic`);
    for (const it of items) {
      descriptionLines.push(
        `* ${it.country_requirement_id} (${it.classification}, confidence ${it.confidence_score ?? 'n/a'}): ${it.country_requirement_description}`
      );
      if (it.matched_global_capability_id) {
        descriptionLines.push(`  - Matched Global Capability: ${it.matched_global_capability_id}`);
      }
      if (it.reasoning) {
        descriptionLines.push(`  - Reasoning: ${it.reasoning}`);
      }
    }

    // Acceptance criteria: use "Overall summary" + include answered questions
    const acLines: string[] = [];
    acLines.push(`h2. Acceptance Criteria`);
    acLines.push(`* Workspaces mapping reviewed and accepted for all items in this epic.`);
    acLines.push(`* All open questions answered and validated.`);
    acLines.push(`* Jira stories created for each NET_NEW / GLOBAL_MODIFY requirement.`);
    acLines.push('');
    acLines.push(`h3. Open Questions & Answers`);
    if (openQs.length === 0) {
      acLines.push('(open questions file not uploaded)');
    } else {
      for (const q of openQs) {
        const ans = args.openQuestionAnswers[q.id]?.trim();
        if (!ans) continue;
        acLines.push(`* ${q.id}: ${q.question}`);
        if (q.context) acLines.push(`  - Context: ${q.context}`);
        acLines.push(`  - Answer: ${ans}`);
      }
    }

    const epic: JiraEpicDraft = {
      capabilityId: capId,
      title: `${capabilityLabel} - Country ${country} Gap Work`,
      summary: `[${country}] ${capabilityLabel} - Gap Analysis Work`,
      scope: 'MIXED',
      dependencies: [],
      acceptanceCriteria: [],
      linkedRequirements: items.map((i) => i.country_requirement_id),
      descriptionText: descriptionLines.join('\n'),
      acceptanceCriteriaText: acLines.join('\n'),
      children: items.map((it, idx) => ({
        id: `${capId}-${it.country_requirement_id}-${idx}`,
        type: 'STORY',
        summary: `[${country}] ${capabilityLabel} - ${it.country_requirement_id} (${it.classification})`,
        description: `${it.country_requirement_description}\n\nMatched: ${it.matched_global_capability_id ?? 'n/a'}\n${it.matched_global_capability_description ?? ''}\n\nReasoning:\n${it.reasoning ?? ''}`,
        labels: [
          `country-${country.toLowerCase()}`,
          `cap-${String(capId).toLowerCase()}`,
          `classification-${String(it.classification).toLowerCase()}`
        ],
        components: [capabilityLabel],
        parentEpicCapabilityId: capId
      }))
    };

    epics.push(epic);
  }

  return epics;
}
