import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	createTranslator,
	getContextAwareSystemPrompt,
	getLegacySystemPrompt,
	buildContextMessage,
	parseTranslationResponse,
	calculateMaxCompletionTokens,
	type TranslationResult
} from '$lib/services/translator';

describe('translator service', () => {
	describe('getContextAwareSystemPrompt', () => {
		it('should include the target language', () => {
			const prompt = getContextAwareSystemPrompt('Japanese');
			expect(prompt).toContain('Japanese');
		});

		it('should include instructions about JSON format', () => {
			const prompt = getContextAwareSystemPrompt('Japanese');
			expect(prompt).toContain('JSON');
			expect(prompt).toContain('translation');
		});

		it('should include context field instructions', () => {
			const prompt = getContextAwareSystemPrompt('Japanese');
			expect(prompt).toContain('chunk_to_translate');
			expect(prompt).toContain('previous_english');
		});
	});

	describe('getLegacySystemPrompt', () => {
		it('should include the target language', () => {
			const prompt = getLegacySystemPrompt('Spanish');
			expect(prompt).toContain('Spanish');
		});

		it('should include translation guidelines', () => {
			const prompt = getLegacySystemPrompt('Japanese');
			expect(prompt).toContain('markdown');
		});

		it('should not include JSON format instructions', () => {
			const prompt = getLegacySystemPrompt('Japanese');
			expect(prompt).not.toContain('"translation"');
		});
	});

	describe('buildContextMessage', () => {
		it('should build a JSON message with chunk and empty context', () => {
			const message = buildContextMessage('Hello world', {});
			const parsed = JSON.parse(message);

			expect(parsed.chunk_to_translate).toBe('Hello world');
			expect(parsed.context.previous_english).toBeNull();
			expect(parsed.context.next_english).toBeNull();
			expect(parsed.context.previous_japanese_translation).toBeNull();
		});

		it('should include previous English context when provided', () => {
			const message = buildContextMessage('Hello world', {
				previousEnglish: 'Earlier text'
			});
			const parsed = JSON.parse(message);

			expect(parsed.context.previous_english).toBe('Earlier text');
		});

		it('should include next English context when provided', () => {
			const message = buildContextMessage('Hello world', {
				nextEnglish: 'Later text'
			});
			const parsed = JSON.parse(message);

			expect(parsed.context.next_english).toBe('Later text');
		});

		it('should include previous translation when provided', () => {
			const message = buildContextMessage('Hello world', {
				previousTranslation: 'こんにちは'
			});
			const parsed = JSON.parse(message);

			expect(parsed.context.previous_japanese_translation).toBe('こんにちは');
		});

		it('should include all context fields when provided', () => {
			const message = buildContextMessage('Current chunk', {
				previousEnglish: 'Before',
				nextEnglish: 'After',
				previousTranslation: '前の翻訳'
			});
			const parsed = JSON.parse(message);

			expect(parsed.chunk_to_translate).toBe('Current chunk');
			expect(parsed.context.previous_english).toBe('Before');
			expect(parsed.context.next_english).toBe('After');
			expect(parsed.context.previous_japanese_translation).toBe('前の翻訳');
		});
	});

	describe('parseTranslationResponse', () => {
		it('should extract translation from JSON response', () => {
			const response = '{"translation": "こんにちは世界"}';
			const translation = parseTranslationResponse(response);
			expect(translation).toBe('こんにちは世界');
		});

		it('should handle response with extra whitespace', () => {
			const response = '  {"translation": "テスト"}  ';
			const translation = parseTranslationResponse(response);
			expect(translation).toBe('テスト');
		});

		it('should throw on invalid JSON', () => {
			expect(() => parseTranslationResponse('not json')).toThrow();
		});

		it('should throw if translation field is missing', () => {
			expect(() => parseTranslationResponse('{"other": "value"}')).toThrow();
		});

		// Regression: `!parsed.translation` treated an empty string as a missing
		// field. The strict json_schema guarantees the key is present, so "" is a
		// valid (if degenerate) translation and must pass through untouched.
		it('should return an empty string when the model translates to nothing', () => {
			expect(parseTranslationResponse('{"translation": ""}')).toBe('');
		});

		it('should throw when translation is present but not a string', () => {
			expect(() => parseTranslationResponse('{"translation": null}')).toThrow(
				'Missing translation field in response'
			);
			expect(() => parseTranslationResponse('{"translation": 42}')).toThrow(
				'Missing translation field in response'
			);
		});

		it('should throw a clear error when the response is null or empty', () => {
			expect(() => parseTranslationResponse(null as unknown as string)).toThrow(
				'Empty response from OpenAI API'
			);
			expect(() => parseTranslationResponse('')).toThrow('Empty response from OpenAI API');
		});
	});

	describe('createTranslator', () => {
		let originalFetch: typeof globalThis.fetch;

		beforeEach(() => {
			originalFetch = globalThis.fetch;
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it('should throw if API key is not provided', () => {
			expect(() => createTranslator({ apiKey: '' })).toThrow('API key is required');
		});

		// Regression: no completion-token ceiling was ever sent, so the request
		// relied on the model's implicit default. A reasoning model that overruns
		// it returns truncated JSON, which surfaced as a bare SyntaxError.
		describe('completion token limit', () => {
			const okResponse = (content: string, finishReason = 'stop') => ({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 'chatcmpl-123',
						choices: [{ message: { content }, finish_reason: finishReason }],
						usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
					})
			});

			it('should send max_completion_tokens scaled to the chunk', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue(okResponse('{"translation": "訳"}'));

				const translator = createTranslator({ apiKey: 'test-key' });
				await translator.translateChunk('x'.repeat(4000));

				const body = JSON.parse(
					vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string
				);
				expect(body.max_completion_tokens).toBe(calculateMaxCompletionTokens(4000));
			});

			it('should honour an explicit maxCompletionTokens option', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue(okResponse('{"translation": "訳"}'));

				const translator = createTranslator({ apiKey: 'test-key', maxCompletionTokens: 999 });
				await translator.translateChunk('Hello');

				const body = JSON.parse(
					vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string
				);
				expect(body.max_completion_tokens).toBe(999);
			});

			it('should throw a clear error when the response is truncated', async () => {
				globalThis.fetch = vi
					.fn()
					.mockResolvedValue(okResponse('{"translation": "途中で切れ', 'length'));

				const translator = createTranslator({ apiKey: 'test-key', maxCompletionTokens: 500 });

				await expect(translator.translateChunk('Hello')).rejects.toThrow(
					/truncated.*500.*completion token/i
				);
			});

			it('should throw a clear error when the model refuses', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [
								{
									message: { content: null, refusal: 'I cannot help with that.' },
									finish_reason: 'stop'
								}
							]
						})
				});

				const translator = createTranslator({ apiKey: 'test-key' });

				await expect(translator.translateChunk('Hello')).rejects.toThrow(
					'Model refused to translate chunk: I cannot help with that.'
				);
			});
		});

		describe('calculateMaxCompletionTokens', () => {
			it('should scale with source length', () => {
				expect(calculateMaxCompletionTokens(4000)).toBeGreaterThan(
					calculateMaxCompletionTokens(2000)
				);
			});

			it('should leave headroom over observed real-world usage', () => {
				// A 4062-char chunk of prose measured 5489 completion tokens
				// (4010 of them reasoning) on gpt-5.4-mini at medium effort.
				expect(calculateMaxCompletionTokens(4062)).toBeGreaterThan(5489 * 2);
			});

			it('should enforce a floor for tiny chunks', () => {
				expect(calculateMaxCompletionTokens(1)).toBeGreaterThanOrEqual(8192);
				expect(calculateMaxCompletionTokens(0)).toBeGreaterThanOrEqual(8192);
			});
		});

		it('should create a translator with translateChunk function', () => {
			const translator = createTranslator({ apiKey: 'test-key' });
			expect(translator.translateChunk).toBeInstanceOf(Function);
		});

		describe('translateChunk', () => {
			it('should call OpenAI API and return translation (context-aware)', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [
								{
									message: { content: '{"translation": "こんにちは"}' }
								}
							]
						})
				});

				const translator = createTranslator({ apiKey: 'test-key', contextAware: true });
				const result = await translator.translateChunk('Hello');

				expect(result.content).toBe('こんにちは');
			});

			it('should call OpenAI API and return translation (legacy mode)', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [
								{
									message: { content: 'こんにちは' }
								}
							]
						})
				});

				const translator = createTranslator({ apiKey: 'test-key', contextAware: false });
				const result = await translator.translateChunk('Hello');

				expect(result.content).toBe('こんにちは');
			});

			it('should use Japanese as default target language', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: '{"translation": "テスト"}' } }]
						})
				});

				const translator = createTranslator({ apiKey: 'test-key' });
				await translator.translateChunk('Test');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.messages[0].content).toContain('Japanese');
			});

			it('should include context in the message when provided', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: '{"translation": "翻訳"}' } }]
						})
				});

				const translator = createTranslator({ apiKey: 'test-key', contextAware: true });
				await translator.translateChunk('Current', {
					previousEnglish: 'Before',
					previousTranslation: '前'
				});

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				const userMessage = body.messages[1].content;
				const parsedMessage = JSON.parse(userMessage);

				expect(parsedMessage.chunk_to_translate).toBe('Current');
				expect(parsedMessage.context.previous_english).toBe('Before');
				expect(parsedMessage.context.previous_japanese_translation).toBe('前');
			});

			it('should use gpt-4o as default model', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: '{"translation": "テスト"}' } }]
						})
				});

				const translator = createTranslator({ apiKey: 'test-key' });
				await translator.translateChunk('Test');

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
							choices: [{ message: { content: '{"translation": "テスト"}' } }]
						})
				});

				const translator = createTranslator({ apiKey: 'test-key', model: 'gpt-5.4-mini' });
				await translator.translateChunk('Test');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.model).toBe('gpt-5.4-mini');
			});

			it('should include response_format for context-aware mode', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: '{"translation": "テスト"}' } }]
						})
				});

				const translator = createTranslator({ apiKey: 'test-key', contextAware: true });
				await translator.translateChunk('Test');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.response_format).toBeDefined();
				expect(body.response_format.type).toBe('json_schema');
			});

			it('should not include response_format for legacy mode', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: 'Plain translation' } }]
						})
				});

				const translator = createTranslator({ apiKey: 'test-key', contextAware: false });
				await translator.translateChunk('Test');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.response_format).toBeUndefined();
			});

			it('should use "none" as default reasoning_effort for gpt-5.4 models', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: '{"translation": "テスト"}' } }]
						})
				});

				const translator = createTranslator({ apiKey: 'test-key', model: 'gpt-5.4' });
				await translator.translateChunk('Test');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.reasoning_effort).toBe('none');
			});

			it('should pass through "none" reasoning_effort for gpt-5 models', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: '{"translation": "テスト"}' } }]
						})
				});

				const translator = createTranslator({
					apiKey: 'test-key',
					model: 'gpt-5',
					reasoningEffort: 'none'
				});
				await translator.translateChunk('Test');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.reasoning_effort).toBe('none');
			});

			it('should use default "none" reasoning_effort for unknown gpt-5 models', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: '{"translation": "テスト"}' } }]
						})
				});

				const translator = createTranslator({ apiKey: 'test-key', model: 'gpt-5' });
				await translator.translateChunk('Test');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.reasoning_effort).toBe('none');
			});

			it('should return token usage in result', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: '{"translation": "こんにちは"}' } }],
							usage: {
								prompt_tokens: 100,
								completion_tokens: 50,
								total_tokens: 150
							}
						})
				});

				const translator = createTranslator({ apiKey: 'test-key' });
				const result = await translator.translateChunk('Hello');

				expect(result.content).toBe('こんにちは');
				expect(result.usage).toBeDefined();
				expect(result.usage.promptTokens).toBe(100);
				expect(result.usage.completionTokens).toBe(50);
				expect(result.usage.totalTokens).toBe(150);
			});

			it('should handle missing usage data gracefully', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: '{"translation": "こんにちは"}' } }]
							// No usage field
						})
				});

				const translator = createTranslator({ apiKey: 'test-key' });
				const result = await translator.translateChunk('Hello');

				expect(result.content).toBe('こんにちは');
				expect(result.usage.promptTokens).toBe(0);
				expect(result.usage.completionTokens).toBe(0);
				expect(result.usage.totalTokens).toBe(0);
			});
		});
	});
});
