import * as dagre from 'dagre';
import type { Edge, Node } from 'reactflow';
import type { WorkflowSpec, WorkflowTransitionRow } from '../../../models/snapshot';
import { listAllTransitions } from '../../../models/snapshot';

export type LayoutDirection = 'LR' | 'TB';

export type LifecyclePhase = 'Ingress' | 'Enrichment' | 'Sanctions' | 'Clearing' | 'Finalization';

export type StateType = 'processing' | 'external' | 'failure' | 'success';

export type DiagramNodeData = {
  label: string;
  phase: LifecyclePhase;
  stateType: StateType;
  actionsSummary?: string;
  isTerminal: boolean;
  events: Array<{ eventName: string; target: string; actions: string[] }>;
  isSelected?: boolean;
  highlighted?: boolean;
};

export type SwimlaneData = {
  label: string;
  phase: LifecyclePhase;
};

export type StartNodeData = {
  label: string;
};

export type DiagramEdgeKind = 'success' | 'failure' | 'retry' | 'external' | 'start';

export type DiagramEdgeData = {
  eventName: string;
  actionsCount: number;
  kind: DiagramEdgeKind;
  highlighted?: boolean;
};

export type DiagramGraph = {
  nodes: Array<Node<DiagramNodeData | SwimlaneData | StartNodeData>>;
  edges: Array<Edge<DiagramEdgeData>>;
  stateById: Map<string, DiagramNodeData>;
};

const PHASES: LifecyclePhase[] = ['Ingress', 'Enrichment', 'Sanctions', 'Clearing', 'Finalization'];

const NODE_SIZE = { width: 220, height: 120 };
const ROW_GAP = 48;
const LANE_GAP = 36;
const LANE_PADDING = 28;
const LANE_HEADER_HEIGHT = 26;

const failurePattern = /(FAIL|ERROR|REJECT|INVALID|NOTRECOVERABLE|NOT_RECOVERABLE|RECOVERABLE|NACK)/i;
const retryPattern = /(RETRY|ONRETRY)/i;
const successPattern = /(SUCCESS|COMPLETED|DONE|FINAL|APPROVED|SETTLED)/i;
const externalPattern = /(SANCTION|CLEAR|SETTLE|NETWORK|EXTERNAL|OUTBOUND|SWIFT|KAFKA|NOTIFY)/i;

function resolvePhase(stateName: string, startState: string): LifecyclePhase {
  const upper = stateName.toUpperCase();
  if (stateName === startState) {
    return 'Ingress';
  }
  if (/(INGRESS|INIT|RECEIVE|REQUEST|INBOUND|DUPCHECK)/i.test(upper)) {
    return 'Ingress';
  }
  if (/(ENRICH|LOOKUP|NORMALIZE|MATCH)/i.test(upper)) {
    return 'Enrichment';
  }
  if (/(SANCTION|AML|SCREEN)/i.test(upper)) {
    return 'Sanctions';
  }
  if (/(CLEAR|SETTLE|SETTLEMENT|POST|BOOK)/i.test(upper)) {
    return 'Clearing';
  }
  if (/(FINAL|COMPLETE|SUCCESS|DONE|CLOSE|ARCHIVE|END)/i.test(upper)) {
    return 'Finalization';
  }
  return 'Enrichment';
}

function resolveStateType(stateName: string, actions: string[], isTerminal: boolean): StateType {
  const upper = stateName.toUpperCase();
  if (failurePattern.test(upper)) {
    return 'failure';
  }
  if (isTerminal && successPattern.test(upper)) {
    return 'success';
  }
  if (externalPattern.test(upper) || actions.some((action) => externalPattern.test(action.toUpperCase()))) {
    return 'external';
  }
  return 'processing';
}

function buildActionsSummary(actions: string[]): string | undefined {
  const unique = Array.from(new Set(actions.map((action) => action.trim()).filter(Boolean)));
  if (unique.length === 0) {
    return undefined;
  }
  const shown = unique.slice(0, 2);
  const remaining = unique.length - shown.length;
  return `Actions: ${shown.join(', ')}${remaining > 0 ? ` +${remaining} more` : ''}`;
}

function buildEdgeId(transition: WorkflowTransitionRow): string {
  return `${transition.from}__${transition.eventName}__${transition.target}`;
}

export function layoutGraph(spec: WorkflowSpec, direction: LayoutDirection = 'LR'): DiagramGraph {
  const transitions = listAllTransitions(spec);
  const stateNames = spec.states.map((state) => state.name).filter(Boolean);
  const startState = spec.startState?.trim() || stateNames[0] || '';

  const eventsByState = new Map<string, Array<{ eventName: string; target: string; actions: string[] }>>();
  transitions.forEach((transition) => {
    if (!eventsByState.has(transition.from)) {
      eventsByState.set(transition.from, []);
    }
    eventsByState.get(transition.from)?.push({
      eventName: transition.eventName,
      target: transition.target,
      actions: transition.actions
    });
  });

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 140,
    nodesep: 70,
    edgesep: 50
  });

  stateNames.forEach((state) => {
    dagreGraph.setNode(state, { width: NODE_SIZE.width, height: NODE_SIZE.height });
  });
  transitions.forEach((transition) => {
    dagreGraph.setEdge(transition.from, transition.target);
  });

  dagre.layout(dagreGraph);

  const nodesWithLayout = stateNames.map((state) => {
    const layout = dagreGraph.node(state) as { x: number; y: number } | undefined;
    const x = (layout?.x ?? 0) - NODE_SIZE.width / 2;
    const y = (layout?.y ?? 0) - NODE_SIZE.height / 2;
    return { state, x, y };
  });

  const phaseNodes = new Map<LifecyclePhase, Array<{ state: string; x: number; y: number }>>();
  nodesWithLayout.forEach((entry) => {
    const phase = resolvePhase(entry.state, startState);
    if (!phaseNodes.has(phase)) {
      phaseNodes.set(phase, []);
    }
    phaseNodes.get(phase)?.push(entry);
  });

  let laneTop = 0;
  const laneBounds = new Map<LifecyclePhase, { top: number; height: number }>();

  const positionedNodes = new Map<string, { x: number; y: number }>();

  PHASES.forEach((phase) => {
    const laneEntries = phaseNodes.get(phase) ?? [];
    if (laneEntries.length === 0) {
      return;
    }
    laneEntries.sort((left, right) => left.y - right.y);
    const laneHeight =
      LANE_HEADER_HEIGHT +
      LANE_PADDING * 2 +
      laneEntries.length * NODE_SIZE.height +
      Math.max(0, laneEntries.length - 1) * ROW_GAP;
    laneBounds.set(phase, { top: laneTop, height: laneHeight });
    laneEntries.forEach((entry, index) => {
      const y =
        laneTop +
        LANE_HEADER_HEIGHT +
        LANE_PADDING +
        index * (NODE_SIZE.height + ROW_GAP);
      positionedNodes.set(entry.state, { x: entry.x, y });
    });
    laneTop += laneHeight + LANE_GAP;
  });

  const laneEntries = [...laneBounds.entries()];
  const allPositions = [...positionedNodes.values()];
  const minX = allPositions.length ? Math.min(...allPositions.map((pos) => pos.x)) : 0;
  const maxX = allPositions.length ? Math.max(...allPositions.map((pos) => pos.x + NODE_SIZE.width)) : 0;
  const laneX = minX - LANE_PADDING;
  const laneWidth = maxX - minX + LANE_PADDING * 2;

  const stateById = new Map<string, DiagramNodeData>();

  const stateNodes: Array<Node<DiagramNodeData>> = stateNames.map((state) => {
    const events = eventsByState.get(state) ?? [];
    const isTerminal = events.length === 0;
    const actions = events.flatMap((event) => event.actions ?? []);
    const data: DiagramNodeData = {
      label: state,
      phase: resolvePhase(state, startState),
      stateType: resolveStateType(state, actions, isTerminal),
      actionsSummary: buildActionsSummary(actions),
      isTerminal,
      events
    };
    stateById.set(state, data);
    const position = positionedNodes.get(state) ?? { x: 0, y: 0 };
    return {
      id: state,
      type: 'state',
      position,
      data,
      style: {
        width: NODE_SIZE.width,
        height: NODE_SIZE.height,
        zIndex: 1
      }
    };
  });

  const swimlaneNodes: Array<Node<SwimlaneData>> = laneEntries.map(([phase, bounds]) => ({
    id: `lane:${phase}`,
    type: 'swimlane',
    position: { x: laneX, y: bounds.top },
    data: { label: phase, phase },
    draggable: false,
    selectable: false,
    style: {
      width: laneWidth,
      height: bounds.height,
      zIndex: 0
    }
  }));

  const edges: Array<Edge<DiagramEdgeData>> = transitions.map((transition) => {
    const eventName = transition.eventName.trim();
    const actionsCount = transition.actions?.length ?? 0;
    const normalized = eventName.toUpperCase();
    const sourceType = stateById.get(transition.from)?.stateType ?? 'processing';
    const targetType = stateById.get(transition.target)?.stateType ?? 'processing';
    const isFailure = failurePattern.test(normalized);
    const isRetry = retryPattern.test(normalized);
    const isExternal = sourceType === 'external' || targetType === 'external';
    const kind: DiagramEdgeKind = isFailure
      ? 'failure'
      : isRetry
        ? 'retry'
        : isExternal
          ? 'external'
          : 'success';
    return {
      id: buildEdgeId(transition),
      source: transition.from,
      target: transition.target,
      type: 'custom',
      label: eventName,
      data: {
        eventName,
        actionsCount,
        kind
      }
    };
  });

  const extraNodes: Array<Node<StartNodeData>> = [];
  if (startState) {
    const startNodeId = '__start__';
    const startNodeSize = 18;
    const startStatePosition = positionedNodes.get(startState);
    if (startStatePosition) {
      const startX = startStatePosition.x - startNodeSize - 48;
      const startY = startStatePosition.y + NODE_SIZE.height / 2 - startNodeSize / 2;
      const startNode: Node<StartNodeData> = {
        id: startNodeId,
        type: 'start',
        position: { x: startX, y: startY },
        data: { label: 'Start' },
        draggable: false,
        selectable: false,
        style: {
          width: startNodeSize,
          height: startNodeSize
        }
      };
      extraNodes.push(startNode);
      edges.unshift({
        id: `start__${startState}`,
        source: startNodeId,
        target: startState,
        type: 'custom',
        data: {
          eventName: '',
          actionsCount: 0,
          kind: 'start'
        }
      });
    }
  }

  return {
    nodes: [...swimlaneNodes, ...extraNodes, ...stateNodes],
    edges,
    stateById
  };
}
