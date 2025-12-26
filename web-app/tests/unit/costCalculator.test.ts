import { describe, it, expect } from 'vitest';
import {
	estimateTokenCount,
	estimateChatTokens,
	calculateCost,
	estimateJobCost,
	estimateWorkflowCost,
	getReasoningMultiplier,
	DEFAULT_REASONING_MULTIPLIERS,
	type TokenUsage,
	type CostEstimate,
	type WorkflowCostEstimate,
	type ReasoningMultipliers
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

	describe('estimateWorkflowCost', () => {
		const sampleContent = '# Test Document\n\nThis is sample content for testing workflow cost estimation. It has enough text to generate meaningful token counts.';

		// Diagnostic test: Compare with estimateJobCost to ensure consistency
		it('produces same cleanup estimate as estimateJobCost with same content', async () => {
			// Import chunker to mimic what cleanup page does
			const { chunkBySize } = await import('$lib/services/chunker');

			const model = 'gpt-5-mini';
			const chunkSize = 4000;

			// Method 1: How cleanup page does it
			const chunks = chunkBySize(sampleContent, chunkSize);
			const chunkContents = chunks.map(c => c.content);
			const cleanupPageEstimate = estimateJobCost(chunkContents, model, 'cleanup');

			// Method 2: How workflow page does it via estimateWorkflowCost
			const workflowEstimate = estimateWorkflowCost(sampleContent, model, model, chunkSize);

			// Both should produce the same cleanup cost
			expect(workflowEstimate.cleanup.estimatedCostUsd).toBe(cleanupPageEstimate.estimatedCostUsd);
			expect(workflowEstimate.cleanup.estimatedInputTokens).toBe(cleanupPageEstimate.estimatedInputTokens);
			expect(workflowEstimate.cleanup.estimatedOutputTokens).toBe(cleanupPageEstimate.estimatedOutputTokens);
		});

		it('produces same translate estimate as estimateJobCost with same content', async () => {
			const { chunkBySize } = await import('$lib/services/chunker');

			const model = 'gpt-5-mini';
			const chunkSize = 4000;

			// Method 1: How translate page does it
			const chunks = chunkBySize(sampleContent, chunkSize);
			const chunkContents = chunks.map(c => c.content);
			const translatePageEstimate = estimateJobCost(chunkContents, model, 'translate');

			// Method 2: How workflow page does it via estimateWorkflowCost
			const workflowEstimate = estimateWorkflowCost(sampleContent, model, model, chunkSize);

			// Both should produce the same translation cost
			expect(workflowEstimate.translate.estimatedCostUsd).toBe(translatePageEstimate.estimatedCostUsd);
			expect(workflowEstimate.translate.estimatedInputTokens).toBe(translatePageEstimate.estimatedInputTokens);
			expect(workflowEstimate.translate.estimatedOutputTokens).toBe(translatePageEstimate.estimatedOutputTokens);
		});

		it('returns combined estimate for cleanup and translation phases', () => {
			const estimate = estimateWorkflowCost(sampleContent, 'gpt-5-mini', 'gpt-5-mini', 4000);
			expect(estimate.cleanup.estimatedCostUsd).toBeGreaterThan(0);
			expect(estimate.translate.estimatedCostUsd).toBeGreaterThan(0);
			expect(estimate.totalCostUsd).toBeGreaterThan(0);
		});

		it('total cost equals sum of cleanup and translation costs', () => {
			const estimate = estimateWorkflowCost(sampleContent, 'gpt-5-mini', 'gpt-5-mini', 4000);
			const expectedTotal = estimate.cleanup.estimatedCostUsd + estimate.translate.estimatedCostUsd;
			expect(estimate.totalCostUsd).toBeCloseTo(expectedTotal, 5);
		});

		it('returns zero estimates for empty content', () => {
			const estimate = estimateWorkflowCost('', 'gpt-5-mini', 'gpt-5-mini', 4000);
			expect(estimate.cleanup.estimatedCostUsd).toBe(0);
			expect(estimate.translate.estimatedCostUsd).toBe(0);
			expect(estimate.totalCostUsd).toBe(0);
		});

		it('uses different models for each phase', () => {
			// gpt-5.2 is more expensive than gpt-5-mini
			const expensiveCleanup = estimateWorkflowCost(sampleContent, 'gpt-5.2', 'gpt-5-mini', 4000);
			const cheapCleanup = estimateWorkflowCost(sampleContent, 'gpt-5-mini', 'gpt-5-mini', 4000);
			expect(expensiveCleanup.cleanup.estimatedCostUsd).toBeGreaterThan(cheapCleanup.cleanup.estimatedCostUsd);
		});

		it('includes total token count', () => {
			const estimate = estimateWorkflowCost(sampleContent, 'gpt-5-mini', 'gpt-5-mini', 4000);
			const expectedTokens =
				estimate.cleanup.estimatedInputTokens + estimate.cleanup.estimatedOutputTokens +
				estimate.translate.estimatedInputTokens + estimate.translate.estimatedOutputTokens;
			expect(estimate.totalTokens).toBe(expectedTokens);
		});

		it('respects chunk size parameter', () => {
			const smallChunks = estimateWorkflowCost(sampleContent, 'gpt-5-mini', 'gpt-5-mini', 50);
			const largeChunks = estimateWorkflowCost(sampleContent, 'gpt-5-mini', 'gpt-5-mini', 4000);
			// Smaller chunks = more chunks = more system prompt overhead = higher cost
			expect(smallChunks.totalCostUsd).toBeGreaterThan(largeChunks.totalCostUsd);
		});
	});

	describe('WorkflowCostEstimate type', () => {
		it('has required properties', () => {
			const estimate: WorkflowCostEstimate = {
				cleanup: {
					estimatedInputTokens: 500,
					estimatedOutputTokens: 500,
					estimatedCostUsd: 0.01
				},
				translate: {
					estimatedInputTokens: 500,
					estimatedOutputTokens: 750,
					estimatedCostUsd: 0.02
				},
				totalTokens: 2250,
				totalCostUsd: 0.03
			};
			expect(estimate.cleanup.estimatedCostUsd).toBe(0.01);
			expect(estimate.translate.estimatedCostUsd).toBe(0.02);
			expect(estimate.totalCostUsd).toBe(0.03);
			expect(estimate.totalTokens).toBe(2250);
		});
	});

	describe('reasoning effort multipliers', () => {
		describe('DEFAULT_REASONING_MULTIPLIERS', () => {
			it('has expected default values', () => {
				expect(DEFAULT_REASONING_MULTIPLIERS.none).toBe(1.0);
				expect(DEFAULT_REASONING_MULTIPLIERS.minimal).toBe(1.0);
				expect(DEFAULT_REASONING_MULTIPLIERS.low).toBe(1.3);
				expect(DEFAULT_REASONING_MULTIPLIERS.medium).toBe(2.0);
				expect(DEFAULT_REASONING_MULTIPLIERS.high).toBe(3.5);
			});
		});

		describe('getReasoningMultiplier', () => {
			it('returns 1.0 for none reasoning effort', () => {
				expect(getReasoningMultiplier('none')).toBe(1.0);
			});

			it('returns 1.0 for minimal reasoning effort', () => {
				expect(getReasoningMultiplier('minimal')).toBe(1.0);
			});

			it('returns 1.3 for low reasoning effort', () => {
				expect(getReasoningMultiplier('low')).toBe(1.3);
			});

			it('returns 2.0 for medium reasoning effort', () => {
				expect(getReasoningMultiplier('medium')).toBe(2.0);
			});

			it('returns 3.5 for high reasoning effort', () => {
				expect(getReasoningMultiplier('high')).toBe(3.5);
			});

			it('returns 1.0 for undefined reasoning effort', () => {
				expect(getReasoningMultiplier(undefined)).toBe(1.0);
			});

			it('uses custom multipliers when provided', () => {
				const customMultipliers: ReasoningMultipliers = {
					none: 1.0,
					minimal: 1.1,
					low: 1.5,
					medium: 2.5,
					high: 4.0
				};
				expect(getReasoningMultiplier('medium', customMultipliers)).toBe(2.5);
				expect(getReasoningMultiplier('high', customMultipliers)).toBe(4.0);
			});
		});

		describe('estimateJobCost with reasoning effort', () => {
			const sampleChunks = [
				'This is the first chunk of text to be processed.',
				'This is the second chunk with some more content.',
				'And here is a third chunk for good measure.'
			];

			it('increases output tokens for high reasoning effort', () => {
				const noReasoning = estimateJobCost(sampleChunks, 'gpt-5-mini', 'cleanup');
				const highReasoning = estimateJobCost(sampleChunks, 'gpt-5-mini', 'cleanup', 'high');

				// High reasoning should have more output tokens (3.5x multiplier)
				expect(highReasoning.estimatedOutputTokens).toBeGreaterThan(noReasoning.estimatedOutputTokens);
				expect(highReasoning.estimatedOutputTokens).toBe(
					Math.round(noReasoning.estimatedOutputTokens * 3.5)
				);
			});

			it('increases cost for medium reasoning effort', () => {
				const noReasoning = estimateJobCost(sampleChunks, 'gpt-5-mini', 'translate');
				const mediumReasoning = estimateJobCost(sampleChunks, 'gpt-5-mini', 'translate', 'medium');

				// Medium reasoning should cost more (2.0x output multiplier)
				expect(mediumReasoning.estimatedCostUsd).toBeGreaterThan(noReasoning.estimatedCostUsd);
			});

			it('does not change input tokens for reasoning effort', () => {
				const noReasoning = estimateJobCost(sampleChunks, 'gpt-5-mini', 'cleanup');
				const highReasoning = estimateJobCost(sampleChunks, 'gpt-5-mini', 'cleanup', 'high');

				// Input tokens should be the same regardless of reasoning effort
				expect(highReasoning.estimatedInputTokens).toBe(noReasoning.estimatedInputTokens);
			});

			it('ignores reasoning effort for GPT-4 models', () => {
				const noReasoning = estimateJobCost(sampleChunks, 'gpt-4.1', 'cleanup');
				const highReasoning = estimateJobCost(sampleChunks, 'gpt-4.1', 'cleanup', 'high');

				// GPT-4 doesn't support reasoning, so costs should be identical
				expect(highReasoning.estimatedOutputTokens).toBe(noReasoning.estimatedOutputTokens);
				expect(highReasoning.estimatedCostUsd).toBe(noReasoning.estimatedCostUsd);
			});

			it('uses custom multipliers when provided', () => {
				const customMultipliers: ReasoningMultipliers = {
					none: 1.0,
					minimal: 1.0,
					low: 2.0,
					medium: 3.0,
					high: 5.0
				};

				const defaultHigh = estimateJobCost(sampleChunks, 'gpt-5-mini', 'cleanup', 'high');
				const customHigh = estimateJobCost(sampleChunks, 'gpt-5-mini', 'cleanup', 'high', customMultipliers);

				// Custom 5.0x vs default 3.5x
				expect(customHigh.estimatedOutputTokens).toBeGreaterThan(defaultHigh.estimatedOutputTokens);
			});
		});

		describe('estimateWorkflowCost with reasoning effort', () => {
			const sampleContent = '# Test Document\n\nThis is sample content for testing workflow cost estimation with reasoning effort multipliers.';

			it('applies reasoning effort to both cleanup and translation phases', () => {
				const noReasoning = estimateWorkflowCost(sampleContent, 'gpt-5-mini', 'gpt-5-mini', 4000);
				const highReasoning = estimateWorkflowCost(
					sampleContent, 'gpt-5-mini', 'gpt-5-mini', 4000,
					'high', 'high'
				);

				expect(highReasoning.cleanup.estimatedOutputTokens).toBeGreaterThan(
					noReasoning.cleanup.estimatedOutputTokens
				);
				expect(highReasoning.translate.estimatedOutputTokens).toBeGreaterThan(
					noReasoning.translate.estimatedOutputTokens
				);
				expect(highReasoning.totalCostUsd).toBeGreaterThan(noReasoning.totalCostUsd);
			});

			it('allows different reasoning efforts for each phase', () => {
				const lowCleanupHighTranslate = estimateWorkflowCost(
					sampleContent, 'gpt-5-mini', 'gpt-5-mini', 4000,
					'low', 'high'
				);
				const highCleanupLowTranslate = estimateWorkflowCost(
					sampleContent, 'gpt-5-mini', 'gpt-5-mini', 4000,
					'high', 'low'
				);

				// Cleanup phase should be more expensive when high reasoning is used there
				expect(highCleanupLowTranslate.cleanup.estimatedCostUsd).toBeGreaterThan(
					lowCleanupHighTranslate.cleanup.estimatedCostUsd
				);
				// Translation phase should be more expensive when high reasoning is used there
				expect(lowCleanupHighTranslate.translate.estimatedCostUsd).toBeGreaterThan(
					highCleanupLowTranslate.translate.estimatedCostUsd
				);
			});

			it('uses custom multipliers when provided', () => {
				const customMultipliers: ReasoningMultipliers = {
					none: 1.0,
					minimal: 1.0,
					low: 2.0,
					medium: 4.0,
					high: 6.0
				};

				const defaultMedium = estimateWorkflowCost(
					sampleContent, 'gpt-5-mini', 'gpt-5-mini', 4000,
					'medium', 'medium'
				);
				const customMedium = estimateWorkflowCost(
					sampleContent, 'gpt-5-mini', 'gpt-5-mini', 4000,
					'medium', 'medium', customMultipliers
				);

				// Custom 4.0x vs default 2.0x
				expect(customMedium.totalCostUsd).toBeGreaterThan(defaultMedium.totalCostUsd);
			});
		});
	});
});
