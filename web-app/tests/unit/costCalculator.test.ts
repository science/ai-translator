import { describe, it, expect } from 'vitest';
import {
	estimateTokenCount,
	estimateChatTokens,
	calculateCost,
	estimateJobCost,
	type TokenUsage,
	type CostEstimate
} from '$lib/services/costCalculator';

describe('costCalculator', () => {
	describe('estimateTokenCount', () => {
		it('returns 0 for empty string', () => {
			expect(estimateTokenCount('')).toBe(0);
		});

		it('counts tokens for simple text', () => {
			const text = 'Hello, world!';
			const tokens = estimateTokenCount(text);
			// gpt-tokenizer should return actual token count
			expect(tokens).toBeGreaterThan(0);
			expect(typeof tokens).toBe('number');
		});

		it('counts tokens for longer text', () => {
			const text = 'This is a longer piece of text that should have more tokens than a short one.';
			const tokens = estimateTokenCount(text);
			expect(tokens).toBeGreaterThan(10);
		});

		it('handles markdown content', () => {
			const markdown = '# Header\n\nThis is **bold** and *italic* text.\n\n- List item 1\n- List item 2';
			const tokens = estimateTokenCount(markdown);
			expect(tokens).toBeGreaterThan(0);
		});
	});

	describe('estimateChatTokens', () => {
		it('counts tokens for a simple chat message array', () => {
			const messages = [
				{ role: 'system', content: 'You are a helpful assistant.' },
				{ role: 'user', content: 'Hello!' }
			];
			const tokens = estimateChatTokens(messages);
			expect(tokens).toBeGreaterThan(0);
		});

		it('includes overhead for message structure', () => {
			const content = 'Hello!';
			const plainTokens = estimateTokenCount(content);
			const chatTokens = estimateChatTokens([{ role: 'user', content }]);
			// Chat tokens should be higher due to message structure overhead
			expect(chatTokens).toBeGreaterThan(plainTokens);
		});

		it('handles empty messages array', () => {
			const tokens = estimateChatTokens([]);
			expect(tokens).toBe(0);
		});
	});

	describe('calculateCost', () => {
		it('calculates cost for token usage with gpt-5-mini', () => {
			const usage: TokenUsage = {
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500
			};
			const cost = calculateCost(usage, 'gpt-5-mini');
			expect(cost).toBeGreaterThan(0);
			expect(typeof cost).toBe('number');
		});

		it('calculates cost for gpt-5.2', () => {
			const usage: TokenUsage = {
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500
			};
			const cost = calculateCost(usage, 'gpt-5.2');
			expect(cost).toBeGreaterThan(0);
		});

		it('calculates cost for gpt-4.1', () => {
			const usage: TokenUsage = {
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500
			};
			const cost = calculateCost(usage, 'gpt-4.1');
			expect(cost).toBeGreaterThan(0);
		});

		it('returns 0 for zero tokens', () => {
			const usage: TokenUsage = {
				promptTokens: 0,
				completionTokens: 0,
				totalTokens: 0
			};
			const cost = calculateCost(usage, 'gpt-5-mini');
			expect(cost).toBe(0);
		});

		it('handles unknown model by using default pricing', () => {
			const usage: TokenUsage = {
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500
			};
			const cost = calculateCost(usage, 'unknown-model');
			expect(cost).toBeGreaterThan(0);
		});
	});

	describe('estimateJobCost', () => {
		const sampleChunks = [
			'This is the first chunk of text to be processed.',
			'This is the second chunk with some more content.',
			'And here is a third chunk for good measure.'
		];

		it('estimates cost for translation job', () => {
			const estimate = estimateJobCost(sampleChunks, 'gpt-5-mini', 'translate');
			expect(estimate.estimatedInputTokens).toBeGreaterThan(0);
			expect(estimate.estimatedOutputTokens).toBeGreaterThan(0);
			expect(estimate.estimatedCostUsd).toBeGreaterThan(0);
		});

		it('estimates cost for cleanup job', () => {
			const estimate = estimateJobCost(sampleChunks, 'gpt-5-mini', 'cleanup');
			expect(estimate.estimatedInputTokens).toBeGreaterThan(0);
			expect(estimate.estimatedOutputTokens).toBeGreaterThan(0);
			expect(estimate.estimatedCostUsd).toBeGreaterThan(0);
		});

		it('translation has higher output estimate than cleanup', () => {
			const translateEstimate = estimateJobCost(sampleChunks, 'gpt-5-mini', 'translate');
			const cleanupEstimate = estimateJobCost(sampleChunks, 'gpt-5-mini', 'cleanup');
			// Translation to Japanese typically produces more tokens
			expect(translateEstimate.estimatedOutputTokens).toBeGreaterThan(
				cleanupEstimate.estimatedOutputTokens
			);
		});

		it('returns zero estimates for empty chunks', () => {
			const estimate = estimateJobCost([], 'gpt-5-mini', 'translate');
			expect(estimate.estimatedInputTokens).toBe(0);
			expect(estimate.estimatedOutputTokens).toBe(0);
			expect(estimate.estimatedCostUsd).toBe(0);
		});

		it('includes system prompt overhead in input tokens', () => {
			const singleChunk = ['Short text'];
			const estimate = estimateJobCost(singleChunk, 'gpt-5-mini', 'translate');
			const plainTokens = estimateTokenCount('Short text');
			// Input tokens should be higher than just the chunk due to system prompt
			expect(estimate.estimatedInputTokens).toBeGreaterThan(plainTokens);
		});
	});

	describe('TokenUsage type', () => {
		it('has required properties', () => {
			const usage: TokenUsage = {
				promptTokens: 100,
				completionTokens: 50,
				totalTokens: 150
			};
			expect(usage.promptTokens).toBe(100);
			expect(usage.completionTokens).toBe(50);
			expect(usage.totalTokens).toBe(150);
		});
	});

	describe('CostEstimate type', () => {
		it('has required properties', () => {
			const estimate: CostEstimate = {
				estimatedInputTokens: 1000,
				estimatedOutputTokens: 1500,
				estimatedCostUsd: 0.05
			};
			expect(estimate.estimatedInputTokens).toBe(1000);
			expect(estimate.estimatedOutputTokens).toBe(1500);
			expect(estimate.estimatedCostUsd).toBe(0.05);
		});
	});
});
