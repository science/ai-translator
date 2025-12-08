import { test, expect } from '@playwright/test';
import {
	clearAllStorage,
	addDocumentToIndexedDB,
	setApiKey,
	mockOpenAICompletion,
	mockOpenAIError,
	getAllDocumentsFromIndexedDB
} from './helpers';

test.describe('Document Cleanup (Rectification)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('shows "No markdown documents available" when no markdown files exist', async ({ page }) => {
		await page.goto('/cleanup');

		const select = page.locator('select').first();
		await expect(select).toBeVisible();

		// Check that the select contains the "No markdown documents available" option
		const options = select.locator('option');
		await expect(options).toHaveCount(1);
		await expect(options.first()).toHaveText('No markdown documents available');
	});

	test('displays uploaded markdown documents in the dropdown', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book\n\nThis is test content.',
			size: 32,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/cleanup');

		// The markdown should appear in the dropdown
		const select = page.locator('select').first();
		await expect(select).toBeVisible();

		// Check that the option with the markdown name exists (2 options: placeholder + markdown)
		const options = select.locator('option');
		await expect(options).toHaveCount(2);
		await expect(options.nth(1)).toHaveText('test-book.md');
	});

	test('only shows markdown files in dropdown, not PDF files', async ({ page }) => {
		// Pre-populate IndexedDB with both markdown and PDF documents
		await addDocumentToIndexedDB(page, {
			id: 'doc_md',
			name: 'document.md',
			type: 'markdown',
			content: '# Heading',
			size: 10,
			uploadedAt: new Date().toISOString()
		});
		await addDocumentToIndexedDB(page, {
			id: 'doc_pdf',
			name: 'book.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK',
			size: 1024,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/cleanup');

		const select = page.locator('select').first();
		const options = select.locator('option');

		// Should have 2 options: placeholder + markdown (not PDF)
		await expect(options).toHaveCount(2);

		// Get all option texts
		const optionTexts = await options.allTextContents();

		// Markdown should be in the list
		expect(optionTexts).toContain('document.md');

		// PDF should NOT be in the list
		expect(optionTexts).not.toContain('book.pdf');
	});

	test('cleanup button is disabled when no document is selected', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book',
			size: 11,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/cleanup');

		const button = page.locator('button', { hasText: 'Start Cleanup' });
		await expect(button).toBeDisabled();
	});

	test('cleanup button is enabled when a document is selected', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book',
			size: 11,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/cleanup');

		// Select the markdown document
		const select = page.locator('select').first();
		await select.selectOption('doc_md_123');

		// Button should now be enabled
		const button = page.locator('button', { hasText: 'Start Cleanup' });
		await expect(button).toBeEnabled();
	});

	test('shows loading state when cleanup is in progress', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book\n\nSome content with OCR errors.',
			size: 44,
			uploadedAt: new Date().toISOString()
		});

		// Set API key and mock OpenAI with delay
		await setApiKey(page);
		await mockOpenAICompletion(page, '# Test Book\n\nSome content with OCR errors fixed.', {
			delay: 2000
		});

		await page.goto('/cleanup');

		// Select the document
		const select = page.locator('select').first();
		await select.selectOption('doc_md_123');

		// Click cleanup
		const button = page.locator('button', { hasText: 'Start Cleanup' });
		await button.click();

		// Should show loading state - button text changes to "Cleaning..."
		await expect(page.getByText('Cleaning...')).toBeVisible({ timeout: 1000 });
	});

	test('calls OpenAI API with document content when cleanup is clicked', async ({ page }) => {
		const markdownContent = '# Test Book\n\nontents with errors.';

		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: markdownContent,
			size: markdownContent.length,
			uploadedAt: new Date().toISOString()
		});

		// Set API key and mock OpenAI, capturing the request
		await setApiKey(page);
		const getRequest = await mockOpenAICompletion(
			page,
			'# Test Book\n\nContents with errors fixed.'
		);

		await page.goto('/cleanup');

		// Select the document and click cleanup
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Cleanup' }).click();

		// Wait for result to appear
		await expect(page.getByText('Contents with errors fixed.')).toBeVisible({ timeout: 10000 });

		// Verify the OpenAI API was called
		const capturedRequest = getRequest();
		expect(capturedRequest).not.toBeNull();
		expect(capturedRequest?.model).toBe('gpt-5-mini');
		// The message should contain the document content
		const userMessage = capturedRequest?.messages?.find((m) => m.role === 'user');
		expect(userMessage?.content).toContain('ontents with errors');
	});

	test('displays cleanup result as markdown preview', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# hapter 1\n\nTis is the cleaned content.',
			size: 40,
			uploadedAt: new Date().toISOString()
		});

		// Set API key and mock OpenAI
		await setApiKey(page);
		await mockOpenAICompletion(page, '# Chapter 1\n\nThis is the cleaned content.');

		await page.goto('/cleanup');

		// Select the document and click cleanup
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Cleanup' }).click();

		// Should display the cleaned markdown
		await expect(page.getByText('Chapter 1')).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('This is the cleaned content.')).toBeVisible();
	});

	test('stores cleaned document in IndexedDB', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test ook',
			size: 10,
			uploadedAt: new Date().toISOString()
		});

		// Set API key and mock OpenAI
		await setApiKey(page);
		await mockOpenAICompletion(page, '# Test Book');

		await page.goto('/cleanup');

		// Select the document and click cleanup
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Cleanup' }).click();

		// Wait for cleanup to complete (button returns to normal state)
		await expect(page.locator('button', { hasText: 'Start Cleanup' })).toBeEnabled({
			timeout: 10000
		});

		// Check IndexedDB for the new document
		const docs = await getAllDocumentsFromIndexedDB(page);

		// Should have 2 documents now: original + cleaned
		expect(docs.length).toBe(2);

		const cleanedDoc = docs.find((d) => d.name.includes('rectified'));
		expect(cleanedDoc).toBeDefined();
		expect(cleanedDoc!.name).toBe('test-book-rectified.md');
		expect(cleanedDoc!.content).toBe('# Test Book');

		// Verify phase is set correctly
		expect(cleanedDoc!.phase).toBe('cleaned');
		expect(cleanedDoc!.sourceDocumentId).toBe('doc_md_123');
	});

	test('displays error message when cleanup fails', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test',
			size: 6,
			uploadedAt: new Date().toISOString()
		});

		// Set API key and mock OpenAI error
		await setApiKey(page);
		await mockOpenAIError(page, 'Invalid API key', 401);

		await page.goto('/cleanup');

		// Select the document and click cleanup
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Cleanup' }).click();

		// Should display error message (error text from browser service)
		await expect(page.getByText(/invalid api key|error|failed/i)).toBeVisible({ timeout: 10000 });
	});

	test('button returns to enabled state after cleanup completes', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# one',
			size: 5,
			uploadedAt: new Date().toISOString()
		});

		// Set API key and mock OpenAI
		await setApiKey(page);
		await mockOpenAICompletion(page, '# Done');

		await page.goto('/cleanup');

		// Select the document and click cleanup
		await page.locator('select').first().selectOption('doc_md_123');
		const button = page.locator('button', { hasText: 'Start Cleanup' });
		await button.click();

		// Button should return to normal state after cleanup
		await expect(button).toBeEnabled({ timeout: 10000 });
		await expect(button).toHaveText('Start Cleanup');
	});

	test('model dropdown contains correct options: gpt-5.1, gpt-5-mini, gpt-4.1, gpt-4.1-mini', async ({
		page
	}) => {
		await page.goto('/cleanup');

		// Find the model select dropdown (second select, after document select)
		const modelSelect = page.locator('select').nth(1);
		await expect(modelSelect).toBeVisible();

		// Get all options
		const options = await modelSelect.locator('option').allTextContents();

		// Should contain exactly these models
		expect(options).toEqual(['gpt-5.1', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini']);
	});

	test('cleanup page shows reasoning effort selector for 5-series models', async ({ page }) => {
		await page.goto('/cleanup');
		await page.waitForLoadState('networkidle');

		// Default model is gpt-5-mini, so reasoning effort should be visible
		const reasoningLabel = page.getByText('Reasoning Effort');
		await expect(reasoningLabel).toBeVisible();

		// Select a non-5 series model
		const modelSelect = page.locator('select').nth(1);
		await expect(modelSelect).toHaveValue('gpt-5-mini'); // Verify default
		await modelSelect.click();
		await modelSelect.selectOption('gpt-4.1');

		// Wait for selection to complete
		await expect(modelSelect).toHaveValue('gpt-4.1');

		// Reasoning effort should now be hidden
		await expect(reasoningLabel).not.toBeVisible();
	});
});

test.describe('Cleanup Page - Default Settings from Settings Tab', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('loads default model from Settings tab localStorage', async ({ page }) => {
		// Set up custom default model in localStorage (as if saved from Settings tab)
		await page.evaluate(() => {
			localStorage.setItem('default_model', 'gpt-4.1');
		});

		await page.goto('/cleanup');
		await page.waitForLoadState('networkidle');

		// Model dropdown should show the saved default
		const modelSelect = page.locator('select').nth(1);
		await expect(modelSelect).toHaveValue('gpt-4.1');
	});

	test('loads default chunk size from Settings tab localStorage', async ({ page }) => {
		// Set up custom default chunk size in localStorage
		await page.evaluate(() => {
			localStorage.setItem('default_chunk_size', '2500');
		});

		await page.goto('/cleanup');
		await page.waitForLoadState('networkidle');

		// Chunk size input should show the saved default
		const chunkSizeInput = page.locator('input[type="number"]');
		await expect(chunkSizeInput).toHaveValue('2500');
	});

	test('loads default reasoning effort from Settings tab localStorage', async ({ page }) => {
		// Set up custom default reasoning effort in localStorage (with 5-series model)
		await page.evaluate(() => {
			localStorage.setItem('default_model', 'gpt-5-mini');
			localStorage.setItem('default_reasoning_effort', 'high');
		});

		await page.goto('/cleanup');
		await page.waitForLoadState('networkidle');

		// Reasoning effort dropdown should show the saved default
		const reasoningSelect = page.locator('select').nth(2);
		await expect(reasoningSelect).toHaveValue('high');
	});

	test('OpenAI API call uses model from Settings tab default', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test',
			size: 6,
			uploadedAt: new Date().toISOString()
		});

		// Set up default model in localStorage
		await page.evaluate(() => {
			localStorage.setItem('default_model', 'gpt-4.1');
		});

		// Set API key and mock OpenAI, capturing the request
		await setApiKey(page);
		const getRequest = await mockOpenAICompletion(page, '# Test Cleaned');

		await page.goto('/cleanup');
		await page.waitForLoadState('networkidle');

		// Verify model is loaded from localStorage
		const modelSelect = page.locator('select').nth(1);
		await expect(modelSelect).toHaveValue('gpt-4.1');

		// Select the document
		await page.locator('select').first().selectOption('doc_md_123');

		// Wait for button to be enabled, then click
		const button = page.locator('button', { hasText: 'Start Cleanup' });
		await expect(button).toBeEnabled({ timeout: 5000 });
		await button.click({ force: true });

		// Wait for result
		await expect(page.getByText('Test Cleaned')).toBeVisible({ timeout: 10000 });

		// Verify the API call used the saved model
		const capturedRequest = getRequest();
		expect(capturedRequest?.model).toBe('gpt-4.1');
	});
});
