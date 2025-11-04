import { test, expect } from '@playwright/test';

test('homepage displays correctly', async ({ page }) => {
  await page.goto('/');

  // Expect page title to contain "Backup System"
  await expect(page.locator('h1')).toContainText('Backup System');

  // Expect login and register links to be visible
  await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
});
