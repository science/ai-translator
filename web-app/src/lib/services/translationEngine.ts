// Browser-compatible translation engine
// Ported from CLI's src/translationEngine.js

import type { Chunk } from './chunker';
import type { TranslationContext, TranslationResult as ChunkTranslationResult } from './translator';
import type { TokenUsage } from './costCalculator';

export interface TranslatedChunk extends Chunk {
	originalContent: string;
	translatedContent: string;
}

export interface TranslationProgress {
	current: number;
	total: number;
	percentComplete: number;
	estimatedTimeRemaining: number;
	tokensUsed: TokenUsage;
}

export interface TranslationEngineOptions {
	onProgress?: (progress: TranslationProgress) => void;
}

export type TranslateChunkFn = (chunk: string, context: TranslationContext) => Promise<ChunkTranslationResult>;

export interface TranslationResult {
	translatedChunks: TranslatedChunk[];
	totalUsage: TokenUsage;
}

/**
 * Shortens chunk content for inclusion in an error message.
 */
function previewChunk(content: string, maxLength = 80): string {
	const flattened = content.replace(/\s+/g, ' ').trim();
	return flattened.length <= maxLength ? flattened : `${flattened.slice(0, maxLength)}…`;
}

/**
 * Translates a document by processing chunks sequentially with context chaining
 */
export async function translateDocument(
	chunks: Chunk[],
	translateChunkFn: TranslateChunkFn,
	options: TranslationEngineOptions = {}
): Promise<TranslationResult> {
	const { onProgress } = options;
	const translatedChunks: TranslatedChunk[] = [];
	const startTime = Date.now();
	let previousTranslation: string | null = null;

	// Track total token usage across all chunks
	const totalUsage: TokenUsage = {
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0
	};

	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];

		// Build context for context-aware translation
		const context: TranslationContext & { isFirstChunk: boolean; isLastChunk: boolean } = {
			previousEnglish: i > 0 ? chunks[i - 1].content : null,
			nextEnglish: i < chunks.length - 1 ? chunks[i + 1].content : null,
			previousTranslation: previousTranslation,
			isFirstChunk: i === 0,
			isLastChunk: i === chunks.length - 1
		};

		let result: ChunkTranslationResult;
		try {
			result = await translateChunkFn(chunk.content, context);
		} catch (error) {
			// Without the chunk's identity a mid-document failure is undiagnosable.
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(
				`Chunk ${i + 1} of ${chunks.length} failed: ${message} ` +
					`(starts with: "${previewChunk(chunk.content)}")`,
				{ cause: error }
			);
		}

		// Extract content and accumulate usage
		const translatedContent = result.content;
		totalUsage.promptTokens += result.usage.promptTokens;
		totalUsage.completionTokens += result.usage.completionTokens;
		totalUsage.totalTokens += result.usage.totalTokens;

		// Store translation for next chunk's context
		previousTranslation = translatedContent;

		translatedChunks.push({
			...chunk,
			originalContent: chunk.content,
			translatedContent
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

	return { translatedChunks, totalUsage };
}
