import { Page, expect } from '@playwright/test';

export const TEST_CREDENTIALS = {
  admin: {
    email: 'admin@samhitha.edu',
    password: 'Admin@123',
  },
  pro1: {
    email: 'gbalakrishna@samhithaedu.com',
    password: 'Samhitha@2025',
    displayName: 'G Bala Krishna',
    teamName: 'Team Rajanagaram',
  },
  pro2: {
    email: 'psuresh@samhithaedu.com',
    password: 'Samhitha@2025',
    displayName: 'P Suresh',
    teamName: 'Team Rajanagaram',
  },
} as const;

// Test lead constants — use IDs unlikely to collide with real data
export const TEST_LEAD = {
  id: '99901',
  parentName: 'E2E Test Parent',
  studentName: 'E2E Test Student',
  divisionLabel: 'RAJANAGARAM', // visible text in the area dropdown
} as const;

/**
 * Navigate to /login, fill in credentials, and wait for redirect to /.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('you@email.com or username').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  // Wait until we're no longer on /login (redirect to dashboard)
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 20_000,
  });
}

/**
 * Click the admin horizontal nav button for a given section label.
 * Works on Desktop Chrome (md+ viewport where horizontal nav is visible).
 */
export async function adminNavTo(page: Page, label: string): Promise<void> {
  // Desktop horizontal nav (hidden md:block)
  const nav = page.locator('nav.hidden.md\\:block');
  await nav.getByRole('button', { name: label }).click();
  // Small settle time for animations
  await page.waitForTimeout(400);
}

/**
 * Click the PRO desktop tab bar button for a given label.
 * Works on Desktop Chrome (md+ viewport).
 */
export async function proNavTo(page: Page, label: string): Promise<void> {
  // Desktop tab bar (hidden md:block)
  // Use regex to match buttons even when a badge count is appended (e.g. "Reminders 2")
  const tabBar = page.locator('div.hidden.md\\:block');
  await tabBar.getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first().click();
  await page.waitForTimeout(400);
}
