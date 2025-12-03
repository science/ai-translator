// Browser-compatible rectification engine
// Ported from CLI's src/rectificationEngine.js

import type { Chunk } from './chunker';

export interface RectifiedChunk extends Chunk {
	originalContent: string;
	rectifiedContent: string;
}

export interface RectificationProgress {
	current: number;
	total: number;
	percentComplete: number;
	estimatedTimeRemaining: number;
}

export interface RectificationEngineOptions {
	onProgress?: (progress: RectificationProgress) => void;
}

export type RectifyChunkFn = (chunk: string) => Promise<string>;

export interface RectificationResult {
	rectifiedChunks: RectifiedChunk[];
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

	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];

		const rectifiedContent = await rectifyChunkFn(chunk.content);

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
				estimatedTimeRemaining
			});
		}
	}

	return { rectifiedChunks };
}
