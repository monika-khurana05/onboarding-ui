import { expect, test } from '@playwright/test';

const snapshotPayload = {
  countryCode: 'CA',
  region: 'Americas',
  capabilities: [
    { capabilityKey: 'PAYMENT_INITIATION', enabled: true },
    { capabilityKey: 'PAYMENT_ORCHESTRATION', enabled: true },
    { capabilityKey: 'CLIENT_ONBOARDING', enabled: false },
    { capabilityKey: 'SANCTIONS', enabled: true },
    { capabilityKey: 'LIQUIDITY', enabled: false },
    { capabilityKey: 'DATA', enabled: false },
    { capabilityKey: 'REFERENCE_DATA', enabled: false },
    { capabilityKey: 'POSTING', enabled: true },
    { capabilityKey: 'CLEARING', enabled: true },
    { capabilityKey: 'PLATFORM_RESILIENCY', enabled: true },
    { capabilityKey: 'DEVOPS_MAINTENANCE', enabled: false },
    { capabilityKey: 'DATABASE_UTILITIES', enabled: false },
    { capabilityKey: 'SRE_OBSERVABILITY', enabled: false }
  ],
  validations: [],
  enrichments: [],
  actions: [],
  workflow: {
    workflowKey: 'PAYMENT_INGRESS',
    states: ['RECEIVED', 'VALIDATED', 'CLEARED'],
    transitions: [
      { from: 'RECEIVED', to: 'VALIDATED', onEvent: 'VALIDATE' },
      { from: 'VALIDATED', to: 'CLEARED', onEvent: 'CLEAR' }
    ]
  },
  integrationConfig: {},
  deploymentOverrides: {}
};

test('dashboard to create snapshot smoke flow', async ({ page }) => {
  await page.route('**/repo-defaults', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        repos: [
          { slug: 'state-manager', defaultRef: 'main' },
          { slug: 'payment-initiation', defaultRef: 'main' },
          { slug: 'country-container', defaultRef: 'main' }
        ]
      })
    })
  );

  await page.route('**/snapshots', (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ snapshotId: 'snap-001', version: 1 })
    });
  });

  await page.route('**/snapshots/snap-001**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        snapshotId: 'snap-001',
        version: 1,
        createdAt: '2026-02-08T00:00:00Z',
        payload: snapshotPayload
      })
    })
  );

  await page.goto('/');

  await expect(page.getByText('CPX Country Onboarding')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();

  await page.getByRole('link', { name: 'Create Snapshot' }).click();
  await expect(page.getByRole('heading', { name: 'Create Snapshot Wizard' })).toBeVisible();

  await page.getByLabel('Country Code').fill('CA');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Loading repo defaults...')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('button', { name: 'Save Snapshot' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save Snapshot' }).click();

  await expect(page).toHaveURL(/snapshots\/snap-001/);
  await expect(page.getByText('Snapshot Details')).toBeVisible();
});
