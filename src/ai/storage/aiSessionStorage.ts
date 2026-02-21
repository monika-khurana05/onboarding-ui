import type {
  ParsedPain001,
  PojoMappingSheet,
  RequirementsAnalysis,
  SyntheticDataPlan,
  TestScenarioPack
} from '../types';

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

export function saveTestBaseXml(countryCode: string, xml: string): void {
  const key = `ai.tests.${normalizeCountryCode(countryCode)}.baseXml`;
  safeSet(key, xml);
}

export function loadTestBaseXml(countryCode: string): string | null {
  const key = `ai.tests.${normalizeCountryCode(countryCode)}.baseXml`;
  return safeGet<string>(key);
}

export function saveParsedPain001(countryCode: string, parsed: ParsedPain001): void {
  const key = `ai.tests.${normalizeCountryCode(countryCode)}.parsed`;
  safeSet(key, parsed);
}

export function loadParsedPain001(countryCode: string): ParsedPain001 | null {
  const key = `ai.tests.${normalizeCountryCode(countryCode)}.parsed`;
  return safeGet<ParsedPain001>(key);
}

export function saveScenarioPack(countryCode: string, pack: TestScenarioPack): void {
  const key = `ai.tests.${normalizeCountryCode(countryCode)}.scenarioPack`;
  safeSet(key, pack);
}

export function loadScenarioPack(countryCode: string): TestScenarioPack | null {
  const key = `ai.tests.${normalizeCountryCode(countryCode)}.scenarioPack`;
  return safeGet<TestScenarioPack>(key);
}
