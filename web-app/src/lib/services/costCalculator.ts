/**
 * Cost estimation service for the book-translate web app.
 * Uses gpt-tokenizer for accurate token counting and cost estimation.
 */

import { encode, encodeChat } from 'gpt-tokenizer';
import { chunkBySize } from './chunker';

// Chat message overhead tokens (role tags, separators, etc.)
// This is an approximation based on OpenAI's token counting documentation
const CHAT_MESSAGE_OVERHEAD = 4; // ~4 tokens per message for structure

/**
 * Token usage from an API response.
 */
export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

/**
 * Pre-job cost estimate.
 */
export interface CostEstimate {
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	estimatedCostUsd: number;
}

/**
 * Combined cost estimate for a full workflow (cleanup + translation).
 */
export interface WorkflowCostEstimate {
	cleanup: CostEstimate;
	translate: CostEstimate;
	totalTokens: number;
	totalCostUsd: number;
}

/**
 * Pricing per 1M tokens for each model.
 * These are approximate and should be updated when OpenAI changes pricing.
 * Using gpt-tokenizer's built-in pricing as reference.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
	'gpt-5.2': { input: 2.5, output: 10.0 },
	'gpt-5-mini': { input: 0.15, output: 0.6 },
	'gpt-4.1': { input: 2.0, output: 8.0 },
	'gpt-4.1-mini': { input: 0.1, output: 0.4 }
};

// Default pricing for unknown models (use gpt-5-mini pricing as safe default)
const DEFAULT_PRICING = { input: 0.15, output: 0.6 };

/**
 * Approximate system prompt token counts (pre-calculated to avoid repeated encoding).
 * These are estimates for the translation and rectification prompts.
 */
const SYSTEM_PROMPT_TOKENS = {
	translate: 450, // Translation system prompt is ~450 tokens
	cleanup: 350 // Rectification system prompt is ~350 tokens
};

/**
 * Output token multiplier for different modes.
 * Translation to Japanese typically produces ~1.5x more tokens.
 * Cleanup (English to English) produces roughly the same.
 */
const OUTPUT_MULTIPLIER = {
	translate: 1.5,
	cleanup: 1.0
};

/**
 * Count tokens in a text string.
 */
export function estimateTokenCount(text: string): number {
	if (!text) return 0;
	return encode(text).length;
}

/**
 * Count tokens for a chat message array (includes message structure overhead).
 * Uses manual calculation since encodeChat requires a specific model name.
 */
export function estimateChatTokens(
	messages: Array<{ role: string; content: string }>
): number {
	if (!messages || messages.length === 0) return 0;

	let totalTokens = 0;
	for (const message of messages) {
		// Count content tokens
		totalTokens += encode(message.content).length;
		// Add overhead for role and message structure
		totalTokens += CHAT_MESSAGE_OVERHEAD;
	}
	return totalTokens;
}

/**
 * Calculate actual cost from token usage.
 */
export function calculateCost(usage: TokenUsage, model: string): number {
	if (usage.promptTokens === 0 && usage.completionTokens === 0) {
		return 0;
	}

	const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;

	// Pricing is per 1M tokens
	const inputCost = (usage.promptTokens / 1_000_000) * pricing.input;
	const outputCost = (usage.completionTokens / 1_000_000) * pricing.output;

	return inputCost + outputCost;
}

/**
 * Estimate total job cost before execution.
 */
export function estimateJobCost(
	chunks: string[],
	model: string,
	mode: 'cleanup' | 'translate'
): CostEstimate {
	if (!chunks || chunks.length === 0) {
		return {
			estimatedInputTokens: 0,
			estimatedOutputTokens: 0,
			estimatedCostUsd: 0
		};
	}

	// Count tokens in all chunks
	let totalChunkTokens = 0;
	for (const chunk of chunks) {
		totalChunkTokens += estimateTokenCount(chunk);
	}

	// Add system prompt overhead for each chunk
	const systemPromptOverhead = SYSTEM_PROMPT_TOKENS[mode] * chunks.length;
	const estimatedInputTokens = totalChunkTokens + systemPromptOverhead;

	// Estimate output tokens based on mode
	const estimatedOutputTokens = Math.round(totalChunkTokens * OUTPUT_MULTIPLIER[mode]);

	// Calculate estimated cost
	const estimatedCostUsd = calculateCost(
		{
			promptTokens: estimatedInputTokens,
			completionTokens: estimatedOutputTokens,
			totalTokens: estimatedInputTokens + estimatedOutputTokens
		},
		model
	);

	return {
		estimatedInputTokens,
		estimatedOutputTokens,
		estimatedCostUsd
	};
}

/**
 * Format cost as USD string.
 */
export function formatCost(costUsd: number): string {
	if (costUsd < 0.01) {
		return '< $0.01';
	}
	return `$${costUsd.toFixed(2)}`;
}

/**
 * Format token count with thousands separator.
 */
export function formatTokens(tokens: number): string {
	return tokens.toLocaleString();
}

/**
 * Estimate total workflow cost (cleanup + translation phases).
 * Used for One Step Translation cost estimation.
 */
export function estimateWorkflowCost(
	content: string,
	cleanupModel: string,
	translateModel: string,
	chunkSize: number
): WorkflowCostEstimate {
	if (!content) {
		return {
			cleanup: { estimatedInputTokens: 0, estimatedOutputTokens: 0, estimatedCostUsd: 0 },
			translate: { estimatedInputTokens: 0, estimatedOutputTokens: 0, estimatedCostUsd: 0 },
			totalTokens: 0,
			totalCostUsd: 0
		};
	}

	// Chunk the content
	const chunks = chunkBySize(content, chunkSize);
	const chunkContents = chunks.map(c => c.content);

	// Estimate cleanup cost
	const cleanupEstimate = estimateJobCost(chunkContents, cleanupModel, 'cleanup');

	// Estimate translation cost
	const translateEstimate = estimateJobCost(chunkContents, translateModel, 'translate');

	// Calculate totals
	const totalTokens =
		cleanupEstimate.estimatedInputTokens + cleanupEstimate.estimatedOutputTokens +
		translateEstimate.estimatedInputTokens + translateEstimate.estimatedOutputTokens;
	const totalCostUsd = cleanupEstimate.estimatedCostUsd + translateEstimate.estimatedCostUsd;

	return {
		cleanup: cleanupEstimate,
		translate: translateEstimate,
		totalTokens,
		totalCostUsd
	};
}
