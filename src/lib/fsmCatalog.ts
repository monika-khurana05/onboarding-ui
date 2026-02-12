import rawCatalog from '../data/fsmCatalog.json';

export type FsmCatalog = {
  states: string[];
  events: string[];
  actions: string[];
};

export type FsmTransitionSuggestion = {
  from: string;
  event: string;
  to: string;
  actions: string[];
  count: number;
};

export type FsmSuggestions = {
  states: string[];
  events: string[];
  actions: string[];
  transitions: FsmTransitionSuggestion[];
};

const fsmCatalog = rawCatalog as FsmCatalog;

const normalizeToken = (value: string) => value.trim();

const dedupeAndSort = (values: string[]) => {
  const set = new Set<string>();
  values.forEach((value) => {
    const next = normalizeToken(value);
    if (!next) {
      return;
    }
    set.add(next);
  });
  return [...set].sort((left, right) => left.localeCompare(right));
};

export function buildFsmSuggestions(catalog: FsmCatalog): FsmSuggestions {
  return {
    states: dedupeAndSort(catalog.states),
    events: dedupeAndSort(catalog.events),
    actions: dedupeAndSort(catalog.actions),
    transitions: []
  };
}

const fsmSuggestions = buildFsmSuggestions(fsmCatalog);

export { fsmCatalog, fsmSuggestions };
