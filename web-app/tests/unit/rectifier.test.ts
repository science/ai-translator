import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRectifier, getSystemPrompt } from '$lib/services/rectifier';

describe('rectifier service', () => {
	describe('getSystemPrompt', () => {
		it('should include rectification guidelines', () => {
			const prompt = getSystemPrompt();
			expect(prompt).toContain('OCR');
			expect(prompt).toContain('PDF');
		});

		it('should include instructions about fixing errors', () => {
			const prompt = getSystemPrompt();
			expect(prompt).toContain('Fix');
			expect(prompt).toContain('error');
		});

		it('should include output format instructions', () => {
			const prompt = getSystemPrompt();
			expect(prompt).toContain('corrected');
			expect(prompt).toContain('markdown');
		});
	});

	describe('createRectifier', () => {
		let originalFetch: typeof globalThis.fetch;

		beforeEach(() => {
			originalFetch = globalThis.fetch;
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it('should throw if API key is not provided', () => {
			expect(() => createRectifier({ apiKey: '' })).toThrow('API key is required');
		});

		it('should create a rectifier with rectifyChunk function', () => {
			const rectifier = createRectifier({ apiKey: 'test-key' });
			expect(rectifier.rectifyChunk).toBeInstanceOf(Function);
		});

		describe('rectifyChunk', () => {
			it('should call OpenAI API and return rectified content', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [
								{
									message: { content: 'Contents of the book' }
								}
							]
						})
				});

				const rectifier = createRectifier({ apiKey: 'test-key' });
				const result = await rectifier.rectifyChunk('ontents of the book');

				expect(result).toBe('Contents of the book');
			});

			it('should use gpt-4o as default model', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: 'Fixed text' } }]
						})
				});

				const rectifier = createRectifier({ apiKey: 'test-key' });
				await rectifier.rectifyChunk('Broken text');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.model).toBe('gpt-4o');
			});

			it('should use specified model', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: 'Fixed text' } }]
						})
				});

				const rectifier = createRectifier({ apiKey: 'test-key', model: 'gpt-5-mini' });
				await rectifier.rectifyChunk('Broken text');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.model).toBe('gpt-5-mini');
			});

			it('should include verbosity and reasoning_effort for gpt-5 models', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: 'Fixed text' } }]
						})
				});

				const rectifier = createRectifier({
					apiKey: 'test-key',
					model: 'gpt-5-mini',
					verbosity: 'low',
					reasoningEffort: 'high'
				});
				await rectifier.rectifyChunk('Broken text');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.verbosity).toBe('low');
				expect(body.reasoning_effort).toBe('high');
			});

			it('should not include verbosity and reasoning_effort for non-gpt-5 models', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: 'Fixed text' } }]
						})
				});

				const rectifier = createRectifier({ apiKey: 'test-key', model: 'gpt-4o' });
				await rectifier.rectifyChunk('Broken text');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.verbosity).toBeUndefined();
				expect(body.reasoning_effort).toBeUndefined();
			});

			it('should include system prompt in the request', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: 'Fixed text' } }]
						})
				});

				const rectifier = createRectifier({ apiKey: 'test-key' });
				await rectifier.rectifyChunk('Broken text');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.messages[0].role).toBe('system');
				expect(body.messages[0].content).toContain('OCR');
			});

			it('should send the chunk as user message', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: 'Fixed text' } }]
						})
				});

				const rectifier = createRectifier({ apiKey: 'test-key' });
				await rectifier.rectifyChunk('ontents of chapter one');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.messages[1].role).toBe('user');
				expect(body.messages[1].content).toBe('ontents of chapter one');
			});

			it('should throw on invalid API response', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: []
						})
				});

				const rectifier = createRectifier({ apiKey: 'test-key' });
				await expect(rectifier.rectifyChunk('Test')).rejects.toThrow(
					'Invalid response from OpenAI API'
				);
			});
		});
	});
});
