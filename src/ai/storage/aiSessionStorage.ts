import type {
  ParsedPain001,
  PojoMappingSheet,
  RequirementsAnalysis,
  SyntheticDataPlan,
  TestScenarioPack
} from '../types';

export type KafkaPublishConfig = {
  clusterAlias: string;
  topicName: string;
  messageKey?: string;
  executionId?: string;
  lastPublishedAt?: string;
};

export type TestSampleXml = {
  id: string;
  xml: string;
};

function safeSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save AI session data for ${key}.`, error);
  }
}

function safeGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to load AI session data for ${key}.`, error);
    localStorage.removeItem(key);
    return null;
  }
}

function normalizeCountryCode(countryCode: string) {
  return countryCode.trim().toUpperCase();
}

function normalizeFlow(flow?: string) {
  return flow ? flow.trim().toUpperCase() : undefined;
}

function buildTestKey(countryCode: string, flow: string | undefined, suffix: string) {
  const normalizedCountry = normalizeCountryCode(countryCode);
  const normalizedFlow = normalizeFlow(flow);
  return normalizedFlow ? `ai.tests.${normalizedCountry}.${normalizedFlow}.${suffix}` : `ai.tests.${normalizedCountry}.${suffix}`;
}

function normalizeSheetId(sheetId: string) {
  return sheetId.trim();
}

export function saveRequirementsAnalysis(countryCode: string, data: RequirementsAnalysis): void {
  const key = `ai.requirements.${normalizeCountryCode(countryCode)}`;
  safeSet(key, data);
}

export function loadRequirementsAnalysis(countryCode: string): RequirementsAnalysis | null {
  const key = `ai.requirements.${normalizeCountryCode(countryCode)}`;
  return safeGet<RequirementsAnalysis>(key);
}

export function savePojoMapping(sheetId: string, data: PojoMappingSheet): void {
  const key = `ai.mapping.${normalizeSheetId(sheetId)}`;
  safeSet(key, data);
}

export function loadPojoMapping(sheetId: string): PojoMappingSheet | null {
  const key = `ai.mapping.${normalizeSheetId(sheetId)}`;
  return safeGet<PojoMappingSheet>(key);
}

export function saveTestPlan(countryCode: string, data: SyntheticDataPlan): void {
  const key = `ai.tests.${normalizeCountryCode(countryCode)}`;
  safeSet(key, data);
}

export function loadTestPlan(countryCode: string): SyntheticDataPlan | null {
  const key = `ai.tests.${normalizeCountryCode(countryCode)}`;
  return safeGet<SyntheticDataPlan>(key);
}

export function saveTestBaseXml(countryCode: string, xml: string, flow?: string): void {
  const key = buildTestKey(countryCode, flow, 'baseXml');
  safeSet(key, xml);
}

export function loadTestBaseXml(countryCode: string, flow?: string): string | null {
  const key = buildTestKey(countryCode, flow, 'baseXml');
  const value = safeGet<string>(key);
  if (value) {
    return value;
  }
  if (flow) {
    const legacyKey = `ai.tests.${normalizeCountryCode(countryCode)}.baseXml`;
    return safeGet<string>(legacyKey);
  }
  return value;
}

export function saveTestSampleXmls(countryCode: string, samples: TestSampleXml[], flow?: string): void {
  const key = buildTestKey(countryCode, flow, 'samples');
  safeSet(key, samples);
}

export function loadTestSampleXmls(countryCode: string, flow?: string): TestSampleXml[] | null {
  const key = buildTestKey(countryCode, flow, 'samples');
  const value = safeGet<TestSampleXml[]>(key);
  if (value && value.length) {
    return value;
  }
  if (flow) {
    const legacyKey = `ai.tests.${normalizeCountryCode(countryCode)}.samples`;
    return safeGet<TestSampleXml[]>(legacyKey);
  }
  return value;
}

export function saveParsedPain001(countryCode: string, parsed: ParsedPain001, flow?: string): void {
  const key = buildTestKey(countryCode, flow, 'parsed');
  safeSet(key, parsed);
}

export function loadParsedPain001(countryCode: string, flow?: string): ParsedPain001 | null {
  const key = buildTestKey(countryCode, flow, 'parsed');
  const value = safeGet<ParsedPain001>(key);
  if (value) {
    return value;
  }
  if (flow) {
    const legacyKey = `ai.tests.${normalizeCountryCode(countryCode)}.parsed`;
    return safeGet<ParsedPain001>(legacyKey);
  }
  return value;
}

export function saveScenarioPack(countryCode: string, pack: TestScenarioPack, flow?: string): void {
  const key = buildTestKey(countryCode, flow, 'scenarioPack');
  safeSet(key, pack);
}

export function loadScenarioPack(countryCode: string, flow?: string): TestScenarioPack | null {
  const key = buildTestKey(countryCode, flow, 'scenarioPack');
  const value = safeGet<TestScenarioPack>(key);
  if (value) {
    return value;
  }
  if (flow) {
    const legacyKey = `ai.tests.${normalizeCountryCode(countryCode)}.scenarioPack`;
    return safeGet<TestScenarioPack>(legacyKey);
  }
  return value;
}

export function saveKafkaPublishConfig(countryCode: string, config: KafkaPublishConfig, flow?: string): void {
  const key = buildTestKey(countryCode, flow, 'kafkaConfig');
  safeSet(key, config);
}

export function loadKafkaPublishConfig(countryCode: string, flow?: string): KafkaPublishConfig | null {
  const key = buildTestKey(countryCode, flow, 'kafkaConfig');
  const value = safeGet<KafkaPublishConfig>(key);
  if (value) {
    return value;
  }
  if (flow) {
    const legacyKey = `ai.tests.${normalizeCountryCode(countryCode)}.kafkaConfig`;
    return safeGet<KafkaPublishConfig>(legacyKey);
  }
  return value;
}

export function saveLastPrimarySampleId(countryCode: string, flow: string, sampleId: string | null): void {
  const key = buildTestKey(countryCode, flow, 'lastPrimarySampleId');
  safeSet(key, sampleId);
}

export function loadLastPrimarySampleId(countryCode: string, flow: string): string | null {
  const key = buildTestKey(countryCode, flow, 'lastPrimarySampleId');
  return safeGet<string>(key);
}
