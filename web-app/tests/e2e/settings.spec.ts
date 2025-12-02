import { test, expect } from '@playwright/test';

test.describe('Settings Page - API Key', () => {
	test.beforeEach(async ({ page }) => {
		// Clear localStorage before each test
		await page.goto('/settings');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
	});

	test('allows user to enter API key', async ({ page }) => {
		await page.goto('/settings');

		const apiKeyInput = page.locator('#api-key');
		await expect(apiKeyInput).toBeVisible();
		await apiKeyInput.fill('sk-test-key-12345');
		await expect(apiKeyInput).toHaveValue('sk-test-key-12345');
	});

	test('saves API key to localStorage when Save is clicked', async ({ page }) => {
		await page.goto('/settings');

		const apiKeyInput = page.locator('#api-key');
		await apiKeyInput.fill('sk-test-key-12345');

		// Use data-testid for the save button
		await page.locator('[data-testid="save-api-key"]').click();

		// Wait for state to update
		await page.waitForTimeout(100);

		// Verify it was saved to localStorage
		const storedKey = await page.evaluate(() => localStorage.getItem('openai_api_key'));
		expect(storedKey).toBe('sk-test-key-12345');
	});

	test('loads API key from localStorage on page load', async ({ page }) => {
		// Set API key in localStorage first
		await page.goto('/settings');
		await page.evaluate(() => localStorage.setItem('openai_api_key', 'sk-stored-key-67890'));
		await page.reload();

		const apiKeyInput = page.locator('#api-key');
		await expect(apiKeyInput).toHaveValue('sk-stored-key-67890');
	});

	test('toggles API key visibility with Show/Hide button', async ({ page }) => {
		await page.goto('/settings');

		const apiKeyInput = page.locator('#api-key');
		await apiKeyInput.fill('sk-secret-key');

		// Initially should be password type
		await expect(apiKeyInput).toHaveAttribute('type', 'password');

		// Click Show button using data-testid
		await page.locator('[data-testid="toggle-api-key"]').click();
		await expect(apiKeyInput).toHaveAttribute('type', 'text');

		// Click Hide button (same button, now says Hide)
		await page.locator('[data-testid="toggle-api-key"]').click();
		await expect(apiKeyInput).toHaveAttribute('type', 'password');
	});

	test('shows success message when API key is saved', async ({ page }) => {
		await page.goto('/settings');

		const apiKeyInput = page.locator('#api-key');
		await apiKeyInput.fill('sk-test-key-12345');
		await page.locator('[data-testid="save-api-key"]').click();

		await expect(page.getByText(/saved/i)).toBeVisible();
	});

	test('shows connection status indicator', async ({ page }) => {
		await page.goto('/settings');

		// Initially should show "Not configured" or similar
		await expect(page.getByText(/not configured/i)).toBeVisible();

		// After saving a key, should update status
		const apiKeyInput = page.locator('#api-key');
		await apiKeyInput.fill('sk-test-key-12345');
		await page.locator('[data-testid="save-api-key"]').click();

		await expect(page.getByText(/configured/i).first()).toBeVisible();
	});
});

test.describe('Settings Page - Default Settings', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/settings');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
	});

	test('allows changing default model', async ({ page }) => {
		await page.goto('/settings');

		const modelSelect = page.locator('#default-model');
		await modelSelect.selectOption('gpt-4o');
		await page.locator('[data-testid="save-defaults"]').click();

		// Reload and verify it persists
		await page.reload();
		await expect(page.locator('#default-model')).toHaveValue('gpt-4o');
	});

	test('allows changing default chunk size', async ({ page }) => {
		await page.goto('/settings');

		const chunkSizeInput = page.locator('#default-chunk-size');
		await chunkSizeInput.fill('3000');
		await page.locator('[data-testid="save-defaults"]').click();

		// Reload and verify it persists
		await page.reload();
		await expect(page.locator('#default-chunk-size')).toHaveValue('3000');
	});

	test('allows changing default reasoning effort', async ({ page }) => {
		await page.goto('/settings');

		const reasoningSelect = page.locator('#default-reasoning-effort');
		await reasoningSelect.selectOption('high');
		await page.locator('[data-testid="save-defaults"]').click();

		// Reload and verify it persists
		await page.reload();
		await expect(page.locator('#default-reasoning-effort')).toHaveValue('high');
	});
});
