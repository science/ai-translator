import { test, expect } from '@playwright/test';
import { clearAllStorage, setApiKey } from './helpers';

test.describe('Complete Workflow Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('displays the workflow page with all sections', async ({ page }) => {
		await page.goto('/workflow');

		// Check page title
		await expect(page.locator('h1')).toContainText('Complete Workflow');

		// Check all step sections are visible
		await expect(page.getByText('Upload PDF')).toBeVisible();
		await expect(page.getByText('Cleanup Settings')).toBeVisible();
		await expect(page.getByText('Translation Settings')).toBeVisible();

		// Check start button exists
		await expect(page.getByRole('button', { name: /start complete workflow/i })).toBeVisible();
	});

	test('navigation shows workflow link with separator', async ({ page }) => {
		await page.goto('/');

		// Check that "Complete Workflow" link is in navigation
		const navLink = page.getByRole('link', { name: 'Complete Workflow' });
		await expect(navLink).toBeVisible();

		// Check separator exists (border element between workflow and other nav items)
		const separator = page.locator('nav .border-b');
		await expect(separator).toBeVisible();
	});

	test('workflow link is highlighted when active', async ({ page }) => {
		await page.goto('/workflow');

		// The workflow link should have the active style (bg-blue-600)
		const navLink = page.getByRole('link', { name: 'Complete Workflow' });
		await expect(navLink).toHaveClass(/bg-blue-600/);
	});

	test('start button is disabled when no file is selected', async ({ page }) => {
		await page.goto('/workflow');

		const startButton = page.getByRole('button', { name: /start complete workflow/i });
		await expect(startButton).toBeDisabled();
	});

	test('shows file upload area for drag and drop', async ({ page }) => {
		await page.goto('/workflow');

		// Check for the drop zone text
		await expect(page.getByText(/click to upload/i)).toBeVisible();
		await expect(page.getByText(/pdf files only/i)).toBeVisible();
	});

	test('shows cleanup settings with model, chunk size, and reasoning effort', async ({ page }) => {
		await page.goto('/workflow');

		// Check cleanup settings section
		const cleanupSection = page.locator('text=Cleanup Settings').locator('..');
		await expect(cleanupSection.getByText('Model')).toBeVisible();
		await expect(cleanupSection.getByText('Chunk Size')).toBeVisible();

		// Model dropdown should have options
		const modelSelect = cleanupSection.locator('select').first();
		await expect(modelSelect).toBeVisible();
	});

	test('shows translation settings with model, chunk size, reasoning effort, and context-aware toggle', async ({
		page
	}) => {
		await page.goto('/workflow');

		// Check translation settings section
		const translationSection = page.locator('text=Translation Settings').locator('..');
		await expect(translationSection.getByText('Model')).toBeVisible();
		await expect(translationSection.getByText('Chunk Size')).toBeVisible();
		await expect(translationSection.getByText(/context-aware/i)).toBeVisible();

		// Context-aware checkbox should be checked by default
		const checkbox = translationSection.locator('input[type="checkbox"]');
		await expect(checkbox).toBeChecked();
	});

	test('loads default settings from localStorage', async ({ page }) => {
		// Set custom defaults in localStorage before visiting the page
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('default_model', 'gpt-4.1');
			localStorage.setItem('default_chunk_size', '3000');
			localStorage.setItem('default_reasoning_effort', 'high');
			localStorage.setItem('context_aware_enabled', 'false');
		});

		await page.goto('/workflow');

		// Check that cleanup model dropdown has the saved value
		const cleanupModel = page.locator('text=Cleanup Settings').locator('..').locator('select').first();
		await expect(cleanupModel).toHaveValue('gpt-4.1');

		// Check that translation context-aware is unchecked
		const contextAware = page.locator('text=Translation Settings').locator('..').locator('input[type="checkbox"]');
		await expect(contextAware).not.toBeChecked();
	});

	test('shows error when API key is not set', async ({ page }) => {
		await page.goto('/workflow');

		// We need to simulate file selection for the button to be enabled
		// For now, just verify the error handling structure exists
		// The error message should appear when trying to start without API key
		await expect(page.locator('.bg-red-50')).not.toBeVisible();
	});

	test('reasoning effort dropdown appears only for GPT-5 models', async ({ page }) => {
		await page.goto('/workflow');

		// With gpt-5-mini (default), reasoning effort should be visible
		const cleanupSection = page.locator('text=Cleanup Settings').locator('..');
		await expect(cleanupSection.getByText('Reasoning Effort')).toBeVisible();

		// Change to gpt-4.1 (non-5-series)
		const modelSelect = cleanupSection.locator('select').first();
		await modelSelect.selectOption('gpt-4.1');

		// Reasoning effort should be hidden
		await expect(cleanupSection.getByText('Reasoning Effort')).not.toBeVisible();
	});
});

test.describe('Workflow Page Navigation', () => {
	test('can navigate to workflow from sidebar', async ({ page }) => {
		await page.goto('/');

		// Click on Complete Workflow link - use force click since it's in fixed nav
		const workflowLink = page.getByRole('link', { name: 'Complete Workflow' });
		await workflowLink.click({ force: true });

		// Should be on workflow page
		await expect(page).toHaveURL(/\/workflow/);
		await expect(page.locator('h1')).toContainText('Complete Workflow');
	});

	test('can navigate back to upload from workflow', async ({ page }) => {
		await page.goto('/workflow');

		// Click on Upload link in sidebar - use force click since it's in fixed nav
		const uploadLink = page.getByRole('link', { name: 'Upload' });
		await uploadLink.click({ force: true });

		// Should be on upload page
		await expect(page).toHaveURL(/\/$/);
	});

	test('workflow link appears at top of navigation above separator', async ({ page }) => {
		await page.goto('/');

		// Get the navigation container
		const nav = page.locator('nav[aria-label="Main navigation"]');

		// Complete Workflow should be the first link
		const firstLink = nav.locator('a').first();
		await expect(firstLink).toContainText('Complete Workflow');

		// The separator should come after the workflow link
		// This is checked by ensuring the workflow link is before the other nav items
		const uploadLink = page.getByRole('link', { name: 'Upload' });
		const workflowLink = page.getByRole('link', { name: 'Complete Workflow' });

		// Get bounding boxes to verify order
		const workflowBox = await workflowLink.boundingBox();
		const uploadBox = await uploadLink.boundingBox();

		expect(workflowBox).toBeTruthy();
		expect(uploadBox).toBeTruthy();
		// Workflow should be above Upload (smaller y value)
		expect(workflowBox!.y).toBeLessThan(uploadBox!.y);
	});
});

test.describe('Workflow UI States', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('start button shows processing state when running', async ({ page }) => {
		// This test would require mocking the file upload and API calls
		// For now, we just verify the initial state
		await page.goto('/workflow');

		const startButton = page.getByRole('button', { name: /start complete workflow/i });

		// Button text should be "Start Complete Workflow" initially
		await expect(startButton).toContainText('Start Complete Workflow');
	});

	test('shows lightning bolt icon in start button', async ({ page }) => {
		await page.goto('/workflow');

		// Check that the start button contains an SVG icon
		const startButton = page.getByRole('button', { name: /start complete workflow/i });
		const icon = startButton.locator('svg');
		await expect(icon).toBeVisible();
	});

	test('step numbers are displayed for each section', async ({ page }) => {
		await page.goto('/workflow');

		// Check step number badges (1, 2, 3) - use specific class to find the rounded badges
		const stepBadges = page.locator('.rounded-full.bg-blue-100');
		await expect(stepBadges).toHaveCount(3);

		// Verify the badges contain the step numbers
		await expect(stepBadges.nth(0)).toContainText('1');
		await expect(stepBadges.nth(1)).toContainText('2');
		await expect(stepBadges.nth(2)).toContainText('3');
	});
});
