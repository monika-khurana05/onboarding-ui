export type SemanticTag =
  | 'PRE_FSM_REJECTION'
  | 'INIT_ENTRY'
  | 'SPM_LIFECYCLE'
  | 'SANCTIONS_LIFECYCLE'
  | 'BALANCE_CHECK'
  | 'CLEARING_PHASE'
  | 'POSTING_PHASE'
  | 'WAREHOUSE_PARK'
  | 'WAREHOUSE_RELEASE'
  | 'FINAL_SUCCESS'
  | 'FINAL_FAILURE'
  | 'CLIENT_NACK'
  | 'REVERSAL_REQUIRED'
  | 'BOOK_TRANSFER'
  | 'INCOMING_FLOW'
  | 'OUTGOING_FLOW'
  | 'UNKNOWN';

export type NormalizedRow = {
  sourceScenarioId: string;
  sourceScenarioName: string;
  sourceSubFlowId: string;
  sourceSubFlowTitle: string;
  rowId: string;
  msgStatus: string;
  msgSubStatus: string;
  transactionStatus: string;
  transactionStatusReason: string;
  scenario?: string;
  responsibleComponent?: string;
  triggerReversal?: boolean;
  resolvedState: string | null;
  semanticTags: SemanticTag[];
};

export type AnalysisEvidence = {
  decision: string;
  chosenValue: string;
  reason: string;
  sources: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
};

export type AnalysisConflict = {
  code: string;
  severity: 'ERROR' | 'WARN';
  message: string;
  details?: string[];
};

export type FlowArchetype =
  | 'OUTGOING_SIMPLE_POSTING'
  | 'OUTGOING_SPM_SANCTIONS_BALANCE_CLEARING'
  | 'OUTGOING_BOOK_TRANSFER'
  | 'OUTGOING_CLEARING_REJECTION'
  | 'INCOMING_CLEARING_THEN_POSTING'
  | 'WAREHOUSED_RELEASE_FLOW'
  | 'STOP_PAYMENT_FLOW'
  | 'BUSINESS_VALIDATION_FAILURE';

export type FlowArchetypeMatch = {
  archetype: FlowArchetype;
  score: number;
  reasons: string[];
};

export type AnalysisModel = {
  normalizedRows: NormalizedRow[];
  discoveredStates: Set<string>;
  rawSequences: string[][];
  prunedTransitions: Map<string, Set<string>>;
  lifecycleFlags: {
    hasSpm: boolean;
    hasSanctions: boolean;
    hasBalanceCheck: boolean;
    hasClearing: boolean;
    hasPosting: boolean;
    hasWarehousing: boolean;
    hasBookTransfer: boolean;
    hasIncomingFlow: boolean;
    hasOutgoingFlow: boolean;
  };
  inferredTargets: {
    nextAfterInit?: string;
    postSanctionsTarget?: string;
    balanceTarget?: string;
    warehousedReleaseTarget?: string;
  };
  additionalTerminals: Set<string>;
  conflicts: AnalysisConflict[];
  warnings: AnalysisConflict[];
  evidence: AnalysisEvidence[];
  archetypeMatches: FlowArchetypeMatch[];
};
