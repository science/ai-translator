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

		// Mock the API to delay response
		await page.route('/api/cleanup', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ markdown: '# Test Book\n\nSome content with OCR errors fixed.' })
			});
		});

		await page.goto('/cleanup');

		// Select the document
		const select = page.locator('select').first();
		await select.selectOption('doc_md_123');

		// Click cleanup
		const button = page.locator('button', { hasText: 'Start Cleanup' });
		await button.click();

		// Should show loading state
		await expect(page.getByText(/cleaning|processing/i)).toBeVisible({ timeout: 1000 });
	});

	test('calls API with document content when cleanup is clicked', async ({ page }) => {
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

		// Capture the API request
		let capturedRequest: { content?: string; filename?: string; model?: string; chunkSize?: number } | null = null;
		await page.route('/api/cleanup', async (route) => {
			const request = route.request();
			capturedRequest = JSON.parse(await request.postData() || '{}');
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ markdown: '# Test Book\n\nContents with errors fixed.' })
			});
		});

		await page.goto('/cleanup');

		// Select the document and click cleanup
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Cleanup' }).click();

		// Wait for API call to complete
		await page.waitForResponse('/api/cleanup');

		// Verify the API was called with correct data
		expect(capturedRequest).not.toBeNull();
		expect(capturedRequest?.content).toBe(markdownContent);
		expect(capturedRequest?.filename).toBe('test-book.md');
		expect(capturedRequest?.model).toBe('gpt-5-mini');
		expect(capturedRequest?.chunkSize).toBe(4000);
	});

	test('displays cleanup result as markdown preview', async ({ page }) => {
		// Mock successful cleanup with SSE format - set up before any navigation
		await page.route('**/api/cleanup', async (route) => {
			const sseResponse = 'data: {"type":"progress","percentage":100,"message":"Cleanup complete"}\n\n' +
				'data: {"type":"complete","markdown":"# Chapter 1\\n\\nThis is the cleaned content."}\n\n';
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
			content: '# hapter 1\n\nTis is the cleaned content.',
			size: 40,
			uploadedAt: new Date().toISOString()
		});

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

		// Mock successful cleanup with SSE format
		await page.route('/api/cleanup', async (route) => {
			const sseResponse = 'data: {"type":"progress","percentage":50,"message":"Processing chunk 1/2..."}\n\n' +
				'data: {"type":"complete","markdown":"# Test Book"}\n\n';
			await route.fulfill({
				status: 200,
				contentType: 'text/event-stream',
				body: sseResponse
			});
		});

		await page.goto('/cleanup');

		// Select the document and click cleanup
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Cleanup' }).click();

		// Wait for cleanup and storage
		await page.waitForResponse('/api/cleanup');
		await page.waitForTimeout(500); // Wait for state update

		// Check IndexedDB for the new document
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

		// Should have 2 documents now: original + cleaned
		expect((docs as any[]).length).toBe(2);

		const cleanedDoc = (docs as any[]).find((d: any) => d.name.includes('rectified'));
		expect(cleanedDoc).toBeDefined();
		expect(cleanedDoc.name).toBe('test-book-rectified.md');
		expect(cleanedDoc.content).toBe('# Test Book');

		// Verify phase is set correctly
		expect(cleanedDoc.phase).toBe('cleaned');
		expect(cleanedDoc.sourceDocumentId).toBe('doc_md_123');
	});

	test('displays error message when cleanup fails', async ({ page }) => {
		// Mock failed cleanup - set up before any navigation
		await page.route('**/api/cleanup', async (route) => {
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
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/cleanup');

		// Select the document and click cleanup
		await page.locator('select').first().selectOption('doc_md_123');
		await page.locator('button', { hasText: 'Start Cleanup' }).click();

		// Should display error message
		await expect(page.getByText(/api key invalid/i)).toBeVisible({ timeout: 10000 });
	});

	test('button returns to enabled state after cleanup completes', async ({ page }) => {
		// Mock successful cleanup - set up before any navigation
		await page.route('**/api/cleanup', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ markdown: '# Done' })
			});
		});

		// Pre-populate IndexedDB with a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_123',
			name: 'test-book.md',
			type: 'markdown',
			content: '# one',
			size: 5,
			uploadedAt: new Date().toISOString()
		});

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

	test('cleanup page does not have reasoning effort selector', async ({ page }) => {
		await page.goto('/cleanup');

		// Cleanup doesn't use reasoning effort at all
		const reasoningLabel = page.getByText('Reasoning Effort');
		await expect(reasoningLabel).not.toBeVisible();
	});
});
