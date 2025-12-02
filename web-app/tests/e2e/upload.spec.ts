import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// ES module path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('File Upload', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
	});

	test('displays upload dropzone', async ({ page }) => {
		await page.goto('/');

		const dropzone = page.locator('[data-testid="dropzone"]');
		await expect(dropzone).toBeVisible();
		await expect(dropzone).toContainText(/drop files here|click to browse/i);
	});

	test('shows accepted file types', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByText(/\.pdf/i)).toBeVisible();
		await expect(page.getByText(/\.md/i)).toBeVisible();
	});

	test('allows uploading a markdown file via file input', async ({ page }) => {
		await page.goto('/');

		// Create a test markdown file
		const testContent = '# Test Document\n\nThis is a test.';
		const testFileName = 'test-upload.md';

		// Find the file input
		const fileInput = page.locator('input[type="file"]');

		// Create a buffer from the content
		await fileInput.setInputFiles({
			name: testFileName,
			mimeType: 'text/markdown',
			buffer: Buffer.from(testContent)
		});

		// Verify the file appears in the uploaded files list
		await expect(page.getByText(testFileName)).toBeVisible({ timeout: 5000 });
	});

	test('allows uploading a PDF file', async ({ page }) => {
		await page.goto('/');

		// Create a minimal PDF-like content for testing
		const testFileName = 'test-upload.pdf';
		const pdfContent = '%PDF-1.4 test content';

		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: testFileName,
			mimeType: 'application/pdf',
			buffer: Buffer.from(pdfContent)
		});

		// Verify the file appears
		await expect(page.getByText(testFileName)).toBeVisible({ timeout: 5000 });
	});

	test('stores uploaded files in localStorage', async ({ page }) => {
		await page.goto('/');

		const testContent = '# Test\n\nContent';
		const testFileName = 'stored-test.md';

		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: testFileName,
			mimeType: 'text/markdown',
			buffer: Buffer.from(testContent)
		});

		// Wait for file to be processed
		await expect(page.getByText(testFileName)).toBeVisible({ timeout: 5000 });

		// Verify it was stored
		const storedDocs = await page.evaluate(() => {
			const docs = localStorage.getItem('documents');
			return docs ? JSON.parse(docs) : [];
		});

		expect(storedDocs.length).toBeGreaterThan(0);
		expect(storedDocs.some((doc: any) => doc.name === testFileName)).toBe(true);
	});

	test('displays uploaded files in recent uploads section', async ({ page }) => {
		await page.goto('/');

		// Upload a file
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'recent-test.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Test')
		});

		// Check the recent uploads section
		const recentSection = page.locator('[data-testid="recent-uploads"]');
		await expect(recentSection).toBeVisible();
		await expect(recentSection).toContainText('recent-test.md');
	});

	test('shows file size for uploaded files', async ({ page }) => {
		await page.goto('/');

		const content = '# Test\n\n'.repeat(100); // Create some content with size
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'size-test.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from(content)
		});

		// Should show file size
		await expect(page.getByText(/\d+\s*(B|KB|MB)/i)).toBeVisible({ timeout: 5000 });
	});

	test('shows delete button for uploaded files', async ({ page }) => {
		await page.goto('/');

		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'delete-test.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Test')
		});

		await expect(page.getByText('delete-test.md')).toBeVisible({ timeout: 5000 });

		// Should have a delete button
		const deleteButton = page.locator('[data-testid="delete-file"]').first();
		await expect(deleteButton).toBeVisible();
	});

	test('can delete uploaded files', async ({ page }) => {
		await page.goto('/');

		const fileName = 'to-delete.md';
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: fileName,
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Test')
		});

		await expect(page.getByText(fileName)).toBeVisible({ timeout: 5000 });

		// Delete the file
		await page.locator('[data-testid="delete-file"]').first().click();

		// Confirm deletion if there's a confirmation dialog
		const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
		if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
			await confirmButton.click();
		}

		// File should no longer be visible
		await expect(page.getByText(fileName)).not.toBeVisible({ timeout: 5000 });
	});

	test('persists uploaded files after page reload', async ({ page }) => {
		await page.goto('/');

		const fileName = 'persist-test.md';
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: fileName,
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Persistent Test')
		});

		await expect(page.getByText(fileName)).toBeVisible({ timeout: 5000 });

		// Reload the page
		await page.reload();

		// File should still be visible
		await expect(page.getByText(fileName)).toBeVisible({ timeout: 5000 });
	});

	test('handles large PDF files without stack overflow', async ({ page }) => {
		// BUG: The original code used String.fromCharCode(...new Uint8Array(result))
		// which causes "Maximum call stack size exceeded" for large files

		// Capture any page errors
		const pageErrors: string[] = [];
		page.on('pageerror', err => {
			pageErrors.push(err.message);
		});

		await page.goto('/');

		// Create a PDF large enough to trigger stack overflow (>100KB)
		// The spread operator fails around 100-200KB depending on browser
		const largePdfPath = path.resolve(__dirname, '../../../test/fixtures/Indigenous-Knowledges-in-Psychedelic-Science-Evgenia-Fotiou.pdf');

		// If fixture doesn't exist, create synthetic large PDF
		let testFilePath = largePdfPath;
		if (!fs.existsSync(largePdfPath)) {
			const syntheticPath = path.resolve(__dirname, 'temp-large-test.pdf');
			// 200KB is enough to trigger the bug
			const largeContent = '%PDF-1.4\n' + 'x'.repeat(200 * 1024);
			fs.writeFileSync(syntheticPath, largeContent);
			testFilePath = syntheticPath;
		}

		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles(testFilePath);

		// Wait for processing
		await page.waitForTimeout(2000);

		// Should NOT have stack overflow error
		expect(pageErrors).not.toContain('Maximum call stack size exceeded');
		expect(pageErrors.filter(e => e.includes('stack'))).toHaveLength(0);

		// File should appear in the list
		const fileName = path.basename(testFilePath);
		await expect(page.getByText(fileName)).toBeVisible({ timeout: 5000 });

		// Verify content was stored correctly
		const storedDocs = await page.evaluate(() => {
			const docs = localStorage.getItem('documents');
			return docs ? JSON.parse(docs) : [];
		});

		expect(storedDocs.length).toBe(1);
		expect(storedDocs[0].type).toBe('pdf');
		expect(storedDocs[0].content.length).toBeGreaterThan(0);
	});

});
