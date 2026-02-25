export type WorkspaceClassification =
  | 'GLOBAL_CLONE'
  | 'GLOBAL_CONFIG'
  | 'GLOBAL_MODIFY'
  | 'NET_NEW'
  | 'OUT_OF_SCOPE'
  | string;

export type MappingSummaryItem = {
  country_requirement_id: string;
  classification: WorkspaceClassification;
  country_requirement_description: string;
  weighted_similarity_score?: number;
  confidence_score?: number;
  matched_global_capability_id?: string;
  matched_global_capability_description?: string;
  comparison_breakdown?: Record<string, number>;
  reasoning?: string;
};

export type MappingSummaryJson = {
  classification_results: MappingSummaryItem[];
};

export type OpenQuestion = {
  id: string; // stable id like Q-001
  question: string;
  context?: string; // optional extracted "Point: ..."
  answer?: string; // filled by UI
};

export type WorkspaceArtifactsBundle = {
  meta: {
    countryCode: string;
    region: string;
    flow: 'INCOMING' | 'OUTGOING';
    uploadedAtIso: string;
  };

  files: {
    mappingSummary?: { fileName: string; raw: string; json: MappingSummaryJson };
    overallSummary?: { fileName: string; raw: string; markdown: string };
    gapAnalysis?: { fileName: string; raw: string; markdown: string };
    openQuestions?: { fileName: string; raw: string; markdown: string; questions: OpenQuestion[] };
  };
};
