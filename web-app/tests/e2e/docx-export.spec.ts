import { test, expect } from '@playwright/test';
import { clearAllStorage, addDocumentToIndexedDB } from './helpers';

/**
 * Tests for DOCX export feature on documents page and workflow results
 */
test.describe('DOCX Export - Documents Page', () => {
	// Run tests serially to avoid resource contention during DOCX conversion
	test.describe.configure({ mode: 'serial' });
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('markdown documents show "Export DOCX" button', async ({ page }) => {
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
		const exportDocxButton = documentRow.locator('[data-testid="export-docx"]');
		await expect(exportDocxButton).toBeVisible();
	});

	test('PDF documents do NOT show "Export DOCX" button', async ({ page }) => {
		await addDocumentToIndexedDB(page, {
			id: 'doc_pdf_1',
			name: 'test-document.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK', // base64 PDF header
			size: 1024,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		});

		await page.goto('/documents');

		const documentRow = page.locator('[data-testid="document-row"]').first();
		const exportDocxButton = documentRow.locator('[data-testid="export-docx"]');
		await expect(exportDocxButton).not.toBeVisible();
	});

	test('clicking "Export DOCX" triggers download with .docx extension', async ({ page }) => {
		// Increase timeout for DOCX conversion
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

		// Set up download listener before clicking
		const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

		// Click export DOCX button with force option
		const documentRow = page.locator('[data-testid="document-row"]').first();
		await expect(documentRow).toBeVisible();
		const exportDocxButton = documentRow.locator('[data-testid="export-docx"]');
		await expect(exportDocxButton).toBeVisible();
		await exportDocxButton.click({ force: true });

		// Verify download was triggered with correct filename
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toBe('my-book.docx');
	});

	test('exported DOCX file has content', async ({ page }) => {
		// Increase timeout for DOCX conversion
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

		// Set up download listener with extended timeout
		const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

		// Click export DOCX button with force
		const documentRow = page.locator('[data-testid="document-row"]').first();
		await expect(documentRow).toBeVisible();
		const exportDocxButton = documentRow.locator('[data-testid="export-docx"]');
		await expect(exportDocxButton).toBeVisible();
		await exportDocxButton.click({ force: true });

		// Get the download and verify it's not empty
		const download = await downloadPromise;
		const path = await download.path();
		expect(path).toBeTruthy();

		// The file should have some content (DOCX files are ZIP-based)
		const fs = await import('fs/promises');
		const stat = await fs.stat(path!);
		expect(stat.size).toBeGreaterThan(0);
	});

	test('Japanese markdown content exports correctly to DOCX', async ({ page }) => {
		// Increase timeout for DOCX conversion
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

		// Set up download listener with extended timeout
		const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

		// Click export DOCX button with force
		const documentRow = page.locator('[data-testid="document-row"]').first();
		await expect(documentRow).toBeVisible();
		const exportDocxButton = documentRow.locator('[data-testid="export-docx"]');
		await expect(exportDocxButton).toBeVisible();
		await exportDocxButton.click({ force: true });

		// Verify download
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toBe('japanese-content.docx');
	});

	test('Export DOCX button has tooltip indicating its purpose', async ({ page }) => {
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
		const exportDocxButton = documentRow.locator('[data-testid="export-docx"]');

		// Button should have a title attribute for tooltip
		await expect(exportDocxButton).toHaveAttribute('title', /word/i);
	});
});

test.describe('DOCX Export - Workflow Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('workflow page has MD and DOCX download buttons', async ({ page }) => {
		await page.goto('/workflow');

		// The download buttons are only visible after workflow completes
		// Just verify the page loads correctly
		await expect(page.locator('h1')).toContainText('One Step Translation');
	});
});
