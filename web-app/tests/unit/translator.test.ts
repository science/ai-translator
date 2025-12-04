import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	createTranslator,
	getContextAwareSystemPrompt,
	getLegacySystemPrompt,
	buildContextMessage,
	parseTranslationResponse
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

				expect(result).toBe('こんにちは');
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

				expect(result).toBe('こんにちは');
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

				const translator = createTranslator({ apiKey: 'test-key', model: 'gpt-5-mini' });
				await translator.translateChunk('Test');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.model).toBe('gpt-5-mini');
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

			it('should use "none" as default reasoning_effort for gpt-5.1 models', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ message: { content: '{"translation": "テスト"}' } }]
						})
				});

				const translator = createTranslator({ apiKey: 'test-key', model: 'gpt-5.1' });
				await translator.translateChunk('Test');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.reasoning_effort).toBe('none');
			});

			it('should convert "minimal" to "none" for gpt-5.1 models', async () => {
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
					model: 'gpt-5.1',
					reasoningEffort: 'minimal'
				});
				await translator.translateChunk('Test');

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.reasoning_effort).toBe('none');
			});

			it('should convert "none" to "minimal" for gpt-5 models', async () => {
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
				expect(body.reasoning_effort).toBe('minimal');
			});

			it('should use default "medium" reasoning_effort for gpt-5 models', async () => {
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
				expect(body.reasoning_effort).toBe('medium');
			});
		});
	});
});
