export type DeploymentEnvironment = 'DEV' | 'UAT' | 'PROD';

export function deriveEnvironmentFromApiUrl(apiBaseUrl?: string): DeploymentEnvironment {
  if (!apiBaseUrl) {
    return 'DEV';
  }

  const value = apiBaseUrl.toLowerCase();

  if (value.includes('uat') || value.includes('staging') || value.includes('preprod')) {
    return 'UAT';
  }

  if (
    value.includes('prod') ||
    value.includes('production') ||
    value.includes('.cpx.com') ||
    value.includes('.corp')
  ) {
    return 'PROD';
  }

  return 'DEV';
}

export function environmentChipColor(environment: DeploymentEnvironment): 'success' | 'warning' | 'info' {
  if (environment === 'PROD') {
    return 'warning';
  }
  if (environment === 'UAT') {
    return 'info';
  }
  return 'success';
}
