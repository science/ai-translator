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

	test('cost estimate updates when reasoning effort is changed', async ({ page }) => {
		// Pre-populate IndexedDB with a larger markdown document to see cost differences
		// Need enough content so cost difference is visible after rounding to 2 decimal places
		const largeContent = '# Test Book\n\n' + 'This is test content for cost estimation with enough text to show cost differences when reasoning effort changes. '.repeat(5000);
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_large',
			name: 'large-book.md',
			type: 'markdown',
			content: largeContent,
			size: largeContent.length,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/cleanup');

		// Select the document
		const select = page.locator('select').first();
		await expect(select).toBeVisible();
		await select.selectOption('doc_md_large');

		// Select gpt-5.2 model for higher pricing to see cost differences
		const modelSelect = page.getByTestId('model-select');
		await modelSelect.selectOption('gpt-5.2');

		// Wait for cost estimate to be visible
		const costEstimate = page.getByTestId('cost-estimate');
		await expect(costEstimate).toBeVisible();

		// Set reasoning to "none" first (1x multiplier for gpt-5.2)
		const reasoningSelect = page.getByTestId('reasoning-effort-select');
		await reasoningSelect.selectOption('none');

		// Wait for cost to update
		await page.waitForTimeout(200);

		// Get the initial cost value with no reasoning (1x multiplier)
		const initialCostText = await costEstimate.getByText(/Est\. cost:/).locator('..').textContent();
		const initialCostMatch = initialCostText?.match(/\$(\d+\.?\d*)/);
		expect(initialCostMatch).toBeTruthy();
		const initialCost = parseFloat(initialCostMatch![1]);

		// Change reasoning effort to "high" (3.5x multiplier)
		await reasoningSelect.selectOption('high');

		// Wait for cost to update
		await page.waitForTimeout(200);

		// Get the new cost value - should be higher due to 3.5x vs 1x multiplier
		const newCostText = await costEstimate.getByText(/Est\. cost:/).locator('..').textContent();
		const newCostMatch = newCostText?.match(/\$(\d+\.?\d*)/);
		expect(newCostMatch).toBeTruthy();
		const newCost = parseFloat(newCostMatch![1]);

		// The cost with high reasoning (3.5x) should be greater than none (1x)
		// Expected ratio: 3.5/1 = 3.5x increase
		expect(newCost).toBeGreaterThan(initialCost);

		// More specifically, verify the ratio is approximately correct (with some tolerance)
		const ratio = newCost / initialCost;
		expect(ratio).toBeGreaterThanOrEqual(2.5); // Should be ~3.5x
		expect(ratio).toBeLessThanOrEqual(4.5);
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

test.describe('Cost Estimation - Reasoning Multiplier Indicator', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('shows reasoning multiplier indicator on cleanup page when GPT-5 model with high reasoning is selected', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book\n\nThis is test content for cost estimation with reasoning multiplier indicator.',
			size: 80,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/cleanup');

		// Select the document
		const select = page.locator('select').first();
		await expect(select).toBeVisible();
		await select.selectOption('doc_md_123');

		// Verify cost estimate is visible
		await expect(page.getByTestId('cost-estimate')).toBeVisible();

		// Change reasoning effort to high
		const reasoningSelect = page.getByTestId('reasoning-effort-select');
		await reasoningSelect.selectOption('high');

		// Should show the reasoning multiplier indicator (3.5x for high)
		await expect(page.getByTestId('reasoning-multiplier-indicator')).toBeVisible();
		await expect(page.getByTestId('reasoning-multiplier-indicator')).toContainText('3.5');
	});

	test('hides reasoning multiplier indicator when GPT-4 model is selected', async ({ page }) => {
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

		await page.goto('/cleanup');

		// Select the document
		const select = page.locator('select').first();
		await expect(select).toBeVisible();
		await select.selectOption('doc_md_123');

		// Change to GPT-4 model (no reasoning support)
		const modelSelect = page.getByTestId('model-select');
		await modelSelect.selectOption('gpt-4.1');

		// Reasoning multiplier indicator should NOT be visible
		await expect(page.getByTestId('reasoning-multiplier-indicator')).not.toBeVisible();
	});

	test('hides reasoning multiplier indicator when reasoning effort is minimal', async ({ page }) => {
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

		await page.goto('/cleanup');

		// Select the document
		const select = page.locator('select').first();
		await expect(select).toBeVisible();
		await select.selectOption('doc_md_123');

		// Default model is gpt-5-mini, set reasoning to minimal
		const reasoningSelect = page.getByTestId('reasoning-effort-select');
		await reasoningSelect.selectOption('minimal');

		// Reasoning multiplier indicator should NOT be visible (1.0x means no indicator)
		await expect(page.getByTestId('reasoning-multiplier-indicator')).not.toBeVisible();
	});

	test('shows reasoning multiplier in workflow page cost estimate for each phase', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book\n\nThis is test content for workflow cost estimation.',
			size: 60,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/workflow');

		// Select the document
		const docSelect = page.getByTestId('document-select');
		await docSelect.selectOption('doc_md_123');

		// Set target language
		await page.getByTestId('target-language-input').fill('Japanese');

		// Wait for cost estimate
		await expect(page.getByTestId('cost-estimate')).toBeVisible();

		// Change cleanup reasoning to high
		const cleanupReasoningSelect = page.getByTestId('cleanup-reasoning-select');
		await cleanupReasoningSelect.selectOption('high');

		// Should show reasoning multiplier indicator for cleanup
		await expect(page.getByTestId('cleanup-reasoning-indicator')).toBeVisible();
		await expect(page.getByTestId('cleanup-reasoning-indicator')).toContainText('3.5');
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
