import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

				// Convert base64 to Blob for PDFs
				let content = document.content;
				if (document.type === 'pdf' && typeof content === 'string') {
					const binaryString = atob(content);
					const bytes = new Uint8Array(binaryString.length);
					for (let i = 0; i < binaryString.length; i++) {
						bytes[i] = binaryString.charCodeAt(i);
					}
					content = new Blob([bytes], { type: 'application/pdf' });
				}

				store.put({ ...document, content });
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			};
			request.onerror = () => reject(request.error);
		});
	}, doc);
}

test.describe('PDF to Markdown Conversion', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('shows "No PDFs available" when no PDFs uploaded', async ({ page }) => {
		await page.goto('/convert');

		const select = page.locator('select');
		await expect(select).toBeVisible();

		// Check that the select contains the "No PDFs available" option
		const options = select.locator('option');
		await expect(options).toHaveCount(1);
		await expect(options.first()).toHaveText('No PDFs available');
	});

	test('displays uploaded PDFs in the dropdown', async ({ page }) => {
		// Pre-populate IndexedDB with a PDF document
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'test-book.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK', // Base64 encoded "%PDF-1.4\n"
			size: 1024,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		// The PDF should appear in the dropdown
		const select = page.locator('select');
		await expect(select).toBeVisible();

		// Check that the option with the PDF name exists (2 options: placeholder + PDF)
		const options = select.locator('option');
		await expect(options).toHaveCount(2);
		await expect(options.nth(1)).toHaveText('test-book.pdf');
	});

	test('only shows PDF files in dropdown, not markdown files', async ({ page }) => {
		// Pre-populate IndexedDB with both PDF and markdown documents
		await addDocumentToIndexedDB(page, {
			id: 'doc_pdf',
			name: 'document.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK',
			size: 1024,
			uploadedAt: new Date().toISOString()
		});
		await addDocumentToIndexedDB(page, {
			id: 'doc_md',
			name: 'readme.md',
			type: 'markdown',
			content: '# Heading',
			size: 512,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		const select = page.locator('select');
		const options = select.locator('option');

		// Should have 2 options: placeholder + PDF (not markdown)
		await expect(options).toHaveCount(2);

		// Get all option texts
		const optionTexts = await options.allTextContents();

		// PDF should be in the list
		expect(optionTexts).toContain('document.pdf');

		// Markdown should NOT be in the list
		expect(optionTexts).not.toContain('readme.md');
	});

	test('convert button is disabled when no PDF is selected', async ({ page }) => {
		// Pre-populate IndexedDB with a PDF document
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'test-book.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK',
			size: 1024,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		const button = page.locator('button', { hasText: 'Convert to Markdown' });
		await expect(button).toBeDisabled();
	});

	test('convert button is enabled when a PDF is selected', async ({ page }) => {
		// Pre-populate IndexedDB with a PDF document
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'test-book.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK',
			size: 1024,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		// Select the PDF
		const select = page.locator('select');
		await select.selectOption('doc_123');

		// Button should now be enabled
		const button = page.locator('button', { hasText: 'Convert to Markdown' });
		await expect(button).toBeEnabled();
	});

	test('shows loading state when conversion is in progress', async ({ page }) => {
		// Pre-populate IndexedDB with a PDF document
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'test-book.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK',
			size: 1024,
			uploadedAt: new Date().toISOString()
		});

		// Mock the API to delay response
		await page.route('/api/convert', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ markdown: '# Test' })
			});
		});

		await page.goto('/convert');

		// Select the PDF
		const select = page.locator('select');
		await select.selectOption('doc_123');

		// Click convert
		const button = page.locator('button', { hasText: 'Convert to Markdown' });
		await button.click();

		// Should show loading state
		await expect(page.getByText(/converting/i)).toBeVisible({ timeout: 1000 });
	});

	test('calls API with PDF content when convert is clicked', async ({ page }) => {
		const pdfContent = 'JVBERi0xLjQK'; // Base64 encoded PDF

		// Pre-populate IndexedDB with a PDF document
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'test-book.pdf',
			type: 'pdf',
			content: pdfContent,
			size: 1024,
			uploadedAt: new Date().toISOString()
		});

		// Capture the API request
		let capturedRequest: { content?: string; filename?: string } | null = null;
		await page.route('/api/convert', async (route) => {
			const request = route.request();
			capturedRequest = JSON.parse(await request.postData() || '{}');
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ markdown: '# Converted Content' })
			});
		});

		await page.goto('/convert');

		// Select the PDF and click convert
		await page.locator('select').selectOption('doc_123');
		await page.locator('button', { hasText: 'Convert to Markdown' }).click();

		// Wait for API call to complete
		await page.waitForResponse('/api/convert');

		// Verify the API was called with correct data
		expect(capturedRequest).not.toBeNull();
		expect(capturedRequest?.content).toBe(pdfContent);
		expect(capturedRequest?.filename).toBe('test-book.pdf');
	});

	test('displays conversion result as markdown preview', async ({ page }) => {
		// Mock successful conversion - set up before any navigation
		await page.route('**/api/convert', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ markdown: '# Chapter 1\n\nThis is the converted content.' })
			});
		});

		// Pre-populate IndexedDB with a PDF document
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'test-book.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK',
			size: 1024,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		// Select the PDF and click convert
		await page.locator('select').selectOption('doc_123');
		await page.locator('button', { hasText: 'Convert to Markdown' }).click();

		// Should display the converted markdown
		await expect(page.getByText('Chapter 1')).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('This is the converted content.')).toBeVisible();
	});

	test('stores converted document in IndexedDB', async ({ page }) => {
		// Pre-populate IndexedDB with a PDF document
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'test-book.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK',
			size: 1024,
			uploadedAt: new Date().toISOString()
		});

		// Mock successful conversion
		await page.route('/api/convert', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ markdown: '# Converted Document' })
			});
		});

		await page.goto('/convert');

		// Select the PDF and click convert
		await page.locator('select').selectOption('doc_123');
		await page.locator('button', { hasText: 'Convert to Markdown' }).click();

		// Wait for conversion and storage
		await page.waitForResponse('/api/convert');
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

		// Should have 2 documents now: original PDF + converted markdown
		expect((docs as any[]).length).toBe(2);

		const convertedDoc = (docs as any[]).find((d: any) => d.type === 'markdown');
		expect(convertedDoc).toBeDefined();
		expect(convertedDoc.name).toContain('test-book');
		expect(convertedDoc.content).toBe('# Converted Document');
	});

	test('displays error message when conversion fails', async ({ page }) => {
		// Mock failed conversion - set up before any navigation
		await page.route('**/api/convert', async (route) => {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Invalid PDF format' })
			});
		});

		// Pre-populate IndexedDB with a PDF document
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'corrupt.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK',
			size: 1024,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		// Select the PDF and click convert
		await page.locator('select').selectOption('doc_123');
		await page.locator('button', { hasText: 'Convert to Markdown' }).click();

		// Should display error message
		await expect(page.getByText(/invalid pdf format/i)).toBeVisible({ timeout: 10000 });
	});

	test('button returns to enabled state after conversion completes', async ({ page }) => {
		// Mock successful conversion - set up before any navigation
		await page.route('**/api/convert', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ markdown: '# Done' })
			});
		});

		// Pre-populate IndexedDB with a PDF document
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'test-book.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK',
			size: 1024,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		// Select the PDF and click convert
		await page.locator('select').selectOption('doc_123');
		const button = page.locator('button', { hasText: 'Convert to Markdown' });
		await button.click();

		// Button should return to normal state after conversion
		await expect(button).toBeEnabled({ timeout: 10000 });
		await expect(button).toHaveText('Convert to Markdown');
	});
});

test.describe('PDF to Markdown Integration', () => {
	test('converts a real PDF file through the full pipeline', async ({ page }) => {
		// Read the sample PDF fixture
		const pdfPath = path.resolve(__dirname, '../../../test/fixtures/sample.pdf');
		const pdfBuffer = fs.readFileSync(pdfPath);
		const pdfBase64 = pdfBuffer.toString('base64');

		await page.goto('/');
		await clearAllStorage(page);

		// Pre-populate IndexedDB with the real PDF
		await addDocumentToIndexedDB(page, {
			id: 'real_pdf_123',
			name: 'sample.pdf',
			type: 'pdf',
			content: pdfBase64,
			size: pdfBase64.length,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		// Select the PDF and click convert
		await page.locator('select').selectOption('real_pdf_123');
		await page.locator('button', { hasText: 'Convert to Markdown' }).click();

		// Wait for conversion - this calls the real API
		await expect(page.getByText(/converting/i)).toBeVisible({ timeout: 1000 });

		// Wait for result (longer timeout for real conversion)
		await expect(page.locator('.prose pre')).toBeVisible({ timeout: 30000 });

		// Verify markdown content was generated
		const markdownPreview = await page.locator('.prose pre').textContent();
		expect(markdownPreview).toBeTruthy();
		expect(markdownPreview!.length).toBeGreaterThan(10);
	});
});
