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
		await modelSelect.selectOption('gpt-4.1');
		await page.locator('[data-testid="save-defaults"]').click();

		// Reload and verify it persists
		await page.reload();
		await expect(page.locator('#default-model')).toHaveValue('gpt-4.1');
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

	test('model dropdown contains correct options: gpt-5.1, gpt-5-mini, gpt-4.1, gpt-4.1-mini', async ({
		page
	}) => {
		await page.goto('/settings');

		const modelSelect = page.locator('#default-model');
		await expect(modelSelect).toBeVisible();

		// Get all options
		const options = await modelSelect.locator('option').allTextContents();

		// Should contain exactly these models
		expect(options).toEqual(['gpt-5.1', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini']);
	});

	test('reasoning effort is only visible when 5-series model is selected', async ({ page }) => {
		await page.goto('/settings');

		// Default model is gpt-5-mini, so reasoning effort should be visible
		const reasoningLabel = page.getByText('Default Reasoning Effort');
		await expect(reasoningLabel).toBeVisible();

		// Select a 4-series model
		const modelSelect = page.locator('#default-model');
		await modelSelect.selectOption('gpt-4.1');

		// Reasoning effort should now be hidden
		await expect(reasoningLabel).not.toBeVisible();

		// Select a 5-series model again
		await modelSelect.selectOption('gpt-5.1');

		// Reasoning effort should be visible again
		await expect(reasoningLabel).toBeVisible();
	});

	test('gpt-5.1 shows "None" option for reasoning effort', async ({ page }) => {
		await page.goto('/settings');

		// Select gpt-5.1
		const modelSelect = page.locator('#default-model');
		await modelSelect.selectOption('gpt-5.1');

		// Get reasoning effort options
		const reasoningSelect = page.locator('#default-reasoning-effort');
		const options = await reasoningSelect.locator('option').allTextContents();

		// GPT-5.1 should have: None, Low, Medium, High
		expect(options).toEqual(['None', 'Low', 'Medium', 'High']);
	});

	test('gpt-5-mini shows "Minimal" option for reasoning effort', async ({ page }) => {
		await page.goto('/settings');

		// gpt-5-mini is the default
		const modelSelect = page.locator('#default-model');
		await expect(modelSelect).toHaveValue('gpt-5-mini');

		// Get reasoning effort options
		const reasoningSelect = page.locator('#default-reasoning-effort');
		const options = await reasoningSelect.locator('option').allTextContents();

		// GPT-5-mini should have: Minimal, Low, Medium, High
		expect(options).toEqual(['Minimal', 'Low', 'Medium', 'High']);
	});

	test('reasoning effort options change when switching between gpt-5.1 and gpt-5-mini', async ({
		page
	}) => {
		await page.goto('/settings');

		const modelSelect = page.locator('#default-model');
		const reasoningSelect = page.locator('#default-reasoning-effort');

		// Wait for reasoning effort select to be visible (gpt-5-mini is default)
		await expect(reasoningSelect).toBeVisible();

		// Start with gpt-5-mini (default)
		let options = await reasoningSelect.locator('option').allTextContents();
		expect(options).toEqual(['Minimal', 'Low', 'Medium', 'High']);

		// Switch to gpt-5.1
		await modelSelect.selectOption('gpt-5.1');
		options = await reasoningSelect.locator('option').allTextContents();
		expect(options).toEqual(['None', 'Low', 'Medium', 'High']);

		// Switch back to gpt-5-mini
		await modelSelect.selectOption('gpt-5-mini');
		options = await reasoningSelect.locator('option').allTextContents();
		expect(options).toEqual(['Minimal', 'Low', 'Medium', 'High']);
	});
});

test.describe('Settings Page - Storage Management', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/settings');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
	});

	test('displays storage usage', async ({ page }) => {
		await page.goto('/settings');

		// Should show storage info (either a value or "Calculating...")
		const storageText = page.getByText(/Total storage used:/);
		await expect(storageText).toBeVisible();
	});

	test('shows delete confirmation dialog when Delete All Documents is clicked', async ({ page }) => {
		await page.goto('/settings');

		// Click the delete button
		await page.locator('[data-testid="delete-all-documents"]').click();

		// Confirmation dialog should appear
		await expect(page.getByText('Delete All Documents?')).toBeVisible();
		await expect(page.getByText(/This will permanently delete/)).toBeVisible();
		await expect(page.getByText('This action cannot be undone.')).toBeVisible();
	});

	test('cancel button closes the confirmation dialog', async ({ page }) => {
		await page.goto('/settings');

		// Open the dialog
		await page.locator('[data-testid="delete-all-documents"]').click();
		await expect(page.getByText('Delete All Documents?')).toBeVisible();

		// Click cancel
		await page.locator('[data-testid="cancel-delete"]').click();

		// Dialog should close
		await expect(page.getByText('Delete All Documents?')).not.toBeVisible();
	});

	test('confirm button closes dialog and clears documents', async ({ page }) => {
		await page.goto('/settings');

		// Open the dialog
		await page.locator('[data-testid="delete-all-documents"]').click();
		await expect(page.getByText('Delete All Documents?')).toBeVisible();

		// Click confirm
		await page.locator('[data-testid="confirm-delete"]').click();

		// Dialog should close
		await expect(page.getByText('Delete All Documents?')).not.toBeVisible();
	});

	test('API key is preserved when documents are deleted', async ({ page }) => {
		await page.goto('/settings');

		// First save an API key
		const apiKeyInput = page.locator('#api-key');
		await apiKeyInput.fill('sk-test-key-preserve');
		await page.locator('[data-testid="save-api-key"]').click();

		// Wait for save
		await page.waitForTimeout(100);

		// Delete all documents
		await page.locator('[data-testid="delete-all-documents"]').click();
		await page.locator('[data-testid="confirm-delete"]').click();

		// Reload the page
		await page.reload();

		// API key should still be there
		await expect(apiKeyInput).toHaveValue('sk-test-key-preserve');
	});
});
