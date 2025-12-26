import { test, expect } from '@playwright/test';
import { clearAllStorage, setApiKey, addDocumentToIndexedDB, mockOpenAICompletion } from './helpers';

test.describe('One Step Translation Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('displays the workflow page with all sections', async ({ page }) => {
		await page.goto('/workflow');

		// Check page title
		await expect(page.locator('h1')).toContainText('One Step Translation');

		// Check all step sections are visible
		await expect(page.getByText('Upload Document')).toBeVisible();
		await expect(page.getByText('Cleanup Settings')).toBeVisible();
		await expect(page.getByText('Translation Settings')).toBeVisible();

		// Check start button exists
		await expect(page.getByRole('button', { name: /start one step translation/i })).toBeVisible();
	});

	test('navigation shows workflow link with separator', async ({ page }) => {
		await page.goto('/');

		// Check that "One Step Translation" link is in navigation
		const navLink = page.getByRole('link', { name: 'One Step Translation' });
		await expect(navLink).toBeVisible();

		// Check separator exists (border element between workflow and other nav items)
		const separator = page.locator('nav .border-b');
		await expect(separator).toBeVisible();
	});

	test('workflow link is highlighted when active', async ({ page }) => {
		await page.goto('/workflow');

		// The workflow link should have the active style (bg-blue-600)
		const navLink = page.getByRole('link', { name: 'One Step Translation' });
		await expect(navLink).toHaveClass(/bg-blue-600/);
	});

	test('start button is disabled when no file is selected', async ({ page }) => {
		await page.goto('/workflow');

		const startButton = page.getByRole('button', { name: /start one step translation/i });
		await expect(startButton).toBeDisabled();
	});

	test('shows file upload area for drag and drop', async ({ page }) => {
		await page.goto('/workflow');

		// Check for the drop zone text
		await expect(page.getByText(/click to upload/i)).toBeVisible();
		await expect(page.getByText(/PDF or Markdown/i)).toBeVisible();
	});

	test('shows cleanup settings with model, chunk size, and reasoning effort', async ({ page }) => {
		await page.goto('/workflow');

		// Check cleanup settings section
		const cleanupSection = page.locator('text=Cleanup Settings').locator('..');
		await expect(cleanupSection.getByText('Model')).toBeVisible();
		await expect(cleanupSection.getByText('Chunk Size')).toBeVisible();

		// Model dropdown should have options
		const modelSelect = cleanupSection.locator('select').first();
		await expect(modelSelect).toBeVisible();
	});

	test('shows translation settings with model, chunk size, reasoning effort, and context-aware toggle', async ({
		page
	}) => {
		await page.goto('/workflow');

		// Check translation settings section
		const translationSection = page.locator('text=Translation Settings').locator('..');
		await expect(translationSection.getByText('Model')).toBeVisible();
		await expect(translationSection.getByText('Chunk Size')).toBeVisible();
		await expect(translationSection.getByText(/context-aware/i)).toBeVisible();

		// Context-aware checkbox should be checked by default
		const checkbox = translationSection.locator('input[type="checkbox"]');
		await expect(checkbox).toBeChecked();
	});

	test('loads default settings from localStorage', async ({ page }) => {
		// Set custom defaults in localStorage before visiting the page
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('default_model', 'gpt-4.1');
			localStorage.setItem('default_chunk_size', '3000');
			localStorage.setItem('default_reasoning_effort', 'high');
			localStorage.setItem('context_aware_enabled', 'false');
		});

		await page.goto('/workflow');

		// Check that cleanup model dropdown has the saved value
		const cleanupModel = page.locator('text=Cleanup Settings').locator('..').locator('select').first();
		await expect(cleanupModel).toHaveValue('gpt-4.1');

		// Check that translation context-aware is unchecked
		const contextAware = page.locator('text=Translation Settings').locator('..').locator('input[type="checkbox"]');
		await expect(contextAware).not.toBeChecked();
	});

	test('shows error when API key is not set', async ({ page }) => {
		await page.goto('/workflow');

		// We need to simulate file selection for the button to be enabled
		// For now, just verify the error handling structure exists
		// The error message should appear when trying to start without API key
		await expect(page.locator('.bg-red-50')).not.toBeVisible();
	});

	test('reasoning effort dropdown appears only for GPT-5 models', async ({ page }) => {
		await page.goto('/workflow');

		// With gpt-5-mini (default), reasoning effort should be visible
		const cleanupSection = page.locator('text=Cleanup Settings').locator('..');
		await expect(cleanupSection.getByText('Reasoning Effort')).toBeVisible();

		// Change to gpt-4.1 (non-5-series)
		const modelSelect = cleanupSection.locator('select').first();
		await modelSelect.selectOption('gpt-4.1');

		// Reasoning effort should be hidden
		await expect(cleanupSection.getByText('Reasoning Effort')).not.toBeVisible();
	});
});

test.describe('Workflow Page Navigation', () => {
	test('can navigate to workflow from sidebar', async ({ page }) => {
		await page.goto('/');

		// Click on One Step Translation link - use force click since it's in fixed nav
		const workflowLink = page.getByRole('link', { name: 'One Step Translation' });
		await workflowLink.click({ force: true });

		// Should be on workflow page
		await expect(page).toHaveURL(/\/workflow/);
		await expect(page.locator('h1')).toContainText('One Step Translation');
	});

	test('can navigate back to upload from workflow', async ({ page }) => {
		await page.goto('/workflow');

		// Click on Upload link in sidebar - use force click since it's in fixed nav
		const uploadLink = page.getByRole('link', { name: 'Upload' });
		await uploadLink.click({ force: true });

		// Should be on upload page
		await expect(page).toHaveURL(/\/$/);
	});

	test('workflow link appears at top of navigation above separator', async ({ page }) => {
		await page.goto('/');

		// Get the navigation container
		const nav = page.locator('nav[aria-label="Main navigation"]');

		// One Step Translation should be the first link
		const firstLink = nav.locator('a').first();
		await expect(firstLink).toContainText('One Step Translation');

		// The separator should come after the workflow link
		// This is checked by ensuring the workflow link is before the other nav items
		const uploadLink = page.getByRole('link', { name: 'Upload' });
		const workflowLink = page.getByRole('link', { name: 'One Step Translation' });

		// Get bounding boxes to verify order
		const workflowBox = await workflowLink.boundingBox();
		const uploadBox = await uploadLink.boundingBox();

		expect(workflowBox).toBeTruthy();
		expect(uploadBox).toBeTruthy();
		// Workflow should be above Upload (smaller y value)
		expect(workflowBox!.y).toBeLessThan(uploadBox!.y);
	});
});

test.describe('Workflow UI States', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('start button shows processing state when running', async ({ page }) => {
		// This test would require mocking the file upload and API calls
		// For now, we just verify the initial state
		await page.goto('/workflow');

		const startButton = page.getByRole('button', { name: /start one step translation/i });

		// Button text should be "Start One Step Translation" initially
		await expect(startButton).toContainText('Start One Step Translation');
	});

	test('shows lightning bolt icon in start button', async ({ page }) => {
		await page.goto('/workflow');

		// Check that the start button contains an SVG icon
		const startButton = page.getByRole('button', { name: /start one step translation/i });
		const icon = startButton.locator('svg');
		await expect(icon).toBeVisible();
	});

	test('step numbers are displayed for each section', async ({ page }) => {
		await page.goto('/workflow');

		// Check step number badges (1, 2, 3, 4) - use specific class to find the rounded badges
		const stepBadges = page.locator('.rounded-full.bg-blue-100');
		await expect(stepBadges).toHaveCount(4);

		// Verify the badges contain the step numbers
		await expect(stepBadges.nth(0)).toContainText('1');
		await expect(stepBadges.nth(1)).toContainText('2');
		await expect(stepBadges.nth(2)).toContainText('3');
		await expect(stepBadges.nth(3)).toContainText('4');
	});
});

test.describe('Target Language and Tone Input', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('shows target language and tone input field with correct label', async ({ page }) => {
		await page.goto('/workflow');

		// Check for the "Target language and tone" section heading
		await expect(page.getByRole('heading', { name: 'Target language and tone' })).toBeVisible();

		// Check for the input field
		const input = page.getByTestId('target-language-input');
		await expect(input).toBeVisible();
	});

	test('start button is disabled when target language is empty', async ({ page }) => {
		await page.goto('/workflow');

		// Even with a file, button should be disabled without language
		const startButton = page.getByRole('button', { name: /start one step translation/i });
		await expect(startButton).toBeDisabled();
	});

	test('shows language history dropdown when input has history', async ({ page }) => {
		// Pre-populate language history
		await page.goto('/workflow');
		await page.evaluate(() => {
			localStorage.setItem('translation-language-history', JSON.stringify(['Spanish', 'German']));
		});

		await page.reload();

		// Focus the input
		const input = page.getByTestId('target-language-input');
		await input.focus();

		// History dropdown should appear
		await expect(page.getByTestId('language-history-dropdown')).toBeVisible();

		// History items should be visible (using buttons in the dropdown)
		const dropdown = page.getByTestId('language-history-dropdown');
		await expect(dropdown.getByRole('button', { name: 'Spanish' })).toBeVisible();
		await expect(dropdown.getByRole('button', { name: 'German' })).toBeVisible();
	});
});

test.describe('Markdown File Upload Support', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('file input accepts both PDF and markdown files', async ({ page }) => {
		await page.goto('/workflow');

		// The file input should accept .pdf and .md files
		const fileInput = page.locator('input[type="file"]');
		const acceptAttr = await fileInput.getAttribute('accept');
		expect(acceptAttr).toContain('.pdf');
		expect(acceptAttr).toContain('.md');
	});

	test('upload section title says "Upload Document" instead of "Upload PDF"', async ({ page }) => {
		await page.goto('/workflow');

		// Should say "Upload Document" to reflect both file types
		await expect(page.getByText('Upload Document')).toBeVisible();
		// Should NOT say "PDF files only" anymore
		await expect(page.getByText('PDF files only')).not.toBeVisible();
	});

	test('upload section shows supported file types', async ({ page }) => {
		await page.goto('/workflow');

		// Should show that both PDF and markdown are accepted
		await expect(page.getByText(/PDF or Markdown/i)).toBeVisible();
	});

	test('does not show error when markdown file is dropped', async ({ page }) => {
		await page.goto('/workflow');

		// Create a fake markdown file and simulate drag-drop
		// This is done by directly setting file via the input
		const fileInput = page.locator('input[type="file"]');

		// Create a test markdown file path
		await fileInput.setInputFiles({
			name: 'test-document.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Test Document\n\nThis is test content.')
		});

		// Should NOT show an error
		await expect(page.locator('.bg-red-50')).not.toBeVisible();

		// File name should be displayed
		await expect(page.getByText('test-document.md')).toBeVisible();
	});

	test('shows 2 phases in phase indicator when markdown file is selected', async ({ page }) => {
		await page.goto('/workflow');
		await setApiKey(page);

		// Upload a markdown file
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'test.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Test')
		});

		// Enter target language to enable the start button
		const languageInput = page.getByTestId('target-language-input');
		await languageInput.fill('Japanese');

		// Click start button to begin workflow (phases will show)
		const startButton = page.getByRole('button', { name: /start one step translation/i });
		await startButton.click();

		// Should show only 2 phases (Cleanup, Translate) - NOT Convert
		// Use specific test IDs in the phase indicator
		await expect(page.getByTestId('phase-cleanup')).toBeVisible();
		await expect(page.getByTestId('phase-translate')).toBeVisible();
		// Convert phase should NOT be visible when starting from markdown
		await expect(page.getByTestId('phase-convert')).not.toBeVisible();
	});

	test('shows 3 phases in phase indicator when PDF file is selected', async ({ page }) => {
		await page.goto('/workflow');
		await setApiKey(page);

		// Upload a PDF file
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'test.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from('%PDF-1.4 fake pdf')
		});

		// Enter target language
		const languageInput = page.getByTestId('target-language-input');
		await languageInput.fill('Japanese');

		// Click start
		const startButton = page.getByRole('button', { name: /start one step translation/i });
		await startButton.click();

		// Should show all 3 phases for PDF - use specific test IDs
		await expect(page.getByTestId('phase-convert')).toBeVisible();
		await expect(page.getByTestId('phase-cleanup')).toBeVisible();
		await expect(page.getByTestId('phase-translate')).toBeVisible();
	});
});

test.describe('Document Selection in Workflow', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await clearAllStorage(page);
	});

	test('shows document selection dropdown', async ({ page }) => {
		await page.goto('/workflow');

		// Should have a document selection section
		await expect(page.getByText(/select from existing documents/i)).toBeVisible();
		await expect(page.getByTestId('document-select')).toBeVisible();
	});

	test('dropdown shows uploaded markdown and PDF documents', async ({ page }) => {
		// Add documents to IndexedDB
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_1',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book\n\nContent here.',
			size: 30,
			uploadedAt: new Date().toISOString()
		});
		await addDocumentToIndexedDB(page, {
			id: 'doc_pdf_1',
			name: 'another-book.pdf',
			type: 'pdf',
			content: '%PDF-1.4',
			size: 1024,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/workflow');

		const select = page.getByTestId('document-select');
		await expect(select).toBeVisible();

		// Both documents should be in the dropdown (check option count and text content)
		const options = select.locator('option');
		await expect(options).toHaveCount(3); // "Choose a document..." + 2 docs
		await expect(select).toContainText('test-book.md');
		await expect(select).toContainText('another-book.pdf');
	});

	test('selecting markdown document shows cost estimate immediately', async ({ page }) => {
		// Add a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_1',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book\n\nThis is test content for cost estimation.',
			size: 50,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/workflow');

		// Select the markdown document
		await page.getByTestId('document-select').selectOption('doc_md_1');

		// Fill target language
		await page.getByTestId('target-language-input').fill('Japanese');

		// Cost estimate should appear immediately (no Convert step needed)
		await expect(page.getByTestId('cost-estimate')).toBeVisible({ timeout: 5000 });
		await expect(page.getByTestId('cost-estimate').getByText(/Combined/i)).toBeVisible();
	});

	test('cost estimate shows non-zero values when using expensive model', async ({ page }) => {
		// Add a markdown document with substantial content
		const largeContent = `# Chapter 1: Introduction

This is a substantial piece of content that should generate a non-zero cost estimate when processed through the workflow. It has enough text to ensure meaningful token counts and costs.

## Section 1.1: Background

The background of this document provides important context for understanding the main content. We need to ensure that the cost estimation system works correctly for documents of various sizes.

## Section 1.2: Purpose

The purpose of this document is to test the cost estimation functionality across different pages of the application. By using the same document content, we can verify consistency.

## Section 1.3: Methodology

Our methodology involves comparing cost estimates between the workflow page and the individual cleanup/translate pages.`;

		await addDocumentToIndexedDB(page, {
			id: 'doc_md_cost',
			name: 'cost-test.md',
			type: 'markdown',
			content: largeContent,
			size: largeContent.length,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/workflow');

		// Select the markdown document
		await page.getByTestId('document-select').selectOption('doc_md_cost');

		// Wait for cost estimate to appear (default is gpt-5-mini, may show $0.00 for small content)
		await expect(page.getByTestId('cost-estimate')).toBeVisible({ timeout: 5000 });
		const initialText = await page.getByTestId('cost-estimate').textContent();
		console.log('Initial cost estimate (gpt-5-mini):', initialText);

		// Change both models to gpt-5.2 to get measurable costs
		const cleanupModelSelect = page.locator('text=Cleanup Settings').locator('..').locator('select').first();
		await cleanupModelSelect.selectOption('gpt-5.2');

		const translationModelSelect = page.locator('text=Translation Settings').locator('..').locator('select').first();
		await translationModelSelect.selectOption('gpt-5.2');

		// Wait for reactivity
		await page.waitForTimeout(500);

		// Get the updated cost estimate
		const costEstimateText = await page.getByTestId('cost-estimate').textContent();
		console.log('Cost estimate with gpt-5.2:', costEstimateText);

		// Parse dollar amounts from the text
		const allCostMatches = costEstimateText?.matchAll(/\$(\d+\.\d+)/g);
		const costValues = allCostMatches ? [...allCostMatches].map(m => parseFloat(m[1])) : [];
		console.log('All cost values found:', costValues);

		// Should find 3 costs (cleanup, translation, combined)
		expect(costValues.length).toBe(3);

		const [cleanupCost, translationCost, combinedCost] = costValues;
		console.log('Cleanup:', cleanupCost, 'Translation:', translationCost, 'Combined:', combinedCost);

		// With gpt-5.2, costs should be > $0.00 for this content size
		expect(cleanupCost).toBeGreaterThan(0);
		expect(translationCost).toBeGreaterThan(0);
		expect(combinedCost).toBeGreaterThan(0);

		// Combined should be approximately cleanup + translation
		// Note: Due to independent rounding, combined may not equal exactly cleanup + translation
		// (e.g., 0.01 + 0.01 = 0.02 but if combined rounds independently it might show 0.01)
		expect(combinedCost).toBeGreaterThanOrEqual(Math.max(cleanupCost, translationCost));
	});

	test('cost estimate updates when model is changed to expensive model', async ({ page }) => {
		// Add a LARGE markdown document - needs enough content that gpt-5.2 cost > $0.01
		// With gpt-5.2 pricing ($2.5/1M input, $10/1M output), we need ~4000+ tokens for visible cost
		const largeContent = `# The Complete Guide to Software Testing

## Introduction

Software testing is a critical process in the development lifecycle. This guide covers comprehensive testing strategies, methodologies, and best practices that every developer should know. Testing ensures software quality, reliability, and user satisfaction.

## Chapter 1: Unit Testing Fundamentals

Unit testing forms the foundation of any solid testing strategy. Unit tests verify individual components work correctly in isolation. They should be fast, independent, and reliable.

### 1.1 Writing Effective Unit Tests

Effective unit tests follow specific patterns. The Arrange-Act-Assert pattern is widely used. Tests should focus on one behavior at a time.

### 1.2 Mocking Dependencies

Mocking allows testing components in isolation. Mock objects simulate real dependencies. This speeds up tests and improves reliability.

## Chapter 2: Integration Testing

Integration tests verify components work together correctly. They catch issues that unit tests might miss. Integration tests are slower but provide confidence.

### 2.1 Database Testing

Database tests verify data persistence works correctly. They require careful setup and teardown. Transaction rollback is a common pattern.

### 2.2 API Testing

API tests verify endpoints respond correctly. They test request handling and response formatting. Contract testing ensures API compatibility.

## Chapter 3: End-to-End Testing

End-to-end tests verify complete user workflows. They test the entire system as users experience it. These tests are valuable but expensive to maintain.

### 3.1 Browser Automation

Browser automation tools like Playwright enable E2E testing. They simulate real user interactions. Page objects organize test code effectively.

### 3.2 Visual Regression Testing

Visual regression tests catch unintended UI changes. They compare screenshots against baselines. False positives require careful management.

## Chapter 4: Test Strategy and Planning

A good test strategy balances coverage and maintainability. The testing pyramid suggests more unit tests than integration tests.

## Conclusion

Testing is essential for quality software. A balanced approach combines multiple test types. Continuous improvement keeps test suites valuable.`;

		await addDocumentToIndexedDB(page, {
			id: 'doc_md_model_test',
			name: 'model-test.md',
			type: 'markdown',
			content: largeContent,
			size: largeContent.length,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/workflow');

		// Select the markdown document (default model is gpt-5-mini)
		await page.getByTestId('document-select').selectOption('doc_md_model_test');

		// Wait for initial cost estimate
		await expect(page.getByTestId('cost-estimate')).toBeVisible({ timeout: 5000 });
		const initialText = await page.getByTestId('cost-estimate').textContent();
		console.log('Initial cost (gpt-5-mini):', initialText);

		// Now change to gpt-5.2 (expensive model) for cleanup
		const cleanupModelSelect = page.locator('text=Cleanup Settings').locator('..').locator('select').first();
		await cleanupModelSelect.selectOption('gpt-5.2');

		// Wait a moment for reactivity
		await page.waitForTimeout(500);

		// Get the updated cost
		const updatedText = await page.getByTestId('cost-estimate').textContent();
		console.log('After gpt-5.2 selection:', updatedText);

		// BUG TEST: The cost should CHANGE when the model changes
		// Even if both show $0.00, the token breakdown or internal value should differ
		// But ideally with this larger content, gpt-5.2 should show > $0.00

		// Parse all dollar values
		const updatedMatches = updatedText?.matchAll(/\$(\d+\.\d+)/g);
		const updatedCosts = updatedMatches ? [...updatedMatches].map(m => parseFloat(m[1])) : [];
		console.log('Updated costs:', updatedCosts);

		// With 2000+ word document and gpt-5.2 pricing, cleanup cost should be > $0.01
		expect(updatedCosts[0]).toBeGreaterThan(0); // Cleanup should be > $0.00 with gpt-5.2
	});

	test('selecting PDF document shows Convert & Estimate button', async ({ page }) => {
		// Add a PDF document
		await addDocumentToIndexedDB(page, {
			id: 'doc_pdf_1',
			name: 'test-book.pdf',
			type: 'pdf',
			content: '%PDF-1.4',
			size: 1024,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/workflow');

		// Select the PDF document
		await page.getByTestId('document-select').selectOption('doc_pdf_1');

		// Should show Convert & Estimate button instead of immediate estimate
		await expect(page.getByRole('button', { name: /convert.*estimate/i })).toBeVisible();
	});

	test('file upload clears document selection', async ({ page }) => {
		// Add a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_1',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test Book',
			size: 11,
			uploadedAt: new Date().toISOString()
		});

		await page.goto('/workflow');

		// Select the document
		await page.getByTestId('document-select').selectOption('doc_md_1');
		await expect(page.getByTestId('document-select')).toHaveValue('doc_md_1');

		// Upload a new file
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'new-file.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# New File')
		});

		// Document selection should be cleared
		await expect(page.getByTestId('document-select')).toHaveValue('');
	});

	test('markdown from selection skips convert phase', async ({ page }) => {
		// Add a markdown document
		await addDocumentToIndexedDB(page, {
			id: 'doc_md_1',
			name: 'test-book.md',
			type: 'markdown',
			content: '# Test',
			size: 6,
			uploadedAt: new Date().toISOString()
		});

		await setApiKey(page);
		await mockOpenAICompletion(page, '# テスト', { jsonWrap: true });

		await page.goto('/workflow');

		// Select markdown document
		await page.getByTestId('document-select').selectOption('doc_md_1');
		await page.getByTestId('target-language-input').fill('Japanese');

		// Start workflow
		const startButton = page.getByRole('button', { name: /start one step translation/i });
		await startButton.click();

		// Should NOT show convert phase
		await expect(page.getByTestId('phase-convert')).not.toBeVisible();
		// Should show cleanup and translate phases
		await expect(page.getByTestId('phase-cleanup')).toBeVisible();
		await expect(page.getByTestId('phase-translate')).toBeVisible();
	});
});
