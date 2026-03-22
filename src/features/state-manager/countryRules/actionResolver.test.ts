import { describe, expect, it } from 'vitest';
import { brPolicy } from './brPolicy';
import {
  buildExactKnowledgeLookupKey,
  inferTransitionSemantic,
  resolveTransitionDefinition
} from './actionResolver';
import type { CountryActionPolicy } from './types';

function buildContext(overrides: Partial<Parameters<typeof resolveTransitionDefinition>[0]> = {}) {
  return {
    countryCode: 'BR',
    direction: 'outgoing' as const,
    source: 'Alpha',
    target: 'Beta',
    eventName: 'ProcessBeta',
    isTerminal: false,
    ...overrides
  };
}

describe('inferTransitionSemantic', () => {
  it.each([
    ['Init', 'DupCheckPassed', 'SpmCheck', 'DUP_CHECK_PASSED'],
    ['SpmSent', 'OnRetry', 'SpmSent', 'RETRY'],
    ['SanctionsSent', 'SanctionsException', 'SanctionsRespRepair', 'SANCTIONS_EXCEPTION'],
    ['BalanceCheckPending', 'OutgoingSendToClearingWithAckAndPosting', 'SendClearingPostingPending', 'SEND_TO_CLEARING_AND_POST'],
    ['SendClearingPostingPending', 'ClearingResponseRJCT', 'ClrRejectedOrgPostingPending', 'CLEARING_RESPONSE_RJCT'],
    ['NormalPostingPending', 'PostingFailureRecoverable', 'NormalPostingPending', 'POSTING_FAILURE_RECOVERABLE'],
    ['Warehoused', 'OnRelease', 'SpmSent', 'WAREHOUSE_RELEASE'],
    ['Alpha', 'ProcessBeta', 'Beta', 'GENERIC_PROCESS']
  ])('maps %s --%s--> %s to %s', (source, eventName, target, semantic) => {
    expect(inferTransitionSemantic(source, eventName, target)).toBe(semantic);
  });
});

describe('resolveTransitionDefinition', () => {
  it('prefers exact KB knowledge over overrides and builders', () => {
    const exactKnowledge = new Map([
      [
        buildExactKnowledgeLookupKey('SendClearingPostingPending', 'PostingFailure', 'SendClearingPostingPending'),
        {
          eventName: 'PostingFailure',
          actions: ['kb-action']
        }
      ]
    ]);

    const resolved = resolveTransitionDefinition(
      buildContext({
        source: 'SendClearingPostingPending',
        target: 'SendClearingPostingPending',
        eventName: 'PostingFailure',
        policy: brPolicy,
        knowledgeBySourceEventTarget: exactKnowledge
      })
    );

    expect(resolved).toMatchObject({
      eventName: 'PostingFailure',
      actions: ['kb-action'],
      sourceKind: 'preset'
    });
  });

  it('prefers transition overrides over semantic builders', () => {
    const policy: CountryActionPolicy = {
      countryCode: 'ZZ',
      transitionOverrides: {
        'Alpha::ProcessBeta::Beta': {
          eventName: 'ProcessBetaExactly',
          actions: ['override-action']
        }
      },
      semanticActionBuilders: {
        GENERIC_PROCESS: () => ['builder-action']
      }
    };

    const resolved = resolveTransitionDefinition(buildContext({ policy }));

    expect(resolved).toMatchObject({
      eventName: 'ProcessBetaExactly',
      actions: ['override-action'],
      sourceKind: 'countryOverride'
    });
  });

  it('preserves event-only overrides when actions fall through to generic fallback', () => {
    const policy: CountryActionPolicy = {
      countryCode: 'ZZ',
      transitionOverrides: {
        'Alpha::ProcessBeta::Beta': {
          eventName: 'ProcessBetaOverride'
        }
      },
      semanticActionBuilders: {}
    };

    const resolved = resolveTransitionDefinition(buildContext({ policy, countryCode: 'ZZ' }));

    expect(resolved.eventName).toBe('ProcessBetaOverride');
    expect(resolved.actions).toEqual(['process-beta-zz-outgoing', 'persist-txn', 'notify-bd-intermediate']);
    expect(resolved.sourceKind).toBe('genericFallback');
  });

  it('prefers country semantic builders over default semantic builders', () => {
    const resolved = resolveTransitionDefinition(
      buildContext({
        countryCode: 'BR',
        source: 'SendClearingPostingPending',
        target: 'SendClearingPostingPending',
        eventName: 'ClearingResponseReceived',
        policy: brPolicy
      })
    );

    expect(resolved).toMatchObject({
      actions: ['process-clearing-response-br'],
      sourceKind: 'countrySemantic'
    });
  });

  it('falls back to generic country-aware actions only as a last resort', () => {
    const resolved = resolveTransitionDefinition(
      buildContext({
        countryCode: 'CL',
        direction: 'outgoing',
        source: 'Alpha',
        target: 'Beta',
        eventName: 'ProcessBeta'
      })
    );

    expect(resolved).toMatchObject({
      semantic: 'GENERIC_PROCESS',
      sourceKind: 'genericFallback'
    });
    expect(resolved.actions).toEqual(['process-beta-cl-outgoing', 'persist-txn', 'notify-bd-intermediate']);
  });

  it('keeps AR outgoing on generic country-aware actions instead of BR actions', () => {
    const resolved = resolveTransitionDefinition(
      buildContext({
        countryCode: 'AR',
        source: 'SendClearingPostingPending',
        target: 'SendClearingPostingPending',
        eventName: 'PostingFailure'
      })
    );

    expect(resolved.actions).toEqual(['process-posting-error-ar-outgoing']);
    expect(resolved.actions).not.toContain('process-posting-error-br');
  });
});
