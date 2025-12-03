import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { clearAllStorage, addDocumentToIndexedDB, getAllDocumentsFromIndexedDB } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get real PDF content as base64
function getRealPdfBase64(): string {
	const pdfPath = path.resolve(__dirname, '../../../test/fixtures/sample.pdf');
	const pdfBuffer = fs.readFileSync(pdfPath);
	return pdfBuffer.toString('base64');
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
		// Use a real PDF for this test - pdf2md takes time to process
		const pdfBase64 = getRealPdfBase64();

		// Pre-populate IndexedDB with the real PDF
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'test-book.pdf',
			type: 'pdf',
			content: pdfBase64,
			size: pdfBase64.length,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		// Select the PDF
		const select = page.locator('select');
		await select.selectOption('doc_123');

		// Click convert
		const button = page.locator('button', { hasText: 'Convert to Markdown' });
		await button.click();

		// Should show loading state while pdf2md processes
		await expect(page.getByText(/converting/i)).toBeVisible({ timeout: 1000 });
	});

	test('converts PDF using browser-side pdf2md library', async ({ page }) => {
		// Use real PDF for conversion
		const pdfBase64 = getRealPdfBase64();

		// Pre-populate IndexedDB with the real PDF
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'test-book.pdf',
			type: 'pdf',
			content: pdfBase64,
			size: pdfBase64.length,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		// Select the PDF and click convert
		await page.locator('select').selectOption('doc_123');
		await page.locator('button', { hasText: 'Convert to Markdown' }).click();

		// Wait for conversion to complete - the result should appear
		await expect(page.locator('.prose pre')).toBeVisible({ timeout: 30000 });

		// Verify markdown content was generated
		const markdownPreview = await page.locator('.prose pre').textContent();
		expect(markdownPreview).toBeTruthy();
		expect(markdownPreview!.length).toBeGreaterThan(10);
	});

	test('displays conversion result as markdown preview', async ({ page }) => {
		// Use real PDF for conversion
		const pdfBase64 = getRealPdfBase64();

		// Pre-populate IndexedDB with the real PDF
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'test-book.pdf',
			type: 'pdf',
			content: pdfBase64,
			size: pdfBase64.length,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		// Select the PDF and click convert
		await page.locator('select').selectOption('doc_123');
		await page.locator('button', { hasText: 'Convert to Markdown' }).click();

		// Should display the converted markdown in a preview area
		await expect(page.locator('.prose pre')).toBeVisible({ timeout: 30000 });

		// Verify the preview contains some text (actual content depends on the PDF)
		const previewText = await page.locator('.prose pre').textContent();
		expect(previewText).toBeTruthy();
	});

	test('stores converted document in IndexedDB', async ({ page }) => {
		// Use real PDF for conversion
		const pdfBase64 = getRealPdfBase64();

		// Pre-populate IndexedDB with the real PDF
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'test-book.pdf',
			type: 'pdf',
			content: pdfBase64,
			size: pdfBase64.length,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		// Select the PDF and click convert
		await page.locator('select').selectOption('doc_123');
		await page.locator('button', { hasText: 'Convert to Markdown' }).click();

		// Wait for conversion to complete (preview appears)
		await expect(page.locator('.prose pre')).toBeVisible({ timeout: 30000 });

		// Check IndexedDB for the new document
		const docs = await getAllDocumentsFromIndexedDB(page);

		// Should have 2 documents now: original PDF + converted markdown
		expect(docs.length).toBe(2);

		const convertedDoc = docs.find((d) => d.type === 'markdown');
		expect(convertedDoc).toBeDefined();
		expect(convertedDoc!.name).toContain('test-book');
		expect(convertedDoc!.content).toBeTruthy();

		// Verify phase is set correctly
		expect(convertedDoc!.phase).toBe('converted');
		expect(convertedDoc!.sourceDocumentId).toBe('doc_123');
	});

	test('displays error message when conversion fails', async ({ page }) => {
		// Use invalid/corrupt PDF content to trigger an error in pdf2md
		// This is just garbage data that is not a valid PDF
		const invalidPdfContent = Buffer.from('This is not a valid PDF file content').toString('base64');

		// Pre-populate IndexedDB with invalid PDF content
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'corrupt.pdf',
			type: 'pdf',
			content: invalidPdfContent,
			size: 100,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		// Select the PDF and click convert
		await page.locator('select').selectOption('doc_123');
		await page.locator('button', { hasText: 'Convert to Markdown' }).click();

		// Should display error message (pdf2md will fail on invalid content)
		await expect(page.getByText(/error|failed|invalid/i)).toBeVisible({ timeout: 10000 });
	});

	test('button returns to enabled state after conversion completes', async ({ page }) => {
		// Use real PDF for conversion
		const pdfBase64 = getRealPdfBase64();

		// Pre-populate IndexedDB with the real PDF
		await addDocumentToIndexedDB(page, {
			id: 'doc_123',
			name: 'test-book.pdf',
			type: 'pdf',
			content: pdfBase64,
			size: pdfBase64.length,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/convert');

		// Select the PDF and click convert
		await page.locator('select').selectOption('doc_123');
		const button = page.locator('button', { hasText: 'Convert to Markdown' });
		await button.click();

		// Wait for conversion to complete (preview appears)
		await expect(page.locator('.prose pre')).toBeVisible({ timeout: 30000 });

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
