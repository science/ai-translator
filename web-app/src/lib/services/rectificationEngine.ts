// Browser-compatible rectification engine
// Ported from CLI's src/rectificationEngine.js

import type { Chunk } from './chunker';
import type { RectificationResult as ChunkRectificationResult } from './rectifier';
import type { TokenUsage } from './costCalculator';

export interface RectifiedChunk extends Chunk {
	originalContent: string;
	rectifiedContent: string;
}

export interface RectificationProgress {
	current: number;
	total: number;
	percentComplete: number;
	estimatedTimeRemaining: number;
	tokensUsed: TokenUsage;
}

export interface RectificationEngineOptions {
	onProgress?: (progress: RectificationProgress) => void;
}

export type RectifyChunkFn = (chunk: string) => Promise<ChunkRectificationResult>;

export interface RectificationResult {
	rectifiedChunks: RectifiedChunk[];
	totalUsage: TokenUsage;
}

/**
 * Rectifies a document by processing chunks sequentially
 */
export async function rectifyDocument(
	chunks: Chunk[],
	rectifyChunkFn: RectifyChunkFn,
	options: RectificationEngineOptions = {}
): Promise<RectificationResult> {
	const { onProgress } = options;
	const rectifiedChunks: RectifiedChunk[] = [];
	const startTime = Date.now();

	// Track total token usage across all chunks
	const totalUsage: TokenUsage = {
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0
	};

	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];

		const result = await rectifyChunkFn(chunk.content);

		// Extract content and accumulate usage
		const rectifiedContent = result.content;
		totalUsage.promptTokens += result.usage.promptTokens;
		totalUsage.completionTokens += result.usage.completionTokens;
		totalUsage.totalTokens += result.usage.totalTokens;

		rectifiedChunks.push({
			...chunk,
			originalContent: chunk.content,
			rectifiedContent
		});

		if (onProgress) {
			const current = i + 1;
			const total = chunks.length;
			const percentComplete = Math.round((current / total) * 100);

			const elapsed = Date.now() - startTime;
			const averageTimePerChunk = elapsed / current;
			const remainingChunks = total - current;
			const estimatedTimeRemaining =
				remainingChunks > 0 ? Math.round(averageTimePerChunk * remainingChunks) : 0;

			onProgress({
				current,
				total,
				percentComplete,
				estimatedTimeRemaining,
				tokensUsed: { ...totalUsage }
			});
		}
	}

	return { rectifiedChunks, totalUsage };
}
