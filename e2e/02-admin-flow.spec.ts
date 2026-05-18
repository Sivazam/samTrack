/**
 * 02 - Admin Dashboard Flow
 *
 * Covers:
 * - Admin sees stats (Total Leads, teams listed, etc.)
 * - Admin creates a test lead via the Add Lead form
 * - Created lead appears in the Leads list
 * - Admin can view Teams tab and see existing teams
 * - Admin can view Reminders tab
 *
 * NOTE: Tests run serially because later tests depend on the created lead.
 * Lead ID 99901 is used as the test lead. If it already exists from a prior run,
 * the create test handles it gracefully.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAs, adminNavTo, TEST_CREDENTIALS, TEST_LEAD } from './helpers/login';

// All tests in this file share an admin-logged-in page session
let adminPage: Page;

test.describe.serial('Admin Dashboard Flow', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    adminPage = await context.newPage();
    await loginAs(adminPage, TEST_CREDENTIALS.admin.email, TEST_CREDENTIALS.admin.password);
  });

  test.afterAll(async () => {
    await adminPage.context().close();
  });

  test('admin dashboard loads with stat cards', async () => {
    // Should be on home/overview tab showing stat cards
    // "Total Leads" stat card text should be visible
    await expect(adminPage.getByText('Total Leads')).toBeVisible({ timeout: 15_000 });
  });

  test('navigate to Leads tab', async () => {
    await adminNavTo(adminPage, 'Leads');
    // The search bar should appear (it's in the Leads list view)
    await expect(adminPage.getByPlaceholder(/search/i)).toBeVisible({ timeout: 10_000 });
  });

  test('create test lead #99901 via Add Lead form', async () => {
    // Round green '+' button opens the AddLeadForm dialog
    // It's the first emerald/green circular button in the toolbar
    const addBtn = adminPage.locator('button.rounded-full').filter({
      has: adminPage.locator('svg'),
    }).first();
    await addBtn.click();

    // Dialog should open
    await expect(adminPage.getByText('Add New Lead')).toBeVisible({ timeout: 5_000 });

    // Check if the lead already exists (from a previous test run); if so, cancel
    // We'll just fill in the form and handle the "already exists" error gracefully
    await adminPage.getByPlaceholder('e.g., 12345').fill(TEST_LEAD.id);
    await adminPage.locator('label:has-text("Parent Name") + input').fill(TEST_LEAD.parentName);
    await adminPage.locator('label:has-text("Student Name") + input').fill(TEST_LEAD.studentName);

    // Select area — find the combobox that shows "Select area..." text
    await adminPage.locator('[role="combobox"]').filter({ hasText: /Select area/i }).click();
    // Pick RAJANAGARAM from the dropdown
    await adminPage.getByRole('option', { name: /RAJANAGARAM/i }).click();

    // Submit
    await adminPage.getByRole('button', { name: 'Add Lead' }).click();

    // Either success toast OR "already exists" error — both are acceptable
    const successOrError = adminPage.locator(
      'text=/Lead added successfully|already exists/i'
    );
    await expect(successOrError).toBeVisible({ timeout: 15_000 });

    // If the "already exists" error appeared, close the dialog
    const alreadyExists = adminPage.locator('text=/already exists/i');
    if (await alreadyExists.isVisible()) {
      await adminPage.getByRole('button', { name: 'Cancel' }).click();
    }
  });

  test('test lead #99901 appears in Leads list', async () => {
    // The lead list might need a moment to refresh
    await adminPage.waitForTimeout(1000);

    // Search for the test lead by parent name
    await adminPage.getByPlaceholder(/search/i).fill(TEST_LEAD.parentName);
    await expect(
      adminPage.getByText(TEST_LEAD.parentName)
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      adminPage.getByText(TEST_LEAD.studentName)
    ).toBeVisible();

    // Clear search
    await adminPage.getByPlaceholder(/search/i).clear();
  });

  test('navigate to Teams tab and see team list', async () => {
    await adminNavTo(adminPage, 'Teams');

    // The 9 teams should be visible
    await expect(adminPage.getByText('Team Rajanagaram')).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText('Team Gokavaram')).toBeVisible();
    await expect(adminPage.getByText('Team Kovvur')).toBeVisible();
    await expect(adminPage.getByText('Team L-Division')).toBeVisible();
  });

  test('navigate to Reminders tab', async () => {
    // Reminders is in the "More" section — click it from horizontal nav
    await adminNavTo(adminPage, 'Reminders');

    // The Reminders view should load — look for the section heading
    await expect(
      adminPage.getByRole('heading', { name: /Reminders/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
