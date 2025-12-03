import { test, expect } from '@playwright/test';
import {
	clearAllStorage,
	addDocumentToIndexedDB,
	setApiKey,
	mockOpenAICompletion,
	mockOpenAIError,
	getAllDocumentsFromIndexedDB
} from './helpers';

test.describe('Document Translation', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('shows "No markdown documents available" when no markdown files exist', async ({ page }) => {
		await page.goto('/translate');

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
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/translate');

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
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});
		await addDocumentToIndexedDB(page, {
			id: 'doc_pdf',
			name: 'book.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK',
			size: 1024,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/translate');

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

	test('translate button is disabled when no document is selected', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book',
			size: 11,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/translate');

		const button = page.locator('button', { hasText: 'Start Translation' });
		await expect(button).toBeDisabled();
	});

	test('translate button is enabled when a document is selected', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book',
			size: 11,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/translate');

		// Select the markdown document
		const select = page.locator('select').first();
		await select.selectOption('doc_md_123');

		// Button should now be enabled
		const button = page.locator('button', { hasText: 'Start Translation' });
		await expect(button).toBeEnabled();
	});

	test('shows loading state when translation is in progress', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book\n\nSome content to translate.',
			size: 40,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		// Set API key and mock OpenAI with delay (jsonWrap for contextAware translation)
		await setApiKey(page);
		await mockOpenAICompletion(page, '# テストブック\n\nコンテンツを翻訳する。', { delay: 2000, jsonWrap: true });

		await page.goto('/translate');

		// Select the document
		const select = page.locator('select').first();
		await select.selectOption('doc_md_123');

		// Click translate
		const button = page.locator('button', { hasText: 'Start Translation' });
		await button.click();

		// Should show loading state - button text changes to "Translating..."
		await expect(page.getByText('Translating...')).toBeVisible({ timeout: 1000 });
	});

	test('calls OpenAI API with document content when translate is clicked', async ({ page }) => {
		const markdownContent = '# Test Book\n\nContent to translate.';

		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: markdownContent,
			size: markdownContent.length,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		// Set API key and mock OpenAI, capturing the request (jsonWrap for contextAware translation)
		await setApiKey(page);
		const getRequest = await mockOpenAICompletion(page, '# テストブック\n\n翻訳するコンテンツ。', { jsonWrap: true });

		await page.goto('/translate');

		// Select the document and click translate
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Translation' }).click();

		// Wait for result tabs to appear
		await expect(page.getByRole('tab', { name: /japanese only/i })).toBeVisible({ timeout: 10000 });

		// Verify the OpenAI API was called
		const capturedRequest = getRequest();
		expect(capturedRequest).not.toBeNull();
		expect(capturedRequest?.model).toBe('gpt-5-mini');
		// The message should contain the document content
		const userMessage = capturedRequest?.messages?.find((m) => m.role === 'user');
		expect(userMessage?.content).toContain('Content to translate');
	});

	test('displays translation results with both versions', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Chapter 1\n\nThis is the content.',
			size: 35,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		// Set API key and mock OpenAI (jsonWrap for contextAware translation)
		await setApiKey(page);
		await mockOpenAICompletion(page, '# 第一章\n\nこれは翻訳されたコンテンツです。', { jsonWrap: true });

		await page.goto('/translate');

		// Select the document and click translate
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Translation' }).click();

		// Should display tabs for both translation types
		await expect(page.getByRole('tab', { name: /japanese only/i })).toBeVisible({ timeout: 10000 });
		await expect(page.getByRole('tab', { name: /bilingual/i })).toBeVisible();

		// Japanese content should be visible
		await expect(page.getByText('第一章')).toBeVisible();
	});

	test('stores both translated documents in IndexedDB', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test',
			size: 6,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		// Set API key and mock OpenAI (jsonWrap for contextAware translation)
		await setApiKey(page);
		await mockOpenAICompletion(page, '# テスト', { jsonWrap: true });

		await page.goto('/translate');

		// Select the document and click translate
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Translation' }).click();

		// Wait for translation to complete (button returns to normal state)
		await expect(page.locator('button', { hasText: 'Start Translation' })).toBeEnabled({
			timeout: 10000
		});

		// Check IndexedDB for the new documents
		const docs = await getAllDocumentsFromIndexedDB(page);

		// Should have 3 documents now: original + japanese-only + bilingual
		expect(docs.length).toBe(3);

		const japaneseDoc = docs.find((d) => d.name.includes('-ja.md'));
		expect(japaneseDoc).toBeDefined();
		expect(japaneseDoc!.name).toBe('test-book-ja.md');
		expect(japaneseDoc!.content).toBe('# テスト');
		expect(japaneseDoc!.phase).toBe('translated');
		expect(japaneseDoc!.variant).toBe('japanese-only');
		expect(japaneseDoc!.sourceDocumentId).toBe('doc_md_123');

		const bilingualDoc = docs.find((d) => d.name.includes('-bilingual.md'));
		expect(bilingualDoc).toBeDefined();
		expect(bilingualDoc!.name).toBe('test-book-bilingual.md');
		// Bilingual content has original + translated
		expect(bilingualDoc!.content).toContain('# Test');
		expect(bilingualDoc!.content).toContain('# テスト');
		expect(bilingualDoc!.phase).toBe('translated');
		expect(bilingualDoc!.variant).toBe('bilingual');
		expect(bilingualDoc!.sourceDocumentId).toBe('doc_md_123');
	});

	test('displays error message when translation fails', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test',
			size: 6,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		// Set API key and mock OpenAI error
		await setApiKey(page);
		await mockOpenAIError(page, 'Invalid API key', 401);

		await page.goto('/translate');

		// Select the document and click translate
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Translation' }).click();

		// Should display error message (error text from browser service)
		await expect(page.getByText(/invalid api key|error|failed/i)).toBeVisible({ timeout: 10000 });
	});

	test('button returns to enabled state after translation completes', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test',
			size: 6,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		// Set API key and mock OpenAI (jsonWrap for contextAware translation)
		await setApiKey(page);
		await mockOpenAICompletion(page, '# テスト', { jsonWrap: true });

		await page.goto('/translate');

		// Select the document and click translate
		await page.locator('select').first().selectOption('doc_md_123');
		const button = page.locator('button', { hasText: 'Start Translation' });
		await button.click();

		// Button should return to normal state after translation
		await expect(button).toBeEnabled({ timeout: 10000 });
		await expect(button).toHaveText('Start Translation');
	});

	test('can switch between Japanese-only and bilingual views', async ({ page }) => {
		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# English Only',
			size: 14,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		// Set API key and mock OpenAI (jsonWrap for contextAware translation)
		await setApiKey(page);
		await mockOpenAICompletion(page, '# 日本語だけ', { jsonWrap: true });

		await page.goto('/translate');

		// Select the document and click translate
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Translation' }).click();

		// Wait for results
		await expect(page.getByRole('tab', { name: /japanese only/i })).toBeVisible({ timeout: 10000 });

		// Japanese only tab should be active by default and show Japanese content
		await expect(page.getByText('日本語だけ')).toBeVisible();

		// Click bilingual tab
		await page.getByRole('tab', { name: /bilingual/i }).click();

		// Should now show bilingual content with English
		await expect(page.getByText('English Only')).toBeVisible();
	});
});

test.describe('Model Selection', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('model dropdown contains correct options: gpt-5.1, gpt-5-mini, gpt-4.1, gpt-4.1-mini', async ({
		page
	}) => {
		await page.goto('/translate');

		const modelSelect = page.getByTestId('model-select');
		await expect(modelSelect).toBeVisible();

		// Get all options
		const options = await modelSelect.locator('option').allTextContents();

		// Should contain exactly these models
		expect(options).toEqual(['gpt-5.1', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini']);
	});

	test('default model is gpt-5-mini', async ({ page }) => {
		await page.goto('/translate');

		const modelSelect = page.getByTestId('model-select');
		await expect(modelSelect).toHaveValue('gpt-5-mini');
	});

	test('reasoning effort is visible when gpt-5-mini is selected', async ({ page }) => {
		await page.goto('/translate');

		// Default is gpt-5-mini
		const reasoningLabel = page.getByText('Reasoning Effort');
		await expect(reasoningLabel).toBeVisible();
	});

	test('reasoning effort is visible when gpt-5.1 is selected', async ({ page }) => {
		await page.goto('/translate');

		const modelSelect = page.getByTestId('model-select');
		await modelSelect.selectOption('gpt-5.1');

		const reasoningLabel = page.getByText('Reasoning Effort');
		await expect(reasoningLabel).toBeVisible();
	});

	test('reasoning effort is hidden when gpt-4.1 is selected', async ({ page }) => {
		await page.goto('/translate');

		// Wait for page to be fully loaded
		await page.waitForLoadState('networkidle');

		// Verify initial state - gpt-5-mini is default so reasoning should be visible
		const reasoningLabel = page.getByText('Reasoning Effort');
		await expect(reasoningLabel).toBeVisible();

		// Select non-5 series model
		const modelSelect = page.getByTestId('model-select');
		await expect(modelSelect).toHaveValue('gpt-5-mini'); // Verify initial value

		// Click and select to ensure proper interaction
		await modelSelect.click();
		await modelSelect.selectOption('gpt-4.1');

		// Wait for selection to complete
		await expect(modelSelect).toHaveValue('gpt-4.1');

		// Reasoning effort should now be hidden
		await expect(reasoningLabel).not.toBeVisible();
	});

	test('reasoning effort is hidden when gpt-4.1-mini is selected', async ({ page }) => {
		await page.goto('/translate');

		// Wait for page to be fully loaded
		await page.waitForLoadState('networkidle');

		// Verify initial state
		const reasoningLabel = page.getByText('Reasoning Effort');
		await expect(reasoningLabel).toBeVisible();

		const modelSelect = page.getByTestId('model-select');
		await expect(modelSelect).toHaveValue('gpt-5-mini'); // Verify initial value

		// Click and select to ensure proper interaction
		await modelSelect.click();
		await modelSelect.selectOption('gpt-4.1-mini');

		// Wait for selection to complete
		await expect(modelSelect).toHaveValue('gpt-4.1-mini');

		// Reasoning effort should now be hidden
		await expect(reasoningLabel).not.toBeVisible();
	});

	test('OpenAI API call includes reasoning_effort when 5-series model is selected', async ({
		page
	}) => {
		const markdownContent = '# Test Book\n\nContent to translate.';

		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: markdownContent,
			size: markdownContent.length,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		// Set API key and mock OpenAI, capturing the request (jsonWrap for contextAware translation)
		await setApiKey(page);
		const getRequest = await mockOpenAICompletion(page, '# テストブック\n\n翻訳するコンテンツ。', { jsonWrap: true });

		await page.goto('/translate');
		await page.waitForLoadState('networkidle');

		// Select gpt-5.1 model
		const modelSelect = page.getByTestId('model-select');
		await modelSelect.click();
		await modelSelect.selectOption('gpt-5.1');
		await expect(modelSelect).toHaveValue('gpt-5.1');

		// Select the document
		await page.locator('select').first().selectOption('doc_md_123');

		// Click translate
		await page.locator('button', { hasText: 'Start Translation' }).click();

		// Wait for result
		await expect(page.getByRole('tab', { name: /japanese only/i })).toBeVisible({ timeout: 10000 });

		// Verify the OpenAI API was called with reasoning_effort
		const capturedRequest = getRequest();
		expect(capturedRequest?.model).toBe('gpt-5.1');
		expect(capturedRequest?.reasoning_effort).toBe('medium');
	});

	test('OpenAI API call does NOT include reasoning_effort when 4-series model is selected', async ({
		page
	}) => {
		const markdownContent = '# Test Book\n\nContent to translate.';

		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: markdownContent,
			size: markdownContent.length,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		// Set API key and mock OpenAI, capturing the request (jsonWrap for contextAware translation)
		await setApiKey(page);
		const getRequest = await mockOpenAICompletion(page, '# テストブック\n\n翻訳するコンテンツ。', { jsonWrap: true });

		await page.goto('/translate');
		await page.waitForLoadState('networkidle');

		// Select gpt-4.1 model (non-5 series)
		const modelSelect = page.getByTestId('model-select');
		await modelSelect.click();
		await modelSelect.selectOption('gpt-4.1');
		await expect(modelSelect).toHaveValue('gpt-4.1');

		// Select the document
		await page.locator('select').first().selectOption('doc_md_123');

		// Click translate
		await page.locator('button', { hasText: 'Start Translation' }).click();

		// Wait for result
		await expect(page.getByRole('tab', { name: /japanese only/i })).toBeVisible({ timeout: 10000 });

		// Verify the OpenAI API was called WITHOUT reasoning_effort
		const capturedRequest = getRequest();
		expect(capturedRequest?.model).toBe('gpt-4.1');
		expect(capturedRequest?.reasoning_effort).toBeUndefined();
	});
});

test.describe('My Documents - Translation Variants', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('shows variant indicator for translated documents', async ({ page }) => {
		// Pre-populate IndexedDB with translated documents
		await addDocumentToIndexedDB(page, {
			id: 'doc_ja',
			name: 'book-ja.md',
			type: 'markdown',
			content: '# テスト',
			size: 10,
			uploadedAt: new Date().toISOString(),
			phase: 'translated',
			variant: 'japanese-only'
		});
		await addDocumentToIndexedDB(page, {
			id: 'doc_bilingual',
			name: 'book-en-jp.md',
			type: 'markdown',
			content: '# Test\n\n---\n\n# テスト',
			size: 25,
			uploadedAt: new Date().toISOString(),
			phase: 'translated',
			variant: 'bilingual'
		});

		await page.goto('/documents');

		// Should show variant indicators (using exact: true to avoid matching filenames)
		await expect(page.getByText('Japanese', { exact: true })).toBeVisible();
		await expect(page.getByText('Bilingual', { exact: true })).toBeVisible();
	});

	test('filter by translated phase shows both variants', async ({ page }) => {
		// Pre-populate IndexedDB with documents
		await addDocumentToIndexedDB(page, {
			id: 'doc_original',
			name: 'original.md',
			type: 'markdown',
			content: '# Original',
			size: 10,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});
		await addDocumentToIndexedDB(page, {
			id: 'doc_ja',
			name: 'book-ja.md',
			type: 'markdown',
			content: '# テスト',
			size: 10,
			uploadedAt: new Date().toISOString(),
			phase: 'translated',
			variant: 'japanese-only'
		});
		await addDocumentToIndexedDB(page, {
			id: 'doc_bilingual',
			name: 'book-bilingual.md',
			type: 'markdown',
			content: '# Test\n\n---\n\n# テスト',
			size: 25,
			uploadedAt: new Date().toISOString(),
			phase: 'translated',
			variant: 'bilingual'
		});

		await page.goto('/documents');

		// Wait for all documents to load first
		await expect(page.getByTestId('document-row')).toHaveCount(3);

		// Click translated filter
		await page.getByTestId('filter-translated').click();

		// Wait for filter to be applied (filter button should be active)
		await expect(page.getByTestId('filter-translated')).toHaveClass(/bg-blue-100/);

		// Should show 2 translated documents
		const rows = page.getByTestId('document-row');
		await expect(rows).toHaveCount(2);

		// Both should be visible
		await expect(page.getByText('book-ja.md')).toBeVisible();
		await expect(page.getByText('book-bilingual.md')).toBeVisible();
	});
});
