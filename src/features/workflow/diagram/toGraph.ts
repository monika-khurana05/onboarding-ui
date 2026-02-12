import type { WorkflowSpec } from '../../../models/snapshot';
import { listAllTransitions } from '../../../models/snapshot';
import { parseFsmYamlToSpec } from '../presets/parseFsmYamlToSpec';

export type GraphNode = {
  id: string;
  data: { label: string };
  position: { x: number; y: number };
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
};

export type GraphLayoutOptions = {
  xGap?: number;
  yGap?: number;
};

type TransitionRow = ReturnType<typeof listAllTransitions>[number];

function buildEdgeLabel(transition: TransitionRow): string {
  const base = transition.eventName || '';
  const actions = transition.actions?.filter((action) => action.trim()) ?? [];
  if (actions.length === 0) {
    return base;
  }
  const maxActions = 3;
  const shown = actions.slice(0, maxActions).join(', ');
  const remaining = actions.length - maxActions;
  const suffix = remaining > 0 ? `, +${remaining} more` : '';
  return `${base} \u2022 ${shown}${suffix}`;
}

function buildEdgeId(from: string, eventName: string, to: string): string {
  return `${from}__${eventName}__${to}`;
}

function computeStateDepths(stateNames: string[], transitions: TransitionRow[], startState: string): Map<string, number> {
  const adjacency = new Map<string, string[]>();
  transitions.forEach((transition) => {
    if (!adjacency.has(transition.from)) {
      adjacency.set(transition.from, []);
    }
    adjacency.get(transition.from)?.push(transition.target);
  });

  const depthByState = new Map<string, number>();
  if (startState) {
    depthByState.set(startState, 0);
    const queue = [startState];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      const nextDepth = (depthByState.get(current) ?? 0) + 1;
      const neighbors = adjacency.get(current) ?? [];
      neighbors.forEach((neighbor) => {
        if (!depthByState.has(neighbor)) {
          depthByState.set(neighbor, nextDepth);
          queue.push(neighbor);
        }
      });
    }
  }

  const maxDepth = depthByState.size ? Math.max(...depthByState.values()) : 0;
  const fallbackDepth = depthByState.size ? maxDepth + 1 : 0;
  stateNames.forEach((state) => {
    if (!depthByState.has(state)) {
      depthByState.set(state, fallbackDepth);
    }
  });
  return depthByState;
}

export function toGraphFromSpec(spec: WorkflowSpec, options: GraphLayoutOptions = {}) {
  const xGap = options.xGap ?? 240;
  const yGap = options.yGap ?? 120;
  const stateNames = spec.states.map((state) => state.name).filter(Boolean);
  const transitions = listAllTransitions(spec);
  const startState = spec.startState?.trim() || stateNames[0] || '';
  const depthByState = computeStateDepths(stateNames, transitions, startState);

  const statesByDepth = new Map<number, string[]>();
  stateNames.forEach((state) => {
    const depth = depthByState.get(state) ?? 0;
    if (!statesByDepth.has(depth)) {
      statesByDepth.set(depth, []);
    }
    statesByDepth.get(depth)?.push(state);
  });

  const sortedDepths = [...statesByDepth.keys()].sort((left, right) => left - right);
  const nodes: GraphNode[] = [];
  sortedDepths.forEach((depth) => {
    const states = statesByDepth.get(depth) ?? [];
    states.forEach((state, index) => {
      nodes.push({
        id: state,
        data: { label: state },
        position: { x: depth * xGap, y: index * yGap }
      });
    });
  });

  const edges: GraphEdge[] = transitions.map((transition) => ({
    id: buildEdgeId(transition.from, transition.eventName, transition.target),
    source: transition.from,
    target: transition.target,
    label: buildEdgeLabel(transition)
  }));

  return { nodes, edges };
}

export function toGraphFromYaml(yamlText: string, options: GraphLayoutOptions = {}) {
  const spec = parseFsmYamlToSpec(yamlText);
  return toGraphFromSpec(spec, options);
}
