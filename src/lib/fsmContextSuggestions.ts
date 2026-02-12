import type { FsmCatalog } from './fsmCatalog';
import { fsmCatalog } from './fsmCatalog';

const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizeEventKey = (value: string) => value.trim().toUpperCase();

const uniqueList = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const next = value.trim();
    if (!next) {
      return;
    }
    const key = next.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(next);
  });
  return result;
};

const isRetryEvent = (eventName: string) => {
  const normalized = normalizeEventKey(eventName);
  return normalized === 'ONRETRY' || normalized.includes('RETRY');
};

const isFailureEvent = (eventName: string) =>
  /(FAIL|ERROR|REJECT|INVALID|NOTRECOVERABLE|NOT_RECOVERABLE|RECOVERABLE|NACK)/.test(
    normalizeEventKey(eventName)
  );

const isSuccessEvent = (eventName: string) =>
  /(SUCCESS|PASSED|COMPLETED|ENABLED|APPROVED|APPROVE)/.test(normalizeEventKey(eventName));

export function getSuggestedEventsForState(stateName: string, catalog: FsmCatalog = fsmCatalog): string[] {
  const normalizedState = normalizeKey(stateName);
  if (!normalizedState) {
    return [];
  }

  const matches = catalog.events.filter((event) => {
    const eventKey = normalizeKey(event);
    return eventKey.includes(normalizedState);
  });

  const catalogEventSet = new Set(catalog.events.map((event) => event.trim()));
  const enrichmentFailures: string[] = [];
  if (stateName.toLowerCase().includes('enrichment')) {
    if (catalogEventSet.has('EnrichmentFailureRecoverable')) {
      enrichmentFailures.push('EnrichmentFailureRecoverable');
    }
    if (catalogEventSet.has('EnrichmentFailureNotRecoverable')) {
      enrichmentFailures.push('EnrichmentFailureNotRecoverable');
    }
  }

  const retryEvents: string[] = [];
  if (catalogEventSet.has('OnRetry')) {
    retryEvents.push('OnRetry');
  }

  return uniqueList([...matches, ...enrichmentFailures, ...retryEvents]);
}

export function getSuggestedActionsForEvent(eventName: string, catalog: FsmCatalog = fsmCatalog): string[] {
  if (!eventName.trim()) {
    return [];
  }

  const catalogActionSet = new Set(catalog.actions.map((action) => action.trim()));
  if (isRetryEvent(eventName) && catalogActionSet.has('reset-mtp')) {
    return ['reset-mtp'];
  }
  if (isFailureEvent(eventName) && catalogActionSet.has('notify-bd-error')) {
    return ['notify-bd-error'];
  }
  if (isSuccessEvent(eventName) && catalogActionSet.has('persist-txn')) {
    return ['persist-txn'];
  }
  return [];
}
