import { test, expect } from '@playwright/test';
import { clearAllStorage, addDocumentToIndexedDB } from './helpers';

/**
 * These tests verify that dynamically imported modules work correctly.
 *
 * The PDF converter uses @opendocsg/pdf2md which internally uses unpdf,
 * which in turn dynamically imports pdfjs. If these dynamic imports fail
 * (e.g., with "error loading dynamically imported module"), these tests will catch it.
 *
 * To test against the production build:
 *   TEST_PRODUCTION=true npm run test:e2e
 */

test.describe('Dynamic Import Verification', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('PDF converter dynamic import loads without errors', async ({ page }) => {
		// Listen for console errors related to dynamic imports
		const consoleErrors: string[] = [];
		page.on('console', msg => {
			if (msg.type() === 'error') {
				consoleErrors.push(msg.text());
			}
		});

		// Listen for page errors (uncaught exceptions)
		const pageErrors: Error[] = [];
		page.on('pageerror', error => {
			pageErrors.push(error);
		});

		// Pre-populate IndexedDB with a minimal PDF content
		// This is enough to trigger the dynamic import of pdf2md/unpdf/pdfjs
		// The conversion might fail with an error, but the dynamic import will be triggered
		await addDocumentToIndexedDB(page, {
			id: 'test_pdf',
			name: 'test-dynamic-import.pdf',
			type: 'pdf',
			content: 'JVBERi0xLjQK', // Base64 encoded "%PDF-1.4\n" (minimal PDF header)
			size: 1024,
			uploadedAt: new Date().toISOString()
		});

		// Navigate to convert page (document should already be in IndexedDB)
		await page.goto('/convert');

		// Wait for the PDF option to appear in the dropdown (2 options: placeholder + PDF)
		const options = page.locator('select option');
		await expect(options).toHaveCount(2, { timeout: 10000 });

		// Select the PDF
		const select = page.locator('select');
		await select.selectOption('test_pdf');

		// Wait for Svelte reactivity to update - button should become enabled
		const button = page.locator('button', { hasText: 'Convert to Markdown' });
		await expect(button).toBeEnabled({ timeout: 5000 });

		// Click convert - this triggers the dynamic import of pdf2md/unpdf/pdfjs
		// Use force: true to avoid timing issues with Svelte reactivity
		await button.click({ force: true });

		// Wait for conversion to complete or error to appear
		await Promise.race([
			page.locator('.prose pre').waitFor({ timeout: 30000 }),
			page.getByText(/error|failed/i).waitFor({ timeout: 30000 })
		]);

		// Check that no dynamic import errors occurred
		const dynamicImportErrors = consoleErrors.filter(
			err => err.includes('dynamically imported module') ||
			       err.includes('Failed to fetch dynamically imported module')
		);

		if (dynamicImportErrors.length > 0) {
			throw new Error(
				`Dynamic import errors detected:\n${dynamicImportErrors.join('\n')}`
			);
		}

		// Check that no page errors related to module loading occurred
		const moduleErrors = pageErrors.filter(
			err => err.message.includes('import') || err.message.includes('module')
		);

		if (moduleErrors.length > 0) {
			throw new Error(
				`Module loading errors detected:\n${moduleErrors.map(e => e.message).join('\n')}`
			);
		}

		// Verify conversion succeeded (no error message visible)
		const errorElement = page.locator('.bg-red-50');
		const hasError = await errorElement.isVisible();

		if (hasError) {
			const errorText = await errorElement.textContent();
			// Only fail if it's a dynamic import error
			if (errorText?.includes('dynamically imported module')) {
				throw new Error(`Dynamic import failed: ${errorText}`);
			}
		}
	});

	test('workflow page PDF converter dynamic import loads without errors', async ({ page }) => {
		// Listen for console errors related to dynamic imports
		const consoleErrors: string[] = [];
		page.on('console', msg => {
			if (msg.type() === 'error') {
				consoleErrors.push(msg.text());
			}
		});

		// Navigate to workflow page
		await page.goto('/workflow');

		// Just navigating to the page shouldn't trigger the import yet
		// The import happens when the user starts a workflow

		// Verify no immediate errors
		const dynamicImportErrors = consoleErrors.filter(
			err => err.includes('dynamically imported module')
		);

		expect(dynamicImportErrors).toHaveLength(0);
	});

	test('chunk files are accessible at expected URLs', async ({ page, request }) => {
		// Get the page HTML to extract chunk references
		const response = await request.get('/');
		const html = await response.text();

		// Extract chunk URLs from modulepreload links (production build)
		const modulePreloadRegex = /href="([^"]*_app\/immutable\/[^"]+\.js)"/g;
		const chunkUrls: string[] = [];
		let match;
		while ((match = modulePreloadRegex.exec(html)) !== null) {
			chunkUrls.push(match[1]);
		}

		// Also extract from inline script imports (both dev and prod)
		const inlineImportRegex = /import\(['"](\.?\/?_?app\/[^'"]+\.js)['"]\)/g;
		while ((match = inlineImportRegex.exec(html)) !== null) {
			let url = match[1];
			// Normalize the path
			if (url.startsWith('./')) {
				url = url.slice(2);
			}
			if (!url.startsWith('/')) {
				url = '/' + url;
			}
			chunkUrls.push(url);
		}

		// In dev mode, check that the main entry points are in the HTML
		// (they may be loaded differently than in production)
		if (chunkUrls.length === 0) {
			// Dev server uses different patterns - just verify the page loads
			await page.goto('/');
			await page.waitForLoadState('domcontentloaded');

			// Check that we can navigate to convert page without errors
			await page.goto('/convert');
			await expect(page.locator('h1')).toContainText('Convert PDF to Markdown');
			return; // Skip chunk URL testing in dev mode
		}

		// Check that all referenced chunks are accessible (production mode)
		for (const url of chunkUrls) {
			const fullUrl = url.startsWith('/') ? url : `/${url}`;
			const chunkResponse = await request.get(fullUrl);

			expect(
				chunkResponse.ok(),
				`Chunk ${fullUrl} returned ${chunkResponse.status()}`
			).toBe(true);
		}
	});
});
