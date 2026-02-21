import type { RequirementsAnalysis, PojoMappingSheet, SyntheticDataPlan } from '../types';

const requirementsCache = new Map<string, RequirementsAnalysis>();
const mappingCache = new Map<string, PojoMappingSheet>();
const syntheticCache = new Map<string, SyntheticDataPlan>();
let kafkaSampleCache: string | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) {
    throw new Error(`Failed to load mock AI JSON: ${path}`);
  }
  return (await res.json()) as T;
}

async function fetchText(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load mock AI text: ${path}`);
  }
  return await res.text();
}

export const mockAiService = {
  async getRequirementsAnalysis(countryCode: string): Promise<RequirementsAnalysis> {
    const cc = (countryCode || 'AR').trim().toLowerCase();
    if (requirementsCache.has(cc)) {
      return requirementsCache.get(cc) as RequirementsAnalysis;
    }
    const data = await fetchJson<RequirementsAnalysis>(`/mock-ai/requirements-analysis.${cc}.json`);
    requirementsCache.set(cc, data);
    return data;
  },
  async getPojoMappingSheet(sheetId: string): Promise<PojoMappingSheet> {
    const id = (sheetId || 'xpay-canonical-v1').trim();
    if (mappingCache.has(id)) {
      return mappingCache.get(id) as PojoMappingSheet;
    }
    const data = await fetchJson<PojoMappingSheet>(`/mock-ai/pojo-mapping.${id}.json`);
    mappingCache.set(id, data);
    return data;
  },
  async getSyntheticDataPlan(countryCode: string): Promise<SyntheticDataPlan> {
    const cc = (countryCode || 'AR').trim().toLowerCase();
    if (syntheticCache.has(cc)) {
      return syntheticCache.get(cc) as SyntheticDataPlan;
    }
    const data = await fetchJson<SyntheticDataPlan>(`/mock-ai/synthetic-data.${cc}.json`);
    syntheticCache.set(cc, data);
    return data;
  },
  async getKafkaPain001Sample(): Promise<string> {
    if (kafkaSampleCache) {
      return kafkaSampleCache;
    }
    const data = await fetchText('/mock-ai/kafka/pain001.sample.xml');
    kafkaSampleCache = data;
    return data;
  }
};
