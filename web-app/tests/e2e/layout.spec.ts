import { test, expect } from '@playwright/test';

test.describe('App Layout', () => {
	test.describe('base path navigation', () => {
		// These tests verify that navigation links work correctly with SvelteKit's base path.
		// In dev mode, base is empty. In production, base is '/ai-translator'.
		// The fix ensures links use {base} prefix so they work in both environments.

		test('navigation links have href attributes that match their destinations', async ({ page }) => {
			await page.goto('/');

			// Get all navigation links and verify their hrefs
			const navLinks = [
				{ name: /upload/i, expectedPath: '/' },
				{ name: /convert pdf/i, expectedPath: '/convert' },
				{ name: /cleanup/i, expectedPath: '/cleanup' },
				{ name: /translate/i, expectedPath: '/translate' },
				{ name: /my documents/i, expectedPath: '/documents' },
				{ name: /settings/i, expectedPath: '/settings' }
			];

			for (const { name, expectedPath } of navLinks) {
				const link = page.getByRole('link', { name });
				const href = await link.getAttribute('href');
				// href should end with the expected path (base prefix may vary)
				expect(href).toMatch(new RegExp(`${expectedPath}$`));
			}
		});

	});

	test('displays the header with app title', async ({ page }) => {
		await page.goto('/');

		const header = page.locator('header');
		await expect(header).toBeVisible();
		await expect(header).toContainText('Book Translate');
	});

	test('displays the sidebar with navigation items', async ({ page }) => {
		await page.goto('/');

		const sidebar = page.locator('nav[aria-label="Main navigation"]');
		await expect(sidebar).toBeVisible();

		// Check for navigation links
		await expect(page.getByRole('link', { name: /upload/i })).toBeVisible();
		await expect(page.getByRole('link', { name: /convert pdf/i })).toBeVisible();
		await expect(page.getByRole('link', { name: /cleanup/i })).toBeVisible();
		await expect(page.getByRole('link', { name: /translate/i })).toBeVisible();
		await expect(page.getByRole('link', { name: /my documents/i })).toBeVisible();
	});

	test('displays Settings link in sidebar navigation', async ({ page }) => {
		await page.goto('/');

		const sidebar = page.locator('nav[aria-label="Main navigation"]');
		const settingsLink = sidebar.getByRole('link', { name: /settings/i });
		await expect(settingsLink).toBeVisible();
	});

	test('Settings link is NOT in header', async ({ page }) => {
		await page.goto('/');

		const header = page.locator('header');
		const settingsInHeader = header.getByRole('link', { name: /settings/i });
		await expect(settingsInHeader).not.toBeVisible();
	});

	test('navigates to Upload page when clicking Upload link', async ({ page }) => {
		await page.goto('/');

		await page.getByRole('link', { name: /upload/i }).click();
		await expect(page).toHaveURL('/');
		await expect(page.locator('h1')).toContainText('Upload');
	});

	test('navigates to Convert PDF page', async ({ page }) => {
		await page.goto('/');

		await page.getByRole('link', { name: /convert pdf/i }).click();
		await expect(page).toHaveURL('/convert');
		await expect(page.locator('h1')).toContainText('Convert PDF');
	});

	test('navigates to Cleanup page', async ({ page }) => {
		await page.goto('/');

		await page.getByRole('link', { name: /cleanup/i }).click();
		await expect(page).toHaveURL('/cleanup');
		await expect(page.locator('h1')).toContainText('Cleanup');
	});

	test('navigates to Translate page', async ({ page }) => {
		await page.goto('/');

		await page.getByRole('link', { name: /translate/i }).click();
		await expect(page).toHaveURL('/translate');
		await expect(page.locator('h1')).toContainText('Translate');
	});

	test('navigates to My Documents page', async ({ page }) => {
		await page.goto('/');

		await page.getByRole('link', { name: /my documents/i }).click();
		await expect(page).toHaveURL('/documents');
		await expect(page.locator('h1')).toContainText('My Documents');
	});

	test('navigates to Settings page', async ({ page }) => {
		await page.goto('/');

		await page.getByRole('link', { name: /settings/i }).click();
		await expect(page).toHaveURL('/settings');
		await expect(page.locator('h1')).toContainText('Settings');
	});

	test('highlights the current navigation item', async ({ page }) => {
		await page.goto('/');

		// Upload should be active on home page
		const uploadLink = page.getByRole('link', { name: /upload/i });
		await expect(uploadLink).toHaveAttribute('aria-current', 'page');

		// Navigate to convert and check it becomes active
		await page.getByRole('link', { name: /convert pdf/i }).click();
		const convertLink = page.getByRole('link', { name: /convert pdf/i });
		await expect(convertLink).toHaveAttribute('aria-current', 'page');
	});

	test('highlights Settings link when on settings page', async ({ page }) => {
		await page.goto('/settings');

		const sidebar = page.locator('nav[aria-label="Main navigation"]');
		const settingsLink = sidebar.getByRole('link', { name: /settings/i });
		await expect(settingsLink).toHaveAttribute('aria-current', 'page');
	});
});
