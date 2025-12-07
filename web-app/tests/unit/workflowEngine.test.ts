import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	runWorkflow,
	type WorkflowOptions,
	type WorkflowResult,
	type PhaseCallbacks
} from '$lib/services/workflowEngine';
import type { CleanupSettings, TranslationSettings } from '$lib/workflow';

// Mock services
vi.mock('$lib/services/pdfConverter', () => ({
	createPdfConverter: vi.fn()
}));

vi.mock('$lib/services/chunker', () => ({
	chunkBySize: vi.fn()
}));

vi.mock('$lib/services/rectifier', () => ({
	createRectifier: vi.fn()
}));

vi.mock('$lib/services/rectificationEngine', () => ({
	rectifyDocument: vi.fn()
}));

vi.mock('$lib/services/translator', () => ({
	createTranslator: vi.fn()
}));

vi.mock('$lib/services/translationEngine', () => ({
	translateDocument: vi.fn()
}));

import { createPdfConverter } from '$lib/services/pdfConverter';
import { chunkBySize } from '$lib/services/chunker';
import { createRectifier } from '$lib/services/rectifier';
import { rectifyDocument } from '$lib/services/rectificationEngine';
import { createTranslator } from '$lib/services/translator';
import { translateDocument } from '$lib/services/translationEngine';

describe('Workflow Engine', () => {
	const mockPdfBuffer = new Uint8Array([1, 2, 3, 4]);
	const mockMarkdown = '# Test Document\n\nSome content here.';
	const mockCleanedMarkdown = '# Test Document\n\nSome cleaned content here.';
	const mockTranslatedContent = '# テストドキュメント\n\n内容です。';

	const defaultCleanupSettings: CleanupSettings = {
		model: 'gpt-5-mini',
		chunkSize: 4000,
		reasoningEffort: 'medium'
	};

	const defaultTranslationSettings: TranslationSettings = {
		model: 'gpt-5-mini',
		chunkSize: 4000,
		reasoningEffort: 'medium',
		contextAware: true,
		targetLanguage: 'Japanese'
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup default mocks
		vi.mocked(createPdfConverter).mockResolvedValue({
			convertToMarkdown: vi.fn().mockResolvedValue(mockMarkdown)
		});

		vi.mocked(chunkBySize).mockReturnValue([
			{ index: 0, type: 'header-section', headerLevel: 1, content: mockMarkdown }
		]);

		vi.mocked(createRectifier).mockReturnValue({
			rectifyChunk: vi.fn().mockResolvedValue(mockCleanedMarkdown)
		});

		vi.mocked(rectifyDocument).mockResolvedValue({
			rectifiedChunks: [
				{
					index: 0,
					type: 'header-section',
					headerLevel: 1,
					content: mockMarkdown,
					originalContent: mockMarkdown,
					rectifiedContent: mockCleanedMarkdown
				}
			]
		});

		vi.mocked(createTranslator).mockReturnValue({
			translateChunk: vi.fn().mockResolvedValue(mockTranslatedContent)
		});

		vi.mocked(translateDocument).mockResolvedValue({
			translatedChunks: [
				{
					index: 0,
					type: 'header-section',
					headerLevel: 1,
					content: mockCleanedMarkdown,
					originalContent: mockCleanedMarkdown,
					translatedContent: mockTranslatedContent
				}
			]
		});
	});

	describe('runWorkflow', () => {
		it('executes all three phases in order', async () => {
			const onPhaseStart = vi.fn();
			const onPhaseComplete = vi.fn();

			const options: WorkflowOptions = {
				pdfBuffer: mockPdfBuffer,
				apiKey: 'test-key',
				cleanupSettings: defaultCleanupSettings,
				translationSettings: defaultTranslationSettings,
				callbacks: {
					onPhaseStart,
					onPhaseComplete
				}
			};

			await runWorkflow(options);

			// Verify phase start callbacks called in order
			expect(onPhaseStart).toHaveBeenCalledTimes(3);
			expect(onPhaseStart).toHaveBeenNthCalledWith(1, 'convert');
			expect(onPhaseStart).toHaveBeenNthCalledWith(2, 'cleanup');
			expect(onPhaseStart).toHaveBeenNthCalledWith(3, 'translate');

			// Verify phase complete callbacks called in order
			expect(onPhaseComplete).toHaveBeenCalledTimes(3);
			expect(onPhaseComplete).toHaveBeenNthCalledWith(1, 'convert', expect.any(String));
			expect(onPhaseComplete).toHaveBeenNthCalledWith(2, 'cleanup', expect.any(String));
			expect(onPhaseComplete).toHaveBeenNthCalledWith(3, 'translate', expect.any(Object));
		});

		it('returns all output documents', async () => {
			const options: WorkflowOptions = {
				pdfBuffer: mockPdfBuffer,
				apiKey: 'test-key',
				cleanupSettings: defaultCleanupSettings,
				translationSettings: defaultTranslationSettings,
				callbacks: {}
			};

			const result = await runWorkflow(options);

			expect(result.markdown).toBeDefined();
			expect(result.cleaned).toBeDefined();
			expect(result.japaneseOnly).toBeDefined();
			expect(result.bilingual).toBeDefined();
		});

		it('passes PDF buffer to converter', async () => {
			const mockConvertToMarkdown = vi.fn().mockResolvedValue(mockMarkdown);
			vi.mocked(createPdfConverter).mockResolvedValue({
				convertToMarkdown: mockConvertToMarkdown
			});

			const options: WorkflowOptions = {
				pdfBuffer: mockPdfBuffer,
				apiKey: 'test-key',
				cleanupSettings: defaultCleanupSettings,
				translationSettings: defaultTranslationSettings,
				callbacks: {}
			};

			await runWorkflow(options);

			expect(mockConvertToMarkdown).toHaveBeenCalledWith(mockPdfBuffer);
		});

		it('passes cleanup settings to rectifier', async () => {
			const customCleanupSettings: CleanupSettings = {
				model: 'gpt-4o',
				chunkSize: 2000,
				reasoningEffort: 'high'
			};

			const options: WorkflowOptions = {
				pdfBuffer: mockPdfBuffer,
				apiKey: 'test-key',
				cleanupSettings: customCleanupSettings,
				translationSettings: defaultTranslationSettings,
				callbacks: {}
			};

			await runWorkflow(options);

			expect(createRectifier).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: 'test-key',
					model: 'gpt-4o',
					reasoningEffort: 'high'
				})
			);

			expect(chunkBySize).toHaveBeenCalledWith(expect.any(String), 2000);
		});

		it('passes translation settings to translator', async () => {
			const customTranslationSettings: TranslationSettings = {
				model: 'gpt-5.1',
				chunkSize: 3000,
				reasoningEffort: 'low',
				contextAware: false,
				targetLanguage: 'German'
			};

			const options: WorkflowOptions = {
				pdfBuffer: mockPdfBuffer,
				apiKey: 'test-key',
				cleanupSettings: defaultCleanupSettings,
				translationSettings: customTranslationSettings,
				callbacks: {}
			};

			await runWorkflow(options);

			expect(createTranslator).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: 'test-key',
					model: 'gpt-5.1',
					contextAware: false,
					reasoningEffort: 'low'
				})
			);
		});

		it('calls onPhaseProgress during cleanup phase', async () => {
			const onPhaseProgress = vi.fn();

			// Setup rectifyDocument to call onProgress
			vi.mocked(rectifyDocument).mockImplementation(async (chunks, rectifyFn, options) => {
				if (options?.onProgress) {
					options.onProgress({
						current: 1,
						total: 2,
						percentComplete: 50,
						estimatedTimeRemaining: 1000
					});
				}
				return {
					rectifiedChunks: [
						{
							index: 0,
							type: 'header-section' as const,
							headerLevel: 1,
							content: mockMarkdown,
							originalContent: mockMarkdown,
							rectifiedContent: mockCleanedMarkdown
						}
					]
				};
			});

			const options: WorkflowOptions = {
				pdfBuffer: mockPdfBuffer,
				apiKey: 'test-key',
				cleanupSettings: defaultCleanupSettings,
				translationSettings: defaultTranslationSettings,
				callbacks: {
					onPhaseProgress
				}
			};

			await runWorkflow(options);

			expect(onPhaseProgress).toHaveBeenCalledWith('cleanup', expect.objectContaining({
				current: 1,
				total: 2,
				percentComplete: 50
			}));
		});

		it('calls onPhaseProgress during translate phase', async () => {
			const onPhaseProgress = vi.fn();

			// Setup translateDocument to call onProgress
			vi.mocked(translateDocument).mockImplementation(async (chunks, translateFn, options) => {
				if (options?.onProgress) {
					options.onProgress({
						current: 1,
						total: 3,
						percentComplete: 33,
						estimatedTimeRemaining: 2000
					});
				}
				return {
					translatedChunks: [
						{
							index: 0,
							type: 'header-section' as const,
							headerLevel: 1,
							content: mockCleanedMarkdown,
							originalContent: mockCleanedMarkdown,
							translatedContent: mockTranslatedContent
						}
					]
				};
			});

			const options: WorkflowOptions = {
				pdfBuffer: mockPdfBuffer,
				apiKey: 'test-key',
				cleanupSettings: defaultCleanupSettings,
				translationSettings: defaultTranslationSettings,
				callbacks: {
					onPhaseProgress
				}
			};

			await runWorkflow(options);

			expect(onPhaseProgress).toHaveBeenCalledWith('translate', expect.objectContaining({
				current: 1,
				total: 3,
				percentComplete: 33
			}));
		});

		it('calls onPhaseError when convert phase fails', async () => {
			const onPhaseError = vi.fn();
			const mockError = new Error('PDF conversion failed');

			vi.mocked(createPdfConverter).mockResolvedValue({
				convertToMarkdown: vi.fn().mockRejectedValue(mockError)
			});

			const options: WorkflowOptions = {
				pdfBuffer: mockPdfBuffer,
				apiKey: 'test-key',
				cleanupSettings: defaultCleanupSettings,
				translationSettings: defaultTranslationSettings,
				callbacks: {
					onPhaseError
				}
			};

			await expect(runWorkflow(options)).rejects.toThrow('PDF conversion failed');
			expect(onPhaseError).toHaveBeenCalledWith('convert', mockError);
		});

		it('calls onPhaseError when cleanup phase fails', async () => {
			const onPhaseError = vi.fn();
			const mockError = new Error('Rectification failed');

			vi.mocked(rectifyDocument).mockRejectedValue(mockError);

			const options: WorkflowOptions = {
				pdfBuffer: mockPdfBuffer,
				apiKey: 'test-key',
				cleanupSettings: defaultCleanupSettings,
				translationSettings: defaultTranslationSettings,
				callbacks: {
					onPhaseError
				}
			};

			await expect(runWorkflow(options)).rejects.toThrow('Rectification failed');
			expect(onPhaseError).toHaveBeenCalledWith('cleanup', mockError);
		});

		it('calls onPhaseError when translate phase fails', async () => {
			const onPhaseError = vi.fn();
			const mockError = new Error('Translation failed');

			vi.mocked(translateDocument).mockRejectedValue(mockError);

			const options: WorkflowOptions = {
				pdfBuffer: mockPdfBuffer,
				apiKey: 'test-key',
				cleanupSettings: defaultCleanupSettings,
				translationSettings: defaultTranslationSettings,
				callbacks: {
					onPhaseError
				}
			};

			await expect(runWorkflow(options)).rejects.toThrow('Translation failed');
			expect(onPhaseError).toHaveBeenCalledWith('translate', mockError);
		});

		it('assembles bilingual output with separators', async () => {
			vi.mocked(translateDocument).mockResolvedValue({
				translatedChunks: [
					{
						index: 0,
						type: 'header-section',
						headerLevel: 1,
						content: 'English 1',
						originalContent: 'English 1',
						translatedContent: 'Japanese 1'
					},
					{
						index: 1,
						type: 'paragraph-section',
						headerLevel: null,
						content: 'English 2',
						originalContent: 'English 2',
						translatedContent: 'Japanese 2'
					}
				]
			});

			const options: WorkflowOptions = {
				pdfBuffer: mockPdfBuffer,
				apiKey: 'test-key',
				cleanupSettings: defaultCleanupSettings,
				translationSettings: defaultTranslationSettings,
				callbacks: {}
			};

			const result = await runWorkflow(options);

			expect(result.bilingual).toContain('English 1');
			expect(result.bilingual).toContain('Japanese 1');
			expect(result.bilingual).toContain('---');
			expect(result.bilingual).toContain('English 2');
			expect(result.bilingual).toContain('Japanese 2');
		});

		it('works without any callbacks provided', async () => {
			const options: WorkflowOptions = {
				pdfBuffer: mockPdfBuffer,
				apiKey: 'test-key',
				cleanupSettings: defaultCleanupSettings,
				translationSettings: defaultTranslationSettings,
				callbacks: {}
			};

			const result = await runWorkflow(options);

			expect(result.markdown).toBe(mockMarkdown);
			expect(result.cleaned).toBe(mockCleanedMarkdown);
		});
	});
});
