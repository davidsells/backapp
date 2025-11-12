import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('/');
  });

  test('should display login page with correct elements', async ({ page }) => {
    // Check for key UI elements
    await expect(page).toHaveTitle(/BackApp/i);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation error for weak password', async ({ page }) => {
    // Navigate to registration page
    await page.getByRole('link', { name: /sign up/i }).click();

    // Fill in form with weak password
    await page.getByLabel(/name/i).fill('Test User');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/^password$/i).fill('weak'); // Too short, no uppercase, no numbers

    // Try to submit
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should show validation error
    await expect(page.getByText(/password must be at least 12 characters/i)).toBeVisible();
  });

  test('should successfully register new user with strong password', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `test-${timestamp}@example.com`;

    // Navigate to registration page
    await page.getByRole('link', { name: /sign up/i }).click();

    // Fill in form with strong password
    await page.getByLabel(/name/i).fill('E2E Test User');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/^password$/i).fill('SecurePassword123');

    // Submit form
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should redirect to login or show success message
    // (Exact behavior depends on requireApproval setting)
    await expect(page).toHaveURL(/\/(login|dashboard)/);
  });

  test('should login with valid credentials', async ({ page }) => {
    // This test assumes a user exists in the test database
    // In a real scenario, you'd create a user in beforeEach or use a test fixture

    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('AdminPassword123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('WrongPassword123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error message (stay on login page or show error toast)
    await expect(page.getByText(/invalid.*credentials/i).or(page.getByText(/sign in failed/i))).toBeVisible();
  });

  test('should enforce password complexity requirements', async ({ page }) => {
    await page.getByRole('link', { name: /sign up/i }).click();

    const testCases = [
      { password: 'short', error: /at least 12 characters/i },
      { password: 'nouppercase123', error: /uppercase/i },
      { password: 'NOLOWERCASE123', error: /lowercase/i },
      { password: 'NoNumbers', error: /numbers/i },
    ];

    for (const testCase of testCases) {
      await page.getByLabel(/^password$/i).fill(testCase.password);
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page.getByText(testCase.error)).toBeVisible();

      // Clear for next iteration
      await page.getByLabel(/^password$/i).clear();
    }
  });
});

test.describe('Authenticated User Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('AdminPassword123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display dashboard with navigation', async ({ page }) => {
    // Check dashboard loads
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Check navigation elements
    await expect(page.getByRole('link', { name: /agents/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /configurations/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /backups/i })).toBeVisible();
  });

  test('should navigate to agents page', async ({ page }) => {
    await page.getByRole('link', { name: /agents/i }).click();
    await expect(page).toHaveURL(/\/agents/);
    await expect(page.getByRole('heading', { name: /agents/i })).toBeVisible();
  });

  test('should allow user to logout', async ({ page }) => {
    // Find and click logout button (adjust selector as needed)
    await page.getByRole('button', { name: /sign out/i }).or(page.getByText(/logout/i)).click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/(login|$)/);
  });
});
