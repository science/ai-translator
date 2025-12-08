import { test, expect } from '@playwright/test';

test.describe('API Key Help Page', () => {
	test('help page is accessible at /settings/api-key-help', async ({ page }) => {
		await page.goto('/settings/api-key-help');

		await expect(page).toHaveURL('/settings/api-key-help');
	});

	test('displays page title about getting an API key', async ({ page }) => {
		await page.goto('/settings/api-key-help');

		// Should have a clear title
		const heading = page.locator('h1');
		await expect(heading).toBeVisible();
		await expect(heading).toContainText(/api key/i);
	});

	test('explains what an API key is', async ({ page }) => {
		await page.goto('/settings/api-key-help');

		// Should explain what an API key is for non-technical users
		await expect(page.getByRole('heading', { name: /what is an api key/i })).toBeVisible();
		await expect(page.getByText(/like a password/i).first()).toBeVisible();
	});

	test('provides step-by-step instructions to get an API key', async ({ page }) => {
		await page.goto('/settings/api-key-help');

		// Should have numbered steps or clear instructions
		// Check for key steps: sign up, navigate to API keys, create key
		await expect(page.getByRole('heading', { name: /step-by-step/i })).toBeVisible();
		await expect(page.getByRole('heading', { name: /create an openai account/i })).toBeVisible();
	});

	test('includes link to OpenAI platform', async ({ page }) => {
		await page.goto('/settings/api-key-help');

		// Should have a link to OpenAI's platform
		const openAILink = page.getByRole('link', { name: /openai|platform\.openai\.com/i });
		await expect(openAILink).toBeVisible();

		// Link should open in new tab
		await expect(openAILink).toHaveAttribute('target', '_blank');
	});

	test('explains rate limiting for new accounts', async ({ page }) => {
		await page.goto('/settings/api-key-help');

		// Should mention rate limiting
		await expect(page.getByRole('heading', { name: /about rate limits/i })).toBeVisible();

		// Should explain what it means in simple terms
		await expect(page.getByText(/how many requests/i)).toBeVisible();
	});

	test('explains API cost/billing basics', async ({ page }) => {
		await page.goto('/settings/api-key-help');

		// Should mention that API usage costs money or has a free tier
		await expect(page.getByText(/billing|payment|credit|cost|free/i).first()).toBeVisible();
	});

	test('has a link back to settings page', async ({ page }) => {
		await page.goto('/settings/api-key-help');

		// Should have a way to go back to settings (there are two: top and bottom)
		const backLink = page.getByRole('link', { name: /back to settings/i }).first();
		await expect(backLink).toBeVisible();

		// Use force click to bypass any stability issues
		await backLink.click({ force: true });
		await expect(page).toHaveURL('/settings');
	});

	test('includes security warning about API key', async ({ page }) => {
		await page.goto('/settings/api-key-help');

		// Should warn users to keep their API key safe
		await expect(page.getByText(/secret|secure|never share|protect|safe/i).first()).toBeVisible();
	});
});

test.describe('Settings Page - Help Link', () => {
	test('settings page has a link to API key help', async ({ page }) => {
		await page.goto('/settings');

		// Should have a help link near the API key section
		const helpLink = page.getByRole('link', { name: /how.*get|help|get.*api.*key/i });
		await expect(helpLink).toBeVisible();
	});

	test('help link opens in new tab', async ({ page }) => {
		await page.goto('/settings');

		// The help link should have target="_blank"
		const helpLink = page.getByRole('link', { name: /how.*get|help|get.*api.*key/i });
		await expect(helpLink).toHaveAttribute('target', '_blank');
	});

	test('help link points to the correct page', async ({ page }) => {
		await page.goto('/settings');

		const helpLink = page.getByRole('link', { name: /how.*get|help|get.*api.*key/i });
		const href = await helpLink.getAttribute('href');

		// Should point to the help page
		expect(href).toMatch(/api-key-help/);
	});
});

test.describe('Settings Page - Getting Started Tooltip', () => {
	test.beforeEach(async ({ page }) => {
		// Clear localStorage to ensure API key is empty
		await page.goto('/settings');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
	});

	test('shows getting started tooltip when API key is empty', async ({ page }) => {
		await page.goto('/settings');

		// Should show a tooltip/callout when API key is empty
		const tooltip = page.locator('[data-testid="getting-started-tooltip"]');
		await expect(tooltip).toBeVisible();
	});

	test('tooltip contains helpful guidance text', async ({ page }) => {
		await page.goto('/settings');

		// Should have guidance text about reading help and getting API key
		const tooltip = page.locator('[data-testid="getting-started-tooltip"]');
		await expect(tooltip).toContainText(/start|help|api key/i);
	});

	test('tooltip disappears when API key has text', async ({ page }) => {
		await page.goto('/settings');

		// Initially tooltip should be visible
		const tooltip = page.locator('[data-testid="getting-started-tooltip"]');
		await expect(tooltip).toBeVisible();

		// Type something in the API key field
		const apiKeyInput = page.locator('#api-key');
		await apiKeyInput.fill('sk-test');

		// Tooltip should now be hidden
		await expect(tooltip).not.toBeVisible();
	});

	test('tooltip reappears when API key is cleared', async ({ page }) => {
		await page.goto('/settings');

		const tooltip = page.locator('[data-testid="getting-started-tooltip"]');
		const apiKeyInput = page.locator('#api-key');

		// Type something - tooltip should hide
		await apiKeyInput.fill('sk-test');
		await expect(tooltip).not.toBeVisible();

		// Clear the field - tooltip should reappear
		await apiKeyInput.fill('');
		await expect(tooltip).toBeVisible();
	});

	test('tooltip is not shown when API key is already saved', async ({ page }) => {
		// Set up an API key before navigating
		await page.goto('/settings');
		await page.evaluate(() => {
			localStorage.setItem('openai_api_key', 'sk-saved-key');
		});
		await page.reload();

		// Tooltip should not be visible
		const tooltip = page.locator('[data-testid="getting-started-tooltip"]');
		await expect(tooltip).not.toBeVisible();
	});
});
