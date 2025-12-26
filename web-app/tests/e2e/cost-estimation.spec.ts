import { test, expect } from '@playwright/test';
import {
	clearAllStorage,
	addDocumentToIndexedDB,
	setApiKey,
	mockOpenAICompletion
} from './helpers';

test.describe('Cost Estimation - Translation', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('shows cost estimate when document is selected', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book\n\nThis is test content for cost estimation.',
			size: 50,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/translate');

		// Wait for select to be visible
		const select = page.locator('select').first();
		await expect(select).toBeVisible();

		// Cost estimate should NOT be visible before selecting a document
		await expect(page.getByTestId('cost-estimate')).not.toBeVisible();

		// Select the markdown document
		await select.selectOption('doc_md_123');

		// Cost estimate should now be visible
		await expect(page.getByTestId('cost-estimate')).toBeVisible();

		// Should show model, tokens, and cost
		const costEstimate = page.getByTestId('cost-estimate');
		await expect(costEstimate.getByText(/Model:/)).toBeVisible();
		await expect(costEstimate.getByText(/Est\. tokens:/)).toBeVisible();
		await expect(costEstimate.getByText(/Est\. cost:/)).toBeVisible();
		await expect(costEstimate.getByText(/\$/)).toBeVisible();
	});

	test('cost estimate updates when model is changed', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book\n\nThis is test content.',
			size: 30,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/translate');

		// Wait for select to be visible and select document
		const select = page.locator('select').first();
		await expect(select).toBeVisible();
		await select.selectOption('doc_md_123');

		// Get initial cost estimate
		const costEstimate = page.getByTestId('cost-estimate');
		await expect(costEstimate).toBeVisible();

		// Get the displayed model
		const initialModelText = await costEstimate.getByText(/gpt-5-mini/).textContent();
		expect(initialModelText).toBeTruthy();

		// Change model
		const modelSelect = page.getByTestId('model-select');
		await modelSelect.selectOption('gpt-4.1');

		// Cost estimate should update to show new model
		await expect(costEstimate.getByText(/gpt-4\.1/)).toBeVisible();
	});

	test('hides cost estimate during translation', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book\n\nContent to translate.',
			size: 30,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		// Set API key and mock OpenAI with delay
		await setApiKey(page);
		await mockOpenAICompletion(page, '# テストブック', { delay: 1000, jsonWrap: true });

		await page.goto('/translate');

		// Wait for select and select document
		const select = page.locator('select').first();
		await expect(select).toBeVisible();
		await select.selectOption('doc_md_123');
		await page.getByTestId('target-language-input').fill('Japanese');

		// Verify cost estimate is visible before translation
		await expect(page.getByTestId('cost-estimate')).toBeVisible();

		// Start translation
		const button = page.locator('button', { hasText: 'Start Translation' });
		await expect(button).toBeEnabled({ timeout: 5000 });
		await button.click({ force: true });

		// Cost estimate should be hidden during translation
		await expect(page.getByTestId('cost-estimate')).not.toBeVisible();
	});

	// Note: "shows running cost during translation progress" test was removed because
	// the transient progress state is difficult to catch reliably in E2E tests.
	// This functionality is covered by unit tests in ProgressIndicator.test.ts
	// and translationEngine.test.ts which verify costData is properly passed through.

	test('shows final cost summary after translation completes', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book\n\nContent to translate.',
			size: 30,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		// Set API key and mock OpenAI (no delay for fast completion)
		await setApiKey(page);
		await mockOpenAICompletion(page, '# テストブック', { jsonWrap: true });

		await page.goto('/translate');

		// Wait for select and select document
		const select = page.locator('select').first();
		await expect(select).toBeVisible();
		await select.selectOption('doc_md_123');
		await page.getByTestId('target-language-input').fill('Japanese');

		// Start translation
		const button = page.locator('button', { hasText: 'Start Translation' });
		await expect(button).toBeEnabled({ timeout: 5000 });
		await button.click({ force: true });

		// Wait for results
		await expect(page.getByRole('tab', { name: 'Target Language Only' })).toBeVisible({ timeout: 10000 });

		// Final cost should be visible
		await expect(page.getByTestId('final-cost')).toBeVisible();

		// Should show token and cost breakdown
		const finalCost = page.getByTestId('final-cost');
		await expect(finalCost.getByText(/Total tokens:/)).toBeVisible();
		await expect(finalCost.getByText(/Input:/)).toBeVisible();
		await expect(finalCost.getByText(/Final cost:/)).toBeVisible();

		// Verify actual token values from mock (100 prompt + 50 completion = 150 total)
		await expect(finalCost.getByText('150')).toBeVisible();
		await expect(finalCost.getByText('100')).toBeVisible();
	});
});

test.describe('Cost Estimation - Cleanup', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('shows cost estimate when document is selected for cleanup', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Tst Book\n\nThsi is cntent with typos.',
			size: 40,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/cleanup');

		// Wait for select to be visible
		const select = page.locator('select').first();
		await expect(select).toBeVisible();

		// Cost estimate should NOT be visible before selecting a document
		await expect(page.getByTestId('cost-estimate')).not.toBeVisible();

		// Select the markdown document
		await select.selectOption('doc_md_123');

		// Cost estimate should now be visible
		await expect(page.getByTestId('cost-estimate')).toBeVisible();

		// Should show model, tokens, and cost
		const costEstimate = page.getByTestId('cost-estimate');
		await expect(costEstimate.getByText(/Model:/)).toBeVisible();
		await expect(costEstimate.getByText(/Est\. tokens:/)).toBeVisible();
		await expect(costEstimate.getByText(/Est\. cost:/)).toBeVisible();
	});

	test('shows final cost summary after cleanup completes', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Tst Book\n\nThsi is cntent.',
			size: 28,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		// Set API key and mock OpenAI
		await setApiKey(page);
		await mockOpenAICompletion(page, '# Test Book\n\nThis is content.');

		await page.goto('/cleanup');

		// Wait for select and select document
		const select = page.locator('select').first();
		await expect(select).toBeVisible();
		await select.selectOption('doc_md_123');

		// Start cleanup
		const button = page.locator('button', { hasText: 'Start Cleanup' });
		await expect(button).toBeEnabled({ timeout: 5000 });
		await button.click({ force: true });

		// Wait for results
		await expect(page.getByText('Cleaned Markdown')).toBeVisible({ timeout: 10000 });

		// Final cost should be visible
		await expect(page.getByTestId('final-cost')).toBeVisible();

		// Should show token and cost breakdown
		const finalCost = page.getByTestId('final-cost');
		await expect(finalCost.getByText(/Total tokens:/)).toBeVisible();
		await expect(finalCost.getByText(/Final cost:/)).toBeVisible();
	});
});

test.describe('Cost Estimation - Workflow', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('shows final cost summary with phase breakdown after workflow completes', async ({ page }) => {
		// Set API key and mock OpenAI (jsonWrap needed for translation phase)
		await setApiKey(page);
		await mockOpenAICompletion(page, '# テスト\n\nコンテンツ。', { jsonWrap: true });

		await page.goto('/workflow');

		// Upload a markdown file
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'test.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Test\n\nContent.')
		});

		// Fill in target language
		await page.getByTestId('target-language-input').fill('Japanese');

		// Start workflow
		const button = page.getByRole('button', { name: /start one step translation/i });
		await expect(button).toBeEnabled({ timeout: 5000 });
		await button.click({ force: true });

		// Wait for final cost to be visible (more specific than looking for "Workflow Complete" text)
		await expect(page.getByTestId('final-cost')).toBeVisible({ timeout: 15000 });

		// Should show breakdown by phase
		const finalCost = page.getByTestId('final-cost');
		await expect(finalCost.getByText(/Cleanup/)).toBeVisible();
		await expect(finalCost.getByText(/Translation/)).toBeVisible();
		await expect(finalCost.getByText(/Total cost:/)).toBeVisible();
	});
});
