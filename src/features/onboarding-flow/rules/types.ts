export type CapabilityParamConstraints = {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enumValues?: string[];
};

export type CapabilityParamUi = {
  label?: string;
  input?: string;
  helperText?: string;
};

export type ParamDefDto = {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  constraints?: CapabilityParamConstraints;
  ui?: CapabilityParamUi;
};

export type CapabilityKind = 'VALIDATION' | 'ENRICHMENT';

export type CapabilityDto = {
  id: string;
  kind: CapabilityKind;
  name: string;
  description: string;
  stage?: string;
  orderHint?: number;
  dependencies?: string[];
  params: ParamDefDto[];
};

export type CapabilityMetadataProducer = {
  system: string;
  artifact: string;
  version: string;
};

export type CapabilityMetadataDto = {
  schemaVersion: string;
  producer: CapabilityMetadataProducer;
  generatedAt: string;
  capabilities: CapabilityDto[];
};
