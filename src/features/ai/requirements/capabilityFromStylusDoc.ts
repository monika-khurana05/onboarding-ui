import { CAPABILITIES, type CapabilityId } from './capabilities';
import type { StylusTemplateSections } from './stylusTemplateParser';

type CapabilityScore = {
  score: number;
  reasons: { reason: string; weight: number; labelMatch: boolean }[];
  labelMatched: boolean;
};

const LABEL_MATCH_WEIGHT = 0.9;
const CONFIDENCE_THRESHOLD = 0.55;

const KEYWORD_SIGNALS: Array<{
  capabilityId: CapabilityId;
  pattern: RegExp;
  weight: number;
  reason: string;
}> = [
  { capabilityId: 'POSTING', pattern: /\bposting[- ]restriction(s)?\b/, weight: 0.75, reason: 'keyword "posting restriction"' },
  { capabilityId: 'POSTING', pattern: /\bno[- ]debit\b/, weight: 0.65, reason: 'keyword "no debit"' },
  { capabilityId: 'POSTING', pattern: /\bno[- ]credit\b/, weight: 0.65, reason: 'keyword "no credit"' },
  { capabilityId: 'POSTING', pattern: /\bposting\b/, weight: 0.4, reason: 'keyword "posting"' },

  {
    capabilityId: 'PAYMENT_INITIATION',
    pattern: /\bvalidate\s+account\b/,
    weight: 0.6,
    reason: 'keyword "validate account"'
  },
  {
    capabilityId: 'PAYMENT_INITIATION',
    pattern: /\baccount[- ]check\b/,
    weight: 0.6,
    reason: 'keyword "account check"'
  },
  {
    capabilityId: 'PAYMENT_INITIATION',
    pattern: /\bvalidation\b/,
    weight: 0.4,
    reason: 'keyword "validation"'
  },

  { capabilityId: 'CLEARING', pattern: /\bclearing\b/, weight: 0.7, reason: 'keyword "clearing"' },

  { capabilityId: 'SANCTIONS', pattern: /\bsanction(s)?\b/, weight: 0.7, reason: 'keyword "sanction"' },
  { capabilityId: 'SANCTIONS', pattern: /\bscreening\b/, weight: 0.65, reason: 'keyword "screening"' },

  { capabilityId: 'LIQUIDITY', pattern: /\bliquidity\b/, weight: 0.7, reason: 'keyword "liquidity"' },

  {
    capabilityId: 'PAYMENT_ORCHESTRATION',
    pattern: /\borchestrator\b/,
    weight: 0.7,
    reason: 'keyword "orchestrator"'
  },
  {
    capabilityId: 'PAYMENT_ORCHESTRATION',
    pattern: /\bstate\s+manager\b/,
    weight: 0.7,
    reason: 'keyword "state manager"'
  },
  { capabilityId: 'PAYMENT_ORCHESTRATION', pattern: /\bfsm\b/, weight: 0.6, reason: 'keyword "fsm"' },

  { capabilityId: 'DATA', pattern: /\bmongo\b/, weight: 0.65, reason: 'keyword "mongo"' },
  { capabilityId: 'DATA', pattern: /\bschema\b/, weight: 0.6, reason: 'keyword "schema"' },
  { capabilityId: 'DATA', pattern: /\bdata\b/, weight: 0.35, reason: 'keyword "data"' }
];

function buildCombinedText(sections: StylusTemplateSections): string {
  return [sections.epicTitle, sections.descriptionText, sections.inScopeText, sections.acceptanceCriteriaText]
    .filter((value) => value && value.trim().length > 0)
    .join('\n');
}

function initScores(): Record<CapabilityId, CapabilityScore> {
  return CAPABILITIES.reduce(
    (acc, capability) => {
      acc[capability.id] = { score: 0, reasons: [], labelMatched: false };
      return acc;
    },
    {} as Record<CapabilityId, CapabilityScore>
  );
}

function addScore(scores: Record<CapabilityId, CapabilityScore>, capabilityId: CapabilityId, weight: number, reason: string, labelMatch = false): void {
  const entry = scores[capabilityId];
  if (!entry) {
    return;
  }
  if (entry.reasons.some((existing) => existing.reason === reason)) {
    return;
  }
  entry.reasons.push({ reason, weight, labelMatch });
  entry.score = Math.min(1, entry.score + weight);
  if (labelMatch) {
    entry.labelMatched = true;
  }
}

function formatReasons(reasons: CapabilityScore['reasons']): string {
  if (reasons.length === 0) {
    return 'No matching signals.';
  }
  const sorted = [...reasons].sort((a, b) => b.weight - a.weight);
  return sorted.map((item) => item.reason).join('; ');
}

export function detectCapabilityFromStylusDoc(sections: StylusTemplateSections): {
  capabilityId: CapabilityId | null;
  confidence: number;
  reason: string;
} {
  const combinedText = buildCombinedText(sections);
  const normalizedText = combinedText.toLowerCase();
  const scores = initScores();

  for (const capability of CAPABILITIES) {
    const label = capability.label.toLowerCase();
    if (label && normalizedText.includes(label)) {
      addScore(scores, capability.id, LABEL_MATCH_WEIGHT, `Label match: ${capability.label}`, true);
    }
  }

  for (const signal of KEYWORD_SIGNALS) {
    signal.pattern.lastIndex = 0;
    if (signal.pattern.test(normalizedText)) {
      addScore(scores, signal.capabilityId, signal.weight, signal.reason);
    }
  }

  let best: { id: CapabilityId; score: number; labelMatched: boolean; reasons: CapabilityScore['reasons'] } | null = null;

  for (const capability of CAPABILITIES) {
    const entry = scores[capability.id];
    if (!entry) {
      continue;
    }
    if (!best || entry.score > best.score) {
      best = { id: capability.id, score: entry.score, labelMatched: entry.labelMatched, reasons: entry.reasons };
      continue;
    }
    if (entry.score === best.score) {
      if (entry.labelMatched && !best.labelMatched) {
        best = { id: capability.id, score: entry.score, labelMatched: entry.labelMatched, reasons: entry.reasons };
      } else if (entry.labelMatched === best.labelMatched && entry.reasons.length > best.reasons.length) {
        best = { id: capability.id, score: entry.score, labelMatched: entry.labelMatched, reasons: entry.reasons };
      }
    }
  }

  if (!best) {
    return { capabilityId: null, confidence: 0, reason: 'No matching capability signals.' };
  }

  const confidence = Math.min(1, best.score);
  if (confidence < CONFIDENCE_THRESHOLD) {
    return {
      capabilityId: null,
      confidence,
      reason: `Low confidence (${confidence.toFixed(2)}). Top signals: ${formatReasons(best.reasons)}`
    };
  }

  return {
    capabilityId: best.id,
    confidence,
    reason: formatReasons(best.reasons)
  };
}
