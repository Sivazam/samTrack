/**
 * 01 - Authentication Tests
 *
 * Covers:
 * - Admin login redirects to admin dashboard
 * - PRO login redirects to PRO dashboard (shows Leads tab)
 * - Invalid password shows error
 * - Username login (PRO can log in with username, not just email)
 */
import { test, expect } from '@playwright/test';
import { loginAs, TEST_CREDENTIALS } from './helpers/login';

test.describe('Authentication', () => {
  test('admin login → redirects to dashboard with admin controls', async ({ page }) => {
    await loginAs(page, TEST_CREDENTIALS.admin.email, TEST_CREDENTIALS.admin.password);

    // Should be at root and not on /login
    expect(page.url()).not.toContain('/login');

    // Admin dashboard has a "Leads" nav button in desktop horizontal nav
    const nav = page.locator('nav.hidden.md\\:block');
    await expect(nav.getByRole('button', { name: 'Leads' })).toBeVisible({ timeout: 10_000 });
    await expect(nav.getByRole('button', { name: 'Teams' })).toBeVisible();
  });

  test('PRO login → redirects to PRO dashboard with Leads tab', async ({ page }) => {
    await loginAs(page, TEST_CREDENTIALS.pro1.email, TEST_CREDENTIALS.pro1.password);

    expect(page.url()).not.toContain('/login');

    // PRO desktop tab bar has "Leads" and "Reminders" tabs
    const tabBar = page.locator('div.hidden.md\\:block').first();
    await expect(tabBar.getByRole('button', { name: 'Leads' })).toBeVisible({ timeout: 10_000 });
    await expect(tabBar.getByRole('button', { name: 'Reminders' })).toBeVisible();

    // PRO header shows their display name
    await expect(page.getByText(TEST_CREDENTIALS.pro1.displayName)).toBeVisible();
  });

  test('wrong password → shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@email.com or username').fill(TEST_CREDENTIALS.admin.email);
    await page.getByPlaceholder('Enter your password').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Error alert should appear
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 });
    // Still on /login page
    expect(page.url()).toContain('/login');
  });

  test('PRO login with username (not email)', async ({ page }) => {
    await page.goto('/login');
    // Use username "gbalakrishna" instead of email
    await page.getByPlaceholder('you@email.com or username').fill('gbalakrishna');
    await page.getByPlaceholder('Enter your password').fill(TEST_CREDENTIALS.pro1.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should redirect away from /login
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
    expect(page.url()).not.toContain('/login');
  });

  test('already-logged-in user visiting /login → redirected away', async ({ page }) => {
    // First log in
    await loginAs(page, TEST_CREDENTIALS.admin.email, TEST_CREDENTIALS.admin.password);
    expect(page.url()).not.toContain('/login');

    // Navigate to /login while logged in
    await page.goto('/login');
    // Should be redirected back away from /login
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 });
  });
});
