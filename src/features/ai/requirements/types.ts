import { CapabilityId } from './capabilities';

export type RequirementDocSource = {
  id: string; // "AR-REG-001"
  label: string; // "Argentina Instant Payments Spec (Mock)"
  countryCode: string; // "AR"
  type: 'PDF' | 'DOCX' | 'EMAIL' | 'JIRA' | 'TEXT' | 'HTML';
  tags: string[]; // ["regulatory", "instant-payments"]
  mockContentKey: string; // used to fetch mock content (no real file parsing)
  origin?: 'PRESET' | 'UPLOADED';
};

export type ExtractedRequirement = {
  id: string; // "AR-REQ-001"
  category: 'Validation' | 'Enrichment' | 'Workflow' | 'Routing' | 'Compliance' | 'Data' | 'Other';
  priority: 'MUST' | 'SHOULD' | 'MAY';
  title: string;
  description: string;

  suggestedCapabilities: CapabilityId[]; // multi-cap mapping
  confidence: number; // 0-100
  evidence: { docId: string; cite: string; snippet?: string }[]; // docId + "p.12" or "section 3.1"

  openQuestions: string[];
};
