export type GraphValidationIssue = {
  code: string;
  severity: 'ERROR' | 'WARN';
  message: string;
  details?: string[];
};

export type GraphValidationReport = {
  issues: GraphValidationIssue[];
  hasErrors: boolean;
};

export type ScenarioReplayResult = {
  scenarioName: string;
  subFlowTitle: string;
  expectedStates: string[];
  matched: boolean;
  missingTransitions: string[];
  unexpectedStates: string[];
};

export type ScenarioReplayReport = {
  results: ScenarioReplayResult[];
  failedCount: number;
  passedCount: number;
};

export type ReverseEngineeredTransition = {
  source: string;
  eventName: string;
  target: string;
  actions: string[];
};

export type ReverseEngineeredFsm = {
  startState: string | undefined;
  stateNames: string[];
  terminalStates: string[];
  transitions: ReverseEngineeredTransition[];
};

export type FsmActionMismatch = {
  source: string;
  eventName: string;
  target: string;
  expectedActions: string[];
  actualActions: string[];
};

export type FsmComparisonReport = {
  startStateMatches: boolean;
  missingStates: string[];
  extraStates: string[];
  missingTerminalStates: string[];
  extraTerminalStates: string[];
  missingTransitions: string[];
  extraTransitions: string[];
  actionMismatches: FsmActionMismatch[];
  orderingIssues: string[];
  summary: {
    exactStateParity: boolean;
    exactTerminalParity: boolean;
    exactTransitionParity: boolean;
    exactActionParity: boolean;
  };
};

