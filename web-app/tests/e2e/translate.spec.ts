import { test, expect } from '@playwright/test';

// Helper to clear all storage
async function clearAllStorage(page: any) {
	await page.evaluate(async () => {
		localStorage.clear();
		const databases = await indexedDB.databases();
		for (const db of databases) {
			if (db.name) indexedDB.deleteDatabase(db.name);
		}
	});
}

// Helper to add a document to IndexedDB
async function addDocumentToIndexedDB(page: any, doc: any) {
	await page.evaluate(async (document: any) => {
		return new Promise<void>((resolve, reject) => {
			const request = indexedDB.open('book-translate-db', 1);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains('documents')) {
					db.createObjectStore('documents', { keyPath: 'id' });
				}
			};
			request.onsuccess = () => {
				const db = request.result;
				const tx = db.transaction('documents', 'readwrite');
				const store = tx.objectStore('documents');
				store.put(document);
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			};
			request.onerror = () => reject(request.error);
		});
	}, doc);
}

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

		// Mock the API to delay response
		await page.route('/api/translate', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			await route.fulfill({
				status: 200,
				contentType: 'text/event-stream',
				body: 'data: {"type":"complete","japaneseOnly":"# テストブック","bilingual":"# Test Book\\n\\n---\\n\\n# テストブック"}\n\n'
			});
		});

		await page.goto('/translate');

		// Select the document
		const select = page.locator('select').first();
		await select.selectOption('doc_md_123');

		// Click translate
		const button = page.locator('button', { hasText: 'Start Translation' });
		await button.click();

		// Should show loading state
		await expect(page.getByText(/translating|processing/i)).toBeVisible({ timeout: 1000 });
	});

	test('calls API with document content when translate is clicked', async ({ page }) => {
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

		// Capture the API request
		let capturedRequest: { content?: string; filename?: string; model?: string; chunkSize?: number; reasoningEffort?: string } | null = null;
		await page.route('/api/translate', async (route) => {
			const request = route.request();
			capturedRequest = JSON.parse(await request.postData() || '{}');
			await route.fulfill({
				status: 200,
				contentType: 'text/event-stream',
				body: 'data: {"type":"complete","japaneseOnly":"# テストブック","bilingual":"# Test Book\\n\\n---\\n\\n# テストブック"}\n\n'
			});
		});

		await page.goto('/translate');

		// Select the document and click translate
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Translation' }).click();

		// Wait for API call to complete
		await page.waitForResponse('/api/translate');

		// Verify the API was called with correct data
		expect(capturedRequest).not.toBeNull();
		expect(capturedRequest?.content).toBe(markdownContent);
		expect(capturedRequest?.filename).toBe('test-book.md');
		expect(capturedRequest?.model).toBe('gpt-5-mini');
		expect(capturedRequest?.chunkSize).toBe(4000);
		expect(capturedRequest?.reasoningEffort).toBe('medium');
	});

	test('displays translation results with both versions', async ({ page }) => {
		// Mock successful translation with SSE format
		await page.route('**/api/translate', async (route) => {
			const sseResponse = 'data: {"type":"progress","percentage":100,"message":"Translation complete"}\n\n' +
				'data: {"type":"complete","japaneseOnly":"# 第一章\\n\\nこれは翻訳されたコンテンツです。","bilingual":"# Chapter 1\\n\\n---\\n\\n# 第一章\\n\\n---\\n\\nThis is the content.\\n\\n---\\n\\nこれは翻訳されたコンテンツです。"}\n\n';
			await route.fulfill({
				status: 200,
				contentType: 'text/event-stream',
				body: sseResponse
			});
		});

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

		// Mock successful translation with SSE format
		await page.route('/api/translate', async (route) => {
			const sseResponse = 'data: {"type":"progress","percentage":50,"message":"Processing chunk 1/2..."}\n\n' +
				'data: {"type":"complete","japaneseOnly":"# テスト","bilingual":"# Test\\n\\n---\\n\\n# テスト"}\n\n';
			await route.fulfill({
				status: 200,
				contentType: 'text/event-stream',
				body: sseResponse
			});
		});

		await page.goto('/translate');

		// Select the document and click translate
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Translation' }).click();

		// Wait for translation and storage
		await page.waitForResponse('/api/translate');
		await page.waitForTimeout(500); // Wait for state update

		// Check IndexedDB for the new documents
		const docs = await page.evaluate(async () => {
			return new Promise((resolve) => {
				const request = indexedDB.open('book-translate-db', 1);
				request.onsuccess = () => {
					const db = request.result;
					const tx = db.transaction('documents', 'readonly');
					const store = tx.objectStore('documents');
					const getAllRequest = store.getAll();
					getAllRequest.onsuccess = () => resolve(getAllRequest.result);
					getAllRequest.onerror = () => resolve([]);
				};
				request.onerror = () => resolve([]);
			});
		});

		// Should have 3 documents now: original + japanese-only + bilingual
		expect((docs as any[]).length).toBe(3);

		const japaneseDoc = (docs as any[]).find((d: any) => d.name.includes('-ja.md'));
		expect(japaneseDoc).toBeDefined();
		expect(japaneseDoc.name).toBe('test-book-ja.md');
		expect(japaneseDoc.content).toBe('# テスト');
		expect(japaneseDoc.phase).toBe('translated');
		expect(japaneseDoc.variant).toBe('japanese-only');
		expect(japaneseDoc.sourceDocumentId).toBe('doc_md_123');

		const bilingualDoc = (docs as any[]).find((d: any) => d.name.includes('-bilingual.md'));
		expect(bilingualDoc).toBeDefined();
		expect(bilingualDoc.name).toBe('test-book-bilingual.md');
		expect(bilingualDoc.content).toBe('# Test\n\n---\n\n# テスト');
		expect(bilingualDoc.phase).toBe('translated');
		expect(bilingualDoc.variant).toBe('bilingual');
		expect(bilingualDoc.sourceDocumentId).toBe('doc_md_123');
	});

	test('displays error message when translation fails', async ({ page }) => {
		// Mock failed translation
		await page.route('**/api/translate', async (route) => {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'API key invalid' })
			});
		});

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

		await page.goto('/translate');

		// Select the document and click translate
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Translation' }).click();

		// Should display error message
		await expect(page.getByText(/api key invalid/i)).toBeVisible({ timeout: 10000 });
	});

	test('button returns to enabled state after translation completes', async ({ page }) => {
		// Mock successful translation
		await page.route('**/api/translate', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'text/event-stream',
				body: 'data: {"type":"complete","japaneseOnly":"# テスト","bilingual":"# Test\\n\\n---\\n\\n# テスト"}\n\n'
			});
		});

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
		// Mock successful translation
		await page.route('**/api/translate', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'text/event-stream',
				body: 'data: {"type":"complete","japaneseOnly":"# 日本語だけ","bilingual":"# English Only\\n\\n---\\n\\n# 日本語だけ"}\n\n'
			});
		});

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
