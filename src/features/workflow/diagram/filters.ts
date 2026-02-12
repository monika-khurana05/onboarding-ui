export type DiagramFilterOptions = {
  happyOnly: boolean;
  showRetries: boolean;
  showFailures: boolean;
};

type EdgeLike = {
  label?: string;
  eventName?: string;
  data?: {
    eventName?: string;
    kind?: string;
  };
};

const failureTokens = ['FAILED', 'ERROR', 'NOTRECOVERABLE', 'NOT_RECOVERABLE', 'RECOVERABLE'];

function getEventName(edge: EdgeLike): string {
  return (edge.eventName ?? edge.data?.eventName ?? edge.label ?? '').trim();
}

function isFailureEvent(eventName: string): boolean {
  const upper = eventName.toUpperCase();
  return failureTokens.some((token) => upper.includes(token));
}

function isRetryEvent(eventName: string): boolean {
  return eventName.toUpperCase() === 'ONRETRY';
}

export function filterEdges<T extends EdgeLike>(edges: T[], options: DiagramFilterOptions): T[] {
  return edges.filter((edge) => {
    if (edge.data?.kind === 'start') {
      return true;
    }
    const eventName = getEventName(edge);
    const failure = edge.data?.kind === 'failure' || isFailureEvent(eventName);
    const retry = edge.data?.kind === 'retry' || isRetryEvent(eventName);

    if (options.happyOnly && failure) {
      return false;
    }
    if (!options.showFailures && failure) {
      return false;
    }
    if (!options.showRetries && retry) {
      return false;
    }
    return true;
  });
}
