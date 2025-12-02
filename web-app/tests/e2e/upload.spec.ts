import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// ES module path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('IndexedDB Large File Storage', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Clear both localStorage and IndexedDB
		await page.evaluate(async () => {
			localStorage.clear();
			// Clear IndexedDB
			const databases = await indexedDB.databases();
			for (const db of databases) {
				if (db.name) indexedDB.deleteDatabase(db.name);
			}
		});
	});

	test('large PDF (6MB) persists after navigation using IndexedDB', async ({ page }) => {
		// Create a 6MB PDF - this would fail with localStorage (5MB limit)
		const largePdfContent = '%PDF-1.4\n' + 'x'.repeat(6 * 1024 * 1024);

		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'large-document.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from(largePdfContent)
		});

		// Verify file appears on upload page
		await expect(page.getByText('large-document.pdf')).toBeVisible({ timeout: 10000 });

		// Should NOT show any storage error
		await expect(page.locator('[data-testid="upload-error"]')).not.toBeVisible();

		// Navigate to Convert PDF page
		await page.click('a[href="/convert"]');
		await expect(page).toHaveURL('/convert');

		// The large file should appear in the dropdown (proves it persisted)
		const select = page.locator('select');
		const options = await select.locator('option').allTextContents();
		expect(options).toContain('large-document.pdf');
	});

	test('documents are stored in IndexedDB, not localStorage', async ({ page }) => {
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'indexeddb-test.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from('%PDF-1.4 test content')
		});

		await expect(page.getByText('indexeddb-test.pdf')).toBeVisible({ timeout: 5000 });

		// localStorage should NOT contain the documents (or be empty/minimal)
		const localStorageDocs = await page.evaluate(() => {
			return localStorage.getItem('documents');
		});
		// After migration, localStorage should not have full document content
		expect(localStorageDocs).toBeNull();

		// IndexedDB should contain the document
		const indexedDBDocs = await page.evaluate(async () => {
			return new Promise((resolve) => {
				const request = indexedDB.open('book-translate-db', 1);
				request.onsuccess = () => {
					const db = request.result;
					const tx = db.transaction('documents', 'readonly');
					const store = tx.objectStore('documents');
					const getAllRequest = store.getAll();
					getAllRequest.onsuccess = () => {
						resolve(getAllRequest.result);
					};
					getAllRequest.onerror = () => resolve([]);
				};
				request.onerror = () => resolve([]);
			});
		});
		expect(Array.isArray(indexedDBDocs)).toBe(true);
		expect((indexedDBDocs as any[]).length).toBe(1);
		expect((indexedDBDocs as any[])[0].name).toBe('indexeddb-test.pdf');
	});

	test('PDFs are stored as Blobs without base64 encoding', async ({ page }) => {
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'blob-test.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from('%PDF-1.4 blob test content')
		});

		await expect(page.getByText('blob-test.pdf')).toBeVisible({ timeout: 5000 });

		// Check that the stored content is a Blob, not a base64 string
		const docContent = await page.evaluate(async () => {
			return new Promise((resolve) => {
				const request = indexedDB.open('book-translate-db', 1);
				request.onsuccess = () => {
					const db = request.result;
					const tx = db.transaction('documents', 'readonly');
					const store = tx.objectStore('documents');
					const getAllRequest = store.getAll();
					getAllRequest.onsuccess = () => {
						const docs = getAllRequest.result;
						if (docs.length > 0) {
							const content = docs[0].content;
							resolve({
								isBlob: content instanceof Blob,
								type: typeof content,
								constructorName: content?.constructor?.name
							});
						} else {
							resolve({ isBlob: false, type: 'none', constructorName: 'none' });
						}
					};
				};
				request.onerror = () => resolve({ isBlob: false, type: 'error', constructorName: 'error' });
			});
		});

		// PDF content should be stored as a Blob
		expect((docContent as any).isBlob).toBe(true);
	});
});

test.describe('Large File Upload Workflow', () => {
	test('uploaded file persists when navigating to Convert PDF page', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(async () => {
			localStorage.clear();
			const databases = await indexedDB.databases();
			for (const db of databases) {
				if (db.name) indexedDB.deleteDatabase(db.name);
			}
		});

		// Upload a file
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'test-document.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from('%PDF-1.4 test content')
		});

		// Verify file appears on upload page
		await expect(page.getByText('test-document.pdf')).toBeVisible({ timeout: 5000 });

		// Navigate to Convert PDF page
		await page.click('a[href="/convert"]');
		await expect(page).toHaveURL('/convert');

		// The file should appear in the dropdown
		const select = page.locator('select');
		const options = await select.locator('option').allTextContents();
		expect(options).toContain('test-document.pdf');
	});

	test('file uploaded on home page appears in Convert PDF dropdown after navigation', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(async () => {
			localStorage.clear();
			const databases = await indexedDB.databases();
			for (const db of databases) {
				if (db.name) indexedDB.deleteDatabase(db.name);
			}
		});

		// Upload a reasonably sized PDF
		const pdfContent = '%PDF-1.4\n' + 'Test PDF content for workflow test';
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'workflow-test.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from(pdfContent)
		});

		// Verify file appears on upload page
		await expect(page.getByText('workflow-test.pdf')).toBeVisible({ timeout: 5000 });

		// Navigate to Convert PDF
		await page.click('a[href="/convert"]');
		await expect(page).toHaveURL('/convert');

		// Verify the file appears in the dropdown
		const select = page.locator('select');
		await expect(select).toBeVisible();

		const options = await select.locator('option').allTextContents();
		expect(options).toContain('workflow-test.pdf');

		// Should be able to select it
		await select.selectOption({ label: 'workflow-test.pdf' });

		// Convert button should be enabled
		const button = page.locator('button', { hasText: 'Convert to Markdown' });
		await expect(button).toBeEnabled();
	});
});

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

	test('stores uploaded files in IndexedDB', async ({ page }) => {
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

		// Verify it was stored in IndexedDB
		const storedDocs = await page.evaluate(async () => {
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

		expect((storedDocs as any[]).length).toBeGreaterThan(0);
		expect((storedDocs as any[]).some((doc: any) => doc.name === testFileName)).toBe(true);
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

		// Delete the file (no confirmation dialog exists)
		await page.locator('[data-testid="delete-file"]').first().click();

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

		// Verify content was stored correctly in IndexedDB
		const storedDocs = await page.evaluate(async () => {
			return new Promise((resolve) => {
				const request = indexedDB.open('book-translate-db', 1);
				request.onsuccess = () => {
					const db = request.result;
					const tx = db.transaction('documents', 'readonly');
					const store = tx.objectStore('documents');
					const getAllRequest = store.getAll();
					getAllRequest.onsuccess = () => {
						const docs = getAllRequest.result;
						// Return doc info without Blob content (can't serialize Blob)
						resolve(docs.map((d: any) => ({
							name: d.name,
							type: d.type,
							hasContent: d.content instanceof Blob || (typeof d.content === 'string' && d.content.length > 0)
						})));
					};
					getAllRequest.onerror = () => resolve([]);
				};
				request.onerror = () => resolve([]);
			});
		});

		expect((storedDocs as any[]).length).toBe(1);
		expect((storedDocs as any[])[0].type).toBe('pdf');
		expect((storedDocs as any[])[0].hasContent).toBe(true);
	});

});
