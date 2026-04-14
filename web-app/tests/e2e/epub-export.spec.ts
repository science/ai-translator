import { test, expect } from '@playwright/test';
import { clearAllStorage, addDocumentToIndexedDB, validateEpubWithEpubcheck } from './helpers';
import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '..', 'fixtures');

/**
 * Tests for EPUB export feature on documents page
 */
test.describe('EPUB Export - Documents Page', () => {
	test.describe.configure({ mode: 'serial' });
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('markdown documents show "Export EPUB" button', async ({ page }) => {
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
		const exportEpubButton = documentRow.locator('[data-testid="export-epub"]');
		await expect(exportEpubButton).toBeVisible();
	});

	test('PDF documents do NOT show "Export EPUB" button', async ({ page }) => {
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
		const exportEpubButton = documentRow.locator('[data-testid="export-epub"]');
		await expect(exportEpubButton).not.toBeVisible();
	});

	test('clicking "Export EPUB" triggers download with .epub extension', async ({ page }) => {
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
		const exportEpubButton = documentRow.locator('[data-testid="export-epub"]');
		await expect(exportEpubButton).toBeVisible();
		await exportEpubButton.click({ force: true });

		const download = await downloadPromise;
		expect(download.suggestedFilename()).toBe('my-book.epub');
	});

	test('exported EPUB file has content', async ({ page }) => {
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
		const exportEpubButton = documentRow.locator('[data-testid="export-epub"]');
		await expect(exportEpubButton).toBeVisible();
		await exportEpubButton.click({ force: true });

		const download = await downloadPromise;
		const path = await download.path();
		expect(path).toBeTruthy();

		const fs = await import('fs/promises');
		const stat = await fs.stat(path!);
		expect(stat.size).toBeGreaterThan(0);
	});

	test('Japanese markdown content exports to EPUB', async ({ page }) => {
		test.setTimeout(90000);

		await addDocumentToIndexedDB(page, {
			id: 'doc_ja',
			name: 'japanese-content.md',
			type: 'markdown',
			content: '# 日本語テスト\n\nこれはテストコンテンツです。\n\n## セクション\n\n本文がここにあります。',
			size: 100,
			uploadedAt: new Date().toISOString(),
			phase: 'translated',
			variant: 'japanese-only'
		});

		await page.goto('/documents');
		await page.waitForLoadState('networkidle');

		const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

		const documentRow = page.locator('[data-testid="document-row"]').first();
		await expect(documentRow).toBeVisible();
		const exportEpubButton = documentRow.locator('[data-testid="export-epub"]');
		await expect(exportEpubButton).toBeVisible();
		await exportEpubButton.click({ force: true });

		const download = await downloadPromise;
		expect(download.suggestedFilename()).toBe('japanese-content.epub');
	});

	test('Export EPUB button has tooltip indicating its purpose', async ({ page }) => {
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
		const exportEpubButton = documentRow.locator('[data-testid="export-epub"]');

		await expect(exportEpubButton).toHaveAttribute('title', /epub/i);
	});
});

/**
 * EPUB Validation tests using epubcheck.
 * Each test loads a realistic markdown fixture, exports it as EPUB via the browser,
 * then validates the resulting file with the system epubcheck CLI.
 */
test.describe('EPUB Validation - epubcheck', () => {
	test.describe.configure({ mode: 'serial' });
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	async function exportAndValidate(
		page: import('@playwright/test').Page,
		docId: string,
		filename: string,
		content: string
	) {
		await addDocumentToIndexedDB(page, {
			id: docId,
			name: filename,
			type: 'markdown',
			content,
			size: content.length,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/documents');
		await page.waitForLoadState('networkidle');

		const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

		const documentRow = page.locator('[data-testid="document-row"]').first();
		await expect(documentRow).toBeVisible();
		const exportEpubButton = documentRow.locator('[data-testid="export-epub"]');
		await expect(exportEpubButton).toBeVisible();
		await exportEpubButton.click({ force: true });

		const download = await downloadPromise;
		const epubPath = await download.path();
		expect(epubPath).toBeTruthy();

		return validateEpubWithEpubcheck(epubPath!);
	}

	test('english textbook EPUB passes epubcheck validation', async ({ page }) => {
		test.setTimeout(120000);
		const content = await readFile(resolve(fixturesDir, 'english-textbook.md'), 'utf-8');
		const result = await exportAndValidate(page, 'doc_epubcheck_english', 'english-textbook.md', content);

		if (!result.valid || result.warnings > 0) {
			console.log('epubcheck messages:', JSON.stringify(result.messages, null, 2));
		}
		expect(result.errors).toBe(0);
		expect(result.warnings).toBe(0);
	});

	test('japanese book EPUB passes epubcheck validation', async ({ page }) => {
		test.setTimeout(120000);
		const content = await readFile(resolve(fixturesDir, 'japanese-book.md'), 'utf-8');
		const result = await exportAndValidate(page, 'doc_epubcheck_japanese', 'japanese-book.md', content);

		if (!result.valid || result.warnings > 0) {
			console.log('epubcheck messages:', JSON.stringify(result.messages, null, 2));
		}
		expect(result.errors).toBe(0);
		expect(result.warnings).toBe(0);
	});

	test('bilingual mixed EPUB passes epubcheck validation', async ({ page }) => {
		test.setTimeout(120000);
		const content = await readFile(resolve(fixturesDir, 'bilingual-mixed.md'), 'utf-8');
		const result = await exportAndValidate(page, 'doc_epubcheck_bilingual', 'bilingual-mixed.md', content);

		if (!result.valid || result.warnings > 0) {
			console.log('epubcheck messages:', JSON.stringify(result.messages, null, 2));
		}
		expect(result.errors).toBe(0);
		expect(result.warnings).toBe(0);
	});
});
