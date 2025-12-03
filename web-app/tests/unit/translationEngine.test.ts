import { describe, it, expect, vi } from 'vitest';
import { translateDocument, type TranslationProgress } from '$lib/services/translationEngine';
import type { Chunk } from '$lib/services/chunker';

describe('translationEngine', () => {
	describe('translateDocument', () => {
		it('should return empty array for empty chunks', async () => {
			const translateChunkFn = vi.fn();
			const result = await translateDocument([], translateChunkFn);

			expect(result.translatedChunks).toEqual([]);
			expect(translateChunkFn).not.toHaveBeenCalled();
		});

		it('should translate a single chunk', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'Hello' }
			];
			const translateChunkFn = vi.fn().mockResolvedValue('こんにちは');

			const result = await translateDocument(chunks, translateChunkFn);

			expect(result.translatedChunks.length).toBe(1);
			expect(result.translatedChunks[0].originalContent).toBe('Hello');
			expect(result.translatedChunks[0].translatedContent).toBe('こんにちは');
		});

		it('should translate multiple chunks sequentially', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'First' },
				{ index: 1, type: 'header-section', headerLevel: 1, content: 'Second' },
				{ index: 2, type: 'header-section', headerLevel: 1, content: 'Third' }
			];
			const translateChunkFn = vi
				.fn()
				.mockResolvedValueOnce('最初')
				.mockResolvedValueOnce('二番目')
				.mockResolvedValueOnce('三番目');

			const result = await translateDocument(chunks, translateChunkFn);

			expect(result.translatedChunks.length).toBe(3);
			expect(translateChunkFn).toHaveBeenCalledTimes(3);
		});

		it('should preserve original chunk metadata', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 2, content: 'Test' }
			];
			const translateChunkFn = vi.fn().mockResolvedValue('テスト');

			const result = await translateDocument(chunks, translateChunkFn);

			expect(result.translatedChunks[0].index).toBe(0);
			expect(result.translatedChunks[0].type).toBe('header-section');
			expect(result.translatedChunks[0].headerLevel).toBe(2);
		});

		it('should pass context to translateChunkFn', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'First chunk' },
				{ index: 1, type: 'header-section', headerLevel: 1, content: 'Second chunk' }
			];
			const translateChunkFn = vi
				.fn()
				.mockResolvedValueOnce('最初のチャンク')
				.mockResolvedValueOnce('二番目のチャンク');

			await translateDocument(chunks, translateChunkFn);

			// First call - no previous context
			expect(translateChunkFn).toHaveBeenNthCalledWith(1, 'First chunk', {
				previousEnglish: null,
				nextEnglish: 'Second chunk',
				previousTranslation: null,
				isFirstChunk: true,
				isLastChunk: false
			});

			// Second call - has previous context
			expect(translateChunkFn).toHaveBeenNthCalledWith(2, 'Second chunk', {
				previousEnglish: 'First chunk',
				nextEnglish: null,
				previousTranslation: '最初のチャンク',
				isFirstChunk: false,
				isLastChunk: true
			});
		});

		it('should chain translations as context for subsequent chunks', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'A' },
				{ index: 1, type: 'header-section', headerLevel: 1, content: 'B' },
				{ index: 2, type: 'header-section', headerLevel: 1, content: 'C' }
			];
			const translateChunkFn = vi
				.fn()
				.mockResolvedValueOnce('あ')
				.mockResolvedValueOnce('い')
				.mockResolvedValueOnce('う');

			await translateDocument(chunks, translateChunkFn);

			// Third call should have second chunk's translation as previousTranslation
			expect(translateChunkFn).toHaveBeenNthCalledWith(3, 'C', expect.objectContaining({
				previousTranslation: 'い'
			}));
		});

		it('should call onProgress callback after each chunk', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'A' },
				{ index: 1, type: 'header-section', headerLevel: 1, content: 'B' }
			];
			const translateChunkFn = vi.fn().mockResolvedValue('翻訳');
			const onProgress = vi.fn();

			await translateDocument(chunks, translateChunkFn, { onProgress });

			expect(onProgress).toHaveBeenCalledTimes(2);
		});

		it('should report correct progress percentages', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'A' },
				{ index: 1, type: 'header-section', headerLevel: 1, content: 'B' },
				{ index: 2, type: 'header-section', headerLevel: 1, content: 'C' },
				{ index: 3, type: 'header-section', headerLevel: 1, content: 'D' }
			];
			const translateChunkFn = vi.fn().mockResolvedValue('翻訳');
			const progressUpdates: TranslationProgress[] = [];
			const onProgress = (progress: TranslationProgress) => {
				progressUpdates.push({ ...progress });
			};

			await translateDocument(chunks, translateChunkFn, { onProgress });

			expect(progressUpdates[0].current).toBe(1);
			expect(progressUpdates[0].total).toBe(4);
			expect(progressUpdates[0].percentComplete).toBe(25);

			expect(progressUpdates[1].percentComplete).toBe(50);
			expect(progressUpdates[2].percentComplete).toBe(75);
			expect(progressUpdates[3].percentComplete).toBe(100);
		});

		it('should include estimated time remaining in progress', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'A' },
				{ index: 1, type: 'header-section', headerLevel: 1, content: 'B' }
			];
			const translateChunkFn = vi.fn().mockResolvedValue('翻訳');
			const progressUpdates: TranslationProgress[] = [];
			const onProgress = (progress: TranslationProgress) => {
				progressUpdates.push({ ...progress });
			};

			await translateDocument(chunks, translateChunkFn, { onProgress });

			// All progress updates should have estimatedTimeRemaining
			progressUpdates.forEach((progress) => {
				expect(progress.estimatedTimeRemaining).toBeDefined();
				expect(typeof progress.estimatedTimeRemaining).toBe('number');
			});
		});

		it('should handle translation errors gracefully', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'Test' }
			];
			const translateChunkFn = vi.fn().mockRejectedValue(new Error('Translation failed'));

			await expect(translateDocument(chunks, translateChunkFn)).rejects.toThrow(
				'Translation failed'
			);
		});
	});
});
