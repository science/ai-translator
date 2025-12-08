import { test, expect } from '@playwright/test';

test.describe('Initial Routing Based on API Key', () => {
	test.describe('when API key is not configured', () => {
		test.beforeEach(async ({ page }) => {
			// Clear localStorage before each test
			await page.goto('/settings');
			await page.evaluate(() => localStorage.clear());
		});

		test('redirects from home page to settings when API key is empty', async ({ page }) => {
			await page.goto('/');

			// Should redirect to settings
			await expect(page).toHaveURL('/settings');
		});

		test('does not redirect if already on settings page', async ({ page }) => {
			await page.goto('/settings');

			// Should stay on settings
			await expect(page).toHaveURL('/settings');
		});

		test('does not redirect if on api-key-help page', async ({ page }) => {
			await page.goto('/settings/api-key-help');

			// Should stay on help page
			await expect(page).toHaveURL('/settings/api-key-help');
		});

		test('allows direct navigation to workflow without API key', async ({ page }) => {
			// Direct navigation to workflow should work (app shows error when user tries to use it)
			await page.goto('/workflow');

			// Should stay on workflow
			await expect(page).toHaveURL('/workflow');
		});
	});

	test.describe('when API key is configured', () => {
		test.beforeEach(async ({ page }) => {
			// Set up an API key before each test
			await page.goto('/settings');
			await page.evaluate(() => {
				localStorage.setItem('openai_api_key', 'sk-test-key-12345');
			});
		});

		test('redirects from home page to workflow when API key is set', async ({ page }) => {
			await page.goto('/');

			// Should redirect to workflow (One Step Translation)
			await expect(page).toHaveURL('/workflow');
		});

		test('stays on workflow page when API key is set', async ({ page }) => {
			await page.goto('/workflow');

			// Should stay on workflow
			await expect(page).toHaveURL('/workflow');
		});

		test('can still navigate to settings when API key is set', async ({ page }) => {
			await page.goto('/settings');

			// Should stay on settings
			await expect(page).toHaveURL('/settings');
		});

		test('can navigate to other pages when API key is set', async ({ page }) => {
			await page.goto('/convert');

			// Should stay on convert
			await expect(page).toHaveURL('/convert');
		});
	});

	test.describe('sidebar navigation works after redirect', () => {
		test('sidebar is visible and clickable after redirect to workflow', async ({ page }) => {
			// Set up API key and load home page (will redirect to workflow)
			await page.goto('/settings');
			await page.evaluate(() => {
				localStorage.setItem('openai_api_key', 'sk-test-key-12345');
			});
			await page.goto('/');

			// Wait for redirect to complete
			await expect(page).toHaveURL('/workflow');

			// Verify sidebar navigation links are visible
			const convertLink = page.getByRole('link', { name: /convert pdf/i });
			await expect(convertLink).toBeVisible();

			// Use force click to bypass any overlay/stability issues
			await convertLink.click({ force: true });

			// Should navigate to convert page
			await expect(page).toHaveURL('/convert');
		});

		test('sidebar is visible and clickable after redirect to settings', async ({ page }) => {
			// Clear API key and load home page (will redirect to settings)
			await page.goto('/settings');
			await page.evaluate(() => localStorage.clear());
			await page.goto('/');

			// Wait for redirect to complete
			await expect(page).toHaveURL('/settings');

			// Verify sidebar navigation links are visible
			const convertLink = page.getByRole('link', { name: /convert pdf/i });
			await expect(convertLink).toBeVisible();

			// Use force click to bypass any overlay/stability issues
			await convertLink.click({ force: true });

			// Should navigate to convert page
			await expect(page).toHaveURL('/convert');
		});
	});
});
