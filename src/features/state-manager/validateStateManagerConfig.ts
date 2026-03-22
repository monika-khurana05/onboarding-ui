import type { StateManagerConfig } from './types';

export function validateStateManagerConfig(config: StateManagerConfig): string[] {
  const errors: string[] = [];
  const countryCode = config.countryCode.trim().toUpperCase();

  if (!countryCode) {
    errors.push('Country code is required before saving scenarios.');
  }

  if (config.flowDirection !== 'INCOMING' && config.flowDirection !== 'OUTGOING') {
    errors.push('Flow direction is required before saving scenarios.');
  }

  if (config.scenarios.length === 0) {
    errors.push('Add at least one scenario before saving.');
    return errors;
  }

  config.scenarios.forEach((scenario, scenarioIndex) => {
    const scenarioLabel = scenario.name.trim() || `Scenario ${scenarioIndex + 1}`;
    if (scenario.subFlows.length === 0) {
      errors.push(`"${scenarioLabel}" must include at least one sub-flow before saving.`);
      return;
    }

    scenario.subFlows.forEach((subFlow, subFlowIndex) => {
      const subFlowLabel = subFlow.title.trim() || `Sub-flow ${subFlowIndex + 1}`;
      if (subFlow.rows.length === 0) {
        errors.push(`"${scenarioLabel}" / "${subFlowLabel}" must include at least one row before saving.`);
      }
    });
  });

  return errors;
}
