import { beforeEach, describe, expect, it } from 'vitest';
import { loadOnboardingDraft, saveOnboardingDraft } from './onboardingDraftStorage';

describe('onboardingDraftStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes and reads selected catalog ids', () => {
    const draft = {
      workflow: { workflowKey: 'PAYMENT_INGRESS', states: [] },
      selectedValidations: ['validation:AlphaRule'],
      selectedEnrichments: ['enrichment:BetaRule']
    };

    saveOnboardingDraft(draft);

    const loaded = loadOnboardingDraft();
    expect(loaded?.selectedValidations).toEqual(['validation:AlphaRule']);
    expect(loaded?.selectedEnrichments).toEqual(['enrichment:BetaRule']);
    expect(loaded?.workflow).toEqual(draft.workflow);
  });

  it('supports legacy workflow-only drafts', () => {
    const legacy = { workflowKey: 'LEGACY', states: [] };
    localStorage.setItem('onboarding:draft:v1', JSON.stringify(legacy));

    const loaded = loadOnboardingDraft();
    expect(loaded?.workflow).toEqual(legacy);
    expect(loaded?.selectedValidations).toEqual([]);
    expect(loaded?.selectedEnrichments).toEqual([]);
  });
});
