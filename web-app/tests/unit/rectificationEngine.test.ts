import { describe, it, expect, vi } from 'vitest';
import { rectifyDocument, type RectificationProgress } from '$lib/services/rectificationEngine';
import type { Chunk } from '$lib/services/chunker';

// Helper to create mock rectification result
const mockResult = (content: string, usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 }) => ({
	content,
	usage
});

describe('rectificationEngine', () => {
	describe('rectifyDocument', () => {
		it('should return empty array for empty chunks', async () => {
			const rectifyChunkFn = vi.fn();
			const result = await rectifyDocument([], rectifyChunkFn);

			expect(result.rectifiedChunks).toEqual([]);
			expect(result.totalUsage.totalTokens).toBe(0);
			expect(rectifyChunkFn).not.toHaveBeenCalled();
		});

		it('should rectify a single chunk', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'ontents' }
			];
			const rectifyChunkFn = vi.fn().mockResolvedValue(mockResult('Contents'));

			const result = await rectifyDocument(chunks, rectifyChunkFn);

			expect(result.rectifiedChunks.length).toBe(1);
			expect(result.rectifiedChunks[0].originalContent).toBe('ontents');
			expect(result.rectifiedChunks[0].rectifiedContent).toBe('Contents');
		});

		it('should rectify multiple chunks sequentially', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'ontents' },
				{ index: 1, type: 'header-section', headerLevel: 1, content: 'Ww hile' },
				{ index: 2, type: 'header-section', headerLevel: 1, content: 'Joreface' }
			];
			const rectifyChunkFn = vi
				.fn()
				.mockResolvedValueOnce(mockResult('Contents'))
				.mockResolvedValueOnce(mockResult('While'))
				.mockResolvedValueOnce(mockResult('Preface'));

			const result = await rectifyDocument(chunks, rectifyChunkFn);

			expect(result.rectifiedChunks.length).toBe(3);
			expect(rectifyChunkFn).toHaveBeenCalledTimes(3);
		});

		it('should preserve original chunk metadata', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 2, content: 'ontents' }
			];
			const rectifyChunkFn = vi.fn().mockResolvedValue(mockResult('Contents'));

			const result = await rectifyDocument(chunks, rectifyChunkFn);

			expect(result.rectifiedChunks[0].index).toBe(0);
			expect(result.rectifiedChunks[0].type).toBe('header-section');
			expect(result.rectifiedChunks[0].headerLevel).toBe(2);
		});

		it('should call onProgress callback after each chunk', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'A' },
				{ index: 1, type: 'header-section', headerLevel: 1, content: 'B' }
			];
			const rectifyChunkFn = vi.fn().mockResolvedValue(mockResult('Fixed'));
			const onProgress = vi.fn();

			await rectifyDocument(chunks, rectifyChunkFn, { onProgress });

			expect(onProgress).toHaveBeenCalledTimes(2);
		});

		it('should report correct progress percentages', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'A' },
				{ index: 1, type: 'header-section', headerLevel: 1, content: 'B' },
				{ index: 2, type: 'header-section', headerLevel: 1, content: 'C' },
				{ index: 3, type: 'header-section', headerLevel: 1, content: 'D' }
			];
			const rectifyChunkFn = vi.fn().mockResolvedValue(mockResult('Fixed'));
			const progressUpdates: RectificationProgress[] = [];
			const onProgress = (progress: RectificationProgress) => {
				progressUpdates.push({ ...progress });
			};

			await rectifyDocument(chunks, rectifyChunkFn, { onProgress });

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
			const rectifyChunkFn = vi.fn().mockResolvedValue(mockResult('Fixed'));
			const progressUpdates: RectificationProgress[] = [];
			const onProgress = (progress: RectificationProgress) => {
				progressUpdates.push({ ...progress });
			};

			await rectifyDocument(chunks, rectifyChunkFn, { onProgress });

			progressUpdates.forEach((progress) => {
				expect(progress.estimatedTimeRemaining).toBeDefined();
				expect(typeof progress.estimatedTimeRemaining).toBe('number');
			});
		});

		it('should accumulate token usage across chunks', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'A' },
				{ index: 1, type: 'header-section', headerLevel: 1, content: 'B' }
			];
			const rectifyChunkFn = vi
				.fn()
				.mockResolvedValueOnce(mockResult('Fixed A', { promptTokens: 100, completionTokens: 50, totalTokens: 150 }))
				.mockResolvedValueOnce(mockResult('Fixed B', { promptTokens: 80, completionTokens: 40, totalTokens: 120 }));

			const result = await rectifyDocument(chunks, rectifyChunkFn);

			expect(result.totalUsage.promptTokens).toBe(180);
			expect(result.totalUsage.completionTokens).toBe(90);
			expect(result.totalUsage.totalTokens).toBe(270);
		});

		it('should include token usage in progress updates', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'A' },
				{ index: 1, type: 'header-section', headerLevel: 1, content: 'B' }
			];
			const rectifyChunkFn = vi
				.fn()
				.mockResolvedValueOnce(mockResult('Fixed A', { promptTokens: 100, completionTokens: 50, totalTokens: 150 }))
				.mockResolvedValueOnce(mockResult('Fixed B', { promptTokens: 80, completionTokens: 40, totalTokens: 120 }));
			const progressUpdates: RectificationProgress[] = [];
			const onProgress = (progress: RectificationProgress) => {
				progressUpdates.push({ ...progress });
			};

			await rectifyDocument(chunks, rectifyChunkFn, { onProgress });

			expect(progressUpdates[0].tokensUsed.totalTokens).toBe(150);
			expect(progressUpdates[1].tokensUsed.totalTokens).toBe(270);
		});

		it('should handle rectification errors gracefully', async () => {
			const chunks: Chunk[] = [
				{ index: 0, type: 'header-section', headerLevel: 1, content: 'Test' }
			];
			const rectifyChunkFn = vi.fn().mockRejectedValue(new Error('Rectification failed'));

			await expect(rectifyDocument(chunks, rectifyChunkFn)).rejects.toThrow('Rectification failed');
		});
	});
});
