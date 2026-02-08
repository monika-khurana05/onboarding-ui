import { expect, test } from '@playwright/test';

test('core navigation and onboarding smoke flow', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('CPX Country Onboarding')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();

  await page.getByRole('link', { name: 'Create Snapshot' }).click();
  await expect(page.getByRole('heading', { name: 'Create Snapshot Wizard' })).toBeVisible();

  await page.getByLabel('Country Code').fill('CA');
  await page.getByLabel('Country Name').fill('Canada');
  await page.getByLabel('Legal Entity').fill('CPX Canada Ltd');
  await page.getByLabel('Requested By').fill('ops@cpx.com');
  await page.getByRole('button', { name: 'Create Snapshot' }).click();

  await expect(page.getByText(/VITE_API_BASE_URL is not configured/i)).toBeVisible();
});
