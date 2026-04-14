import { test, expect } from '@playwright/test';
import { clearAllStorage, addDocumentToIndexedDB } from './helpers';

/**
 * Tests for PDF export feature on documents page
 */
test.describe('PDF Export - Documents Page', () => {
	test.describe.configure({ mode: 'serial' });
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('markdown documents show "Export PDF" button', async ({ page }) => {
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_1',
			name: 'test-document.md',
			type: 'markdown',
			content: '# Test Document\n\nThis is test content.',
			size: 40,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/documents');

		const documentRow = page.locator('[data-testid="document-row"]').first();
		const exportPdfButton = documentRow.locator('[data-testid="export-pdf"]');
		await expect(exportPdfButton).toBeVisible();
	});

	test('PDF documents do NOT show "Export PDF" button', async ({ page }) => {
		await addDocumentToIndexedDB(page, {
			id: 'doc_pdf_1',
			name: 'test-document.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK',
			size: 1024,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/documents');

		const documentRow = page.locator('[data-testid="document-row"]').first();
		const exportPdfButton = documentRow.locator('[data-testid="export-pdf"]');
		await expect(exportPdfButton).not.toBeVisible();
	});

	test('clicking "Export PDF" triggers download with .pdf extension', async ({ page }) => {
		test.setTimeout(90000);

		await addDocumentToIndexedDB(page, {
			id: 'doc_md_export',
			name: 'my-book.md',
			type: 'markdown',
			content: '# My Book\n\nChapter content here.',
			size: 35,
			uploadedAt: new Date().toISOString(),
			phase: 'translated',
			variant: 'japanese-only'
		});

		await page.goto('/documents');
		await page.waitForLoadState('networkidle');

		const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

		const documentRow = page.locator('[data-testid="document-row"]').first();
		await expect(documentRow).toBeVisible();
		const exportPdfButton = documentRow.locator('[data-testid="export-pdf"]');
		await expect(exportPdfButton).toBeVisible();
		await exportPdfButton.click({ force: true });

		const download = await downloadPromise;
		expect(download.suggestedFilename()).toBe('my-book.pdf');
	});

	test('exported PDF file has content', async ({ page }) => {
		test.setTimeout(90000);

		await addDocumentToIndexedDB(page, {
			id: 'doc_md_mime',
			name: 'mime-test.md',
			type: 'markdown',
			content: '# MIME Test\n\nContent for MIME verification.',
			size: 45,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/documents');
		await page.waitForLoadState('networkidle');

		const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

		const documentRow = page.locator('[data-testid="document-row"]').first();
		await expect(documentRow).toBeVisible();
		const exportPdfButton = documentRow.locator('[data-testid="export-pdf"]');
		await expect(exportPdfButton).toBeVisible();
		await exportPdfButton.click({ force: true });

		const download = await downloadPromise;
		const path = await download.path();
		expect(path).toBeTruthy();

		const fs = await import('fs/promises');
		const stat = await fs.stat(path!);
		expect(stat.size).toBeGreaterThan(0);
	});

	test('Export PDF button has tooltip indicating its purpose', async ({ page }) => {
		await addDocumentToIndexedDB(page, {
			id: 'doc_tooltip',
			name: 'tooltip-test.md',
			type: 'markdown',
			content: '# Tooltip Test',
			size: 15,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/documents');

		const documentRow = page.locator('[data-testid="document-row"]').first();
		const exportPdfButton = documentRow.locator('[data-testid="export-pdf"]');

		await expect(exportPdfButton).toHaveAttribute('title', /pdf/i);
	});
});
