/**
 * 03 - PRO Dashboard & Status Update Flow
 *
 * Covers:
 * - PRO sees assigned leads in the Leads tab
 * - PRO opens a lead (LeadDetailView)
 * - PRO clicks "Log Update", fills the form, submits (CONTACTED via PHONE)
 * - Status badge on the lead card reflects the new status
 * - PRO selects JOINED_SAMHITHA → college field auto-selects Samhitha option
 *
 * Prerequisites:
 * - Test lead #99901 exists in RAJANAGARAM area (created in test 02)
 *   and assigned to Team Rajanagaram (G Bala Krishna = pro1)
 */
import { test, expect, Page } from '@playwright/test';
import { loginAs, proNavTo, TEST_CREDENTIALS, TEST_LEAD } from './helpers/login';

let proPage: Page;

test.describe.serial('PRO Status Update Flow', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    proPage = await context.newPage();
    await loginAs(proPage, TEST_CREDENTIALS.pro1.email, TEST_CREDENTIALS.pro1.password);
  });

  test.afterAll(async () => {
    await proPage.context().close();
  });

  test('PRO Leads tab shows assigned leads', async () => {
    // PRO dashboard default tab is 'leads'
    await proNavTo(proPage, 'Leads');

    // There should be at least some leads (from RAJANAGARAM / RANGAMPETA)
    // Wait for the Leads tab content to load
    await proPage.waitForTimeout(2000); // Let Firestore snapshot load

    // Look for the "Total" leads stat or a lead card
    // The leads count stat is shown in the PRO summary section
    const leadsContent = proPage.locator('text=/My Leads|Leads|leads/i').first();
    await expect(leadsContent).toBeVisible({ timeout: 15_000 });
  });

  test('PRO finds test lead #99901 (E2E Test Parent)', async () => {
    await proNavTo(proPage, 'Leads');

    // Search for the test lead
    const searchInput = proPage.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill(TEST_LEAD.parentName);

    // Lead card should appear
    await expect(proPage.getByText(TEST_LEAD.parentName)).toBeVisible({ timeout: 10_000 });
    await expect(proPage.getByText(TEST_LEAD.studentName)).toBeVisible();
  });

  test('PRO opens lead detail view', async () => {
    // Click on the lead card to open LeadDetailView
    await proPage.getByText(TEST_LEAD.parentName).first().click();

    // LeadDetailView should open — "Log Update" button should be visible
    await expect(proPage.getByRole('button', { name: /Log Update/i })).toBeVisible({ timeout: 10_000 });
    await expect(proPage.getByRole('button', { name: /Set Reminder/i })).toBeVisible();
  });

  test('PRO logs WAITING EAMCET status update via PHONE', async () => {
    // Click "Log Update"
    await proPage.getByRole('button', { name: /Log Update/i }).click();

    // LogStatusUpdateForm dialog opens
    await expect(proPage.getByText(/Log Status Update/i)).toBeVisible({ timeout: 5_000 });

    // approachType defaults to PHONE — no need to change it

    // Select status: WAITING_EAMCET — Status is the 2nd combobox in the dialog (Approach=0, Status=1)
    const logDialog = proPage.getByRole('dialog', { name: /Log Status Update/i });
    await logDialog.locator('[role="combobox"]').nth(1).click();
    await proPage.getByRole('option', { name: /Waiting EAMCET/i }).first().click();

    // Add a comment
    await proPage.getByPlaceholder('Add any notes...').fill('E2E test - waiting for EAMCET results');

    // Submit
    await proPage.getByRole('button', { name: 'Log Update' }).click();

    // Form should close (dialog gone)
    await expect(proPage.getByText(/Log Status Update/i)).not.toBeVisible({ timeout: 15_000 });
  });

  test('lead card reflects updated status', async () => {
    // Wait for Firestore update
    await proPage.waitForTimeout(1500);

    // The lead should now show updated status badge
    const statusBadge = proPage.locator('text=/Waiting EAMCET|WAITING/i').first();
    await expect(statusBadge).toBeVisible({ timeout: 10_000 });
  });

  test('JOINED_SAMHITHA status auto-selects Samhitha college', async () => {
    // Open Log Update again
    await proPage.getByRole('button', { name: /Log Update/i }).click();
    await expect(proPage.getByText(/Log Status Update/i)).toBeVisible({ timeout: 5_000 });

    // approachType defaults to PHONE — no need to change it

    // Select JOINED_SAMHITHA — Status is the 2nd combobox in the dialog (Approach=0, Status=1)
    const logDialog2 = proPage.getByRole('dialog', { name: /Log Status Update/i });
    await logDialog2.locator('[role="combobox"]').nth(1).click();
    const joinedSamhithaOption = proPage.getByRole('option', { name: /Joined Samhitha/i }).first();
    await expect(joinedSamhithaOption).toBeVisible({ timeout: 5_000 });
    await joinedSamhithaOption.click();

    // The college dropdown should auto-select a Samhitha option
    // It should NOT show the "Select college..." placeholder
    const collegeTrigger = proPage.locator('[role="combobox"]').filter({ hasText: /select college|samhitha/i }).first();

    // Wait for the auto-select effect to run
    await proPage.waitForTimeout(500);

    // The college field value should not be "Select college..."
    const collegeValue = await collegeTrigger.textContent();
    expect(collegeValue?.toLowerCase()).not.toContain('select college');
    expect(collegeValue?.toLowerCase()).not.toBe('');

    // Cancel without submitting
    await proPage.getByRole('button', { name: 'Cancel' }).click();
  });
});
