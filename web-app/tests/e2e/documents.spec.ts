import { test, expect } from '@playwright/test';

test.describe('Documents Page - Basic Display', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Clear IndexedDB
		await page.evaluate(async () => {
			const databases = await indexedDB.databases();
			for (const db of databases) {
				if (db.name) indexedDB.deleteDatabase(db.name);
			}
		});
	});

	test('displays documents page with correct heading', async ({ page }) => {
		await page.goto('/documents');

		await expect(page.locator('h1')).toContainText('My Documents');
	});

	test('shows empty state when no documents exist', async ({ page }) => {
		await page.goto('/documents');

		await expect(page.getByText('No documents yet')).toBeVisible();
	});

	test('displays uploaded documents in the list', async ({ page }) => {
		// First upload a file on the home page
		await page.goto('/');
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'test-document.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Test Document\n\nContent here.')
		});

		await expect(page.getByText('test-document.md')).toBeVisible({ timeout: 5000 });

		// Navigate to documents page
		await page.click('a[href="/documents"]');
		await expect(page).toHaveURL('/documents');

		// Document should appear in the list
		await expect(page.getByText('test-document.md')).toBeVisible();
	});

	test('displays document metadata: name, type, size, date', async ({ page }) => {
		// Upload a file first
		await page.goto('/');
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'metadata-test.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from('%PDF-1.4 test content for size')
		});

		await expect(page.getByText('metadata-test.pdf')).toBeVisible({ timeout: 5000 });

		// Navigate to documents page
		await page.goto('/documents');

		// Check document row has all metadata
		const documentRow = page.locator('[data-testid="document-row"]').first();
		await expect(documentRow).toBeVisible();

		// Should show file name
		await expect(documentRow).toContainText('metadata-test.pdf');

		// Should show file type
		await expect(documentRow).toContainText('PDF');

		// Should show file size (some number with unit)
		await expect(documentRow).toContainText(/\d+\s*(B|KB|MB)/i);

		// Should show upload date
		await expect(documentRow).toContainText(/\d{1,2}\/\d{1,2}\/\d{2,4}|today|just now/i);
	});

	test('displays document phase as "Uploaded" for new uploads', async ({ page }) => {
		// Upload a file
		await page.goto('/');
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'phase-test.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Test')
		});

		await expect(page.getByText('phase-test.md')).toBeVisible({ timeout: 5000 });

		// Navigate to documents page
		await page.goto('/documents');

		// Document should show "Uploaded" phase
		const documentRow = page.locator('[data-testid="document-row"]').first();
		await expect(documentRow).toContainText('Uploaded');
	});
});

test.describe('Documents Page - Workflow Phase Filters', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Clear IndexedDB
		await page.evaluate(async () => {
			const databases = await indexedDB.databases();
			for (const db of databases) {
				if (db.name) indexedDB.deleteDatabase(db.name);
			}
		});
	});

	test('displays workflow phase filter tabs in correct order', async ({ page }) => {
		await page.goto('/documents');

		const filterSection = page.locator('[data-testid="phase-filters"]');
		await expect(filterSection).toBeVisible();

		// Tabs should be in workflow order: All, Uploaded, Converted, Cleaned, Translated
		const tabs = filterSection.locator('button');
		const tabTexts = await tabs.allTextContents();

		expect(tabTexts).toEqual(['All', 'Uploaded', 'Converted', 'Cleaned', 'Translated']);
	});

	test('All filter is selected by default', async ({ page }) => {
		await page.goto('/documents');

		const allTab = page.locator('[data-testid="filter-all"]');
		await expect(allTab).toHaveClass(/bg-blue-100/);
	});

	test('clicking a filter tab activates it', async ({ page }) => {
		await page.goto('/documents');

		// Wait for the filter section to be fully loaded
		const filterSection = page.locator('[data-testid="phase-filters"]');
		await expect(filterSection).toBeVisible();

		// First verify All tab is active (initial state)
		const allTab = page.locator('[data-testid="filter-all"]');
		await expect(allTab).toHaveClass(/bg-blue-100/);

		// Click the Uploaded tab
		const uploadedTab = page.locator('[data-testid="filter-uploaded"]');
		await uploadedTab.click();

		// Wait for the Uploaded tab to become active
		await expect(uploadedTab).toHaveClass(/bg-blue-100/);

		// All tab should no longer be active
		await expect(allTab).not.toHaveClass(/bg-blue-100/);
	});

	test('filter tabs filter documents by phase', async ({ page }) => {
		// Upload a file (will be in "Uploaded" phase)
		await page.goto('/');
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'filter-test.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Test')
		});

		await expect(page.getByText('filter-test.md')).toBeVisible({ timeout: 5000 });

		// Navigate to documents page
		await page.goto('/documents');

		// Document should be visible with "All" filter
		await expect(page.getByText('filter-test.md')).toBeVisible();

		// Document should be visible with "Uploaded" filter
		await page.locator('[data-testid="filter-uploaded"]').click();
		await expect(page.getByText('filter-test.md')).toBeVisible();

		// Document should NOT be visible with "Converted" filter
		await page.locator('[data-testid="filter-converted"]').click();
		await expect(page.getByText('filter-test.md')).not.toBeVisible();
		await expect(page.getByText('No documents match')).toBeVisible();
	});
});

test.describe('Documents Page - Search', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Clear IndexedDB
		await page.evaluate(async () => {
			const databases = await indexedDB.databases();
			for (const db of databases) {
				if (db.name) indexedDB.deleteDatabase(db.name);
			}
		});
	});

	test('search input is present', async ({ page }) => {
		await page.goto('/documents');

		const searchInput = page.locator('[data-testid="document-search"]');
		await expect(searchInput).toBeVisible();
		await expect(searchInput).toHaveAttribute('placeholder', /search/i);
	});

	test('search filters documents by name', async ({ page }) => {
		// Upload multiple files
		await page.goto('/');
		const fileInput = page.locator('input[type="file"]');

		await fileInput.setInputFiles({
			name: 'apple-document.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Apple')
		});
		await expect(page.getByText('apple-document.md')).toBeVisible({ timeout: 5000 });

		await fileInput.setInputFiles({
			name: 'banana-report.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Banana')
		});
		await expect(page.getByText('banana-report.md')).toBeVisible({ timeout: 5000 });

		// Navigate to documents page
		await page.goto('/documents');

		// Both documents should be visible
		await expect(page.getByText('apple-document.md')).toBeVisible();
		await expect(page.getByText('banana-report.md')).toBeVisible();

		// Search for "apple"
		const searchInput = page.locator('[data-testid="document-search"]');
		await searchInput.fill('apple');

		// Only apple should be visible
		await expect(page.getByText('apple-document.md')).toBeVisible();
		await expect(page.getByText('banana-report.md')).not.toBeVisible();
	});

	test('search is case-insensitive', async ({ page }) => {
		await page.goto('/');
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'MyDocument.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Test')
		});
		await expect(page.getByText('MyDocument.md')).toBeVisible({ timeout: 5000 });

		await page.goto('/documents');

		const searchInput = page.locator('[data-testid="document-search"]');
		await searchInput.fill('mydocument');

		await expect(page.getByText('MyDocument.md')).toBeVisible();
	});
});

test.describe('Documents Page - Document Actions', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Clear IndexedDB
		await page.evaluate(async () => {
			const databases = await indexedDB.databases();
			for (const db of databases) {
				if (db.name) indexedDB.deleteDatabase(db.name);
			}
		});
	});

	test('each document row has a delete button', async ({ page }) => {
		await page.goto('/');
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'delete-action-test.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Test')
		});
		await expect(page.getByText('delete-action-test.md')).toBeVisible({ timeout: 5000 });

		await page.goto('/documents');

		const deleteButton = page.locator('[data-testid="document-row"]').first().locator('[data-testid="delete-document"]');
		await expect(deleteButton).toBeVisible();
	});

	test('clicking delete removes the document', async ({ page }) => {
		await page.goto('/');
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'to-be-deleted.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Test')
		});
		await expect(page.getByText('to-be-deleted.md')).toBeVisible({ timeout: 5000 });

		await page.goto('/documents');
		await expect(page.getByText('to-be-deleted.md')).toBeVisible();

		// Click delete
		const deleteButton = page.locator('[data-testid="document-row"]').first().locator('[data-testid="delete-document"]');
		await deleteButton.click();

		// Document should be removed
		await expect(page.getByText('to-be-deleted.md')).not.toBeVisible({ timeout: 5000 });
	});
});
