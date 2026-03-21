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
