export type DemoMeta = {
  mode: 'DEMO_PREVIEW';
  provider: 'R2D2_PENDING';
  generatedAt: string;
  countryCode?: string;
  sheetId?: string;
  sourceDocuments?: Array<{ id: string; title: string; type: string }>;
};

export type RequirementsAnalysis = {
  meta: DemoMeta;
  summary: {
    headline: string;
    impact: {
      discoveryTimeReductionPct: number;
      manualErrorReductionPct: number;
      reuseOpportunityPct: number;
    };
  };
  suggestedDomainCapabilities: Array<{
    capabilityKey: string;
    confidence: number;
    reason: string;
  }>;
  requirements: Array<{
    id: string;
    category: 'Validation' | 'Enrichment' | 'Workflow' | 'Other';
    priority: 'MUST' | 'SHOULD' | 'MAY';
    text: string;
    confidence: number;
    evidence: Array<{ docId: string; excerpt: string; pageHint?: string }>;
    suggestions: {
      validations: Array<{
        catalogId: string;
        existsInCatalog: boolean;
        changeType: 'CONFIG_ONLY' | 'NEW_CATALOG_ITEM' | 'CODE_CHANGE';
        proposedConfig?: any;
      }>;
      enrichments: Array<{
        catalogId: string;
        existsInCatalog: boolean;
        changeType: 'CONFIG_ONLY' | 'NEW_CATALOG_ITEM' | 'CODE_CHANGE';
        proposedConfig?: any;
      }>;
    };
    openQuestions: Array<{ id: string; text: string; owner?: string; status: 'OPEN' | 'CLOSED' }>;
  }>;
  fsmSuggestions?: {
    confidence: number;
    notes: string;
    proposedTransitions: Array<{ from: string; event: string; to: string; actions: string[] }>;
  };
  traceability?: {
    repoImpact: Array<{ repo: string; type: 'CONFIG' | 'CODE' | 'DOC'; reason: string }>;
    testCases: Array<{ id: string; type: 'SMOKE' | 'NEGATIVE'; title: string; steps: string[]; expected: string }>;
  };
};

export type PojoMappingSheet = {
  meta: DemoMeta & { sheetId: string };
  summary: {
    headline: string;
    confidence: number;
    stats: { rows: number; directMappings: number; transformations: number; needsSMEReview: number };
  };
  rows: Array<{
    description: string;
    inputPain001v6Field: string;
    outputFndtMessage: string;
    ccapiJsonTags: string[];
    xpayCanonicalPojoMapping: string;
    transformation: string;
    logic: string;
    sampleValue: string;
    confidence: number;
    openQuestion?: string | null;
  }>;
};

export type SyntheticDataPlan = {
  meta: DemoMeta;
  summary: {
    headline: string;
    confidence: number;
    impact: { testingCycleTimeReductionPct: number; coverageNote: string };
  };
  maskingPolicy: {
    principles: string[];
    rules: Array<{ fieldPath: string; method: string; params?: any }>;
  };
  scenarios: Array<{
    scenarioId: string;
    type: 'POSITIVE' | 'NEGATIVE';
    title: string;
    inputs: any;
    expected: any;
  }>;
};

export type ParsedPain001 = {
  messageType: string;
  groupHeader: {
    msgId: string | null;
    creDtTm: string | null;
    nbOfTxs: string | null;
    ctrlSum: string | null;
    initgPtyNm: string | null;
  };
  paymentInfo: {
    pmtInfId: string | null;
    pmtMtd: string | null;
    svcLvlCd: string | null;
    lclInstrmPrtry: string | null;
    reqdExctnDt: string | null;
  };
  debtor: {
    name: string | null;
    accountId: string | null;
    accountTypeCd: string | null;
  };
  creditor: {
    name: string | null;
    postalAdrLine: string | null;
    accountId: string | null;
    accountTypeCd: string | null;
  };
  creditorAgent: {
    clrSysMmbId: string | null;
    othrId: string | null;
    brcId: string | null;
    othrSchemeCd: string | null;
  };
  currency: string | null;
};

export type SampleMessage = {
  sampleId: string;
  xml: string;
  parsed: ParsedPain001;
};

export type TestScenario = {
  scenarioId: string;
  title: string;
  type: 'POSITIVE' | 'NEGATIVE';
  mutations: string[];
  expectedOutcome: {
    state: 'ACCEPTED' | 'REJECTED' | 'NEEDS_ENRICHMENT';
    errorCode?: string;
    notes?: string;
  };
  xmlVariant: string;
  extractedFieldsSnapshot: ParsedPain001;
  sourceSampleId?: string;
};

export type TestScenarioPack = {
  meta: {
    countryCode?: string;
    generatedAt: string;
    baseMessageType?: string;
    flow?: 'INCOMING' | 'OUTGOING';
  };
  baseXml: string;
  parsed: ParsedPain001;
  samples?: SampleMessage[];
  scenarios: TestScenario[];
  options: {
    happyPath: boolean;
    missingMandatory: boolean;
    invalidFormats: boolean;
    duplicate: boolean;
    cutoff: boolean;
    creditorAgentVariations: boolean;
  };
};

export type AiSuggestionStatus = 'pending' | 'applied' | 'ignored' | 'question';

export type AiSuggestionType = 'capability' | 'validation' | 'enrichment' | 'workflow';

export type AiPreviewTab = 'requirements' | 'mapping' | 'synthetic' | 'traceability';

export type AiDrawerScrollTarget = 'requirements' | 'capabilities' | 'rules' | 'workflow' | null;
