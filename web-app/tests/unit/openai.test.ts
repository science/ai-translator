import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	createOpenAIClient,
	isRetryableError,
	sleep,
	type OpenAIError
} from '$lib/services/openai';

describe('openai service', () => {
	describe('isRetryableError', () => {
		it('should return true for 429 rate limit errors', () => {
			const error: OpenAIError = new Error('Rate limit exceeded');
			error.status = 429;
			expect(isRetryableError(error)).toBe(true);
		});

		it('should return true for 500 server errors', () => {
			const error: OpenAIError = new Error('Internal server error');
			error.status = 500;
			expect(isRetryableError(error)).toBe(true);
		});

		it('should return true for 502 bad gateway', () => {
			const error: OpenAIError = new Error('Bad gateway');
			error.status = 502;
			expect(isRetryableError(error)).toBe(true);
		});

		it('should return true for 503 service unavailable', () => {
			const error: OpenAIError = new Error('Service unavailable');
			error.status = 503;
			expect(isRetryableError(error)).toBe(true);
		});

		it('should return true for 504 gateway timeout', () => {
			const error: OpenAIError = new Error('Gateway timeout');
			error.status = 504;
			expect(isRetryableError(error)).toBe(true);
		});

		it('should return true for network errors', () => {
			const error: OpenAIError = new Error('Network error');
			error.code = 'ECONNRESET';
			expect(isRetryableError(error)).toBe(true);
		});

		it('should return false for 400 bad request', () => {
			const error: OpenAIError = new Error('Bad request');
			error.status = 400;
			expect(isRetryableError(error)).toBe(false);
		});

		it('should return false for 401 unauthorized', () => {
			const error: OpenAIError = new Error('Unauthorized');
			error.status = 401;
			expect(isRetryableError(error)).toBe(false);
		});

		it('should return false for generic errors without status', () => {
			const error: OpenAIError = new Error('Something went wrong');
			expect(isRetryableError(error)).toBe(false);
		});
	});

	describe('sleep', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should resolve after specified milliseconds', async () => {
			const sleepPromise = sleep(1000);

			// Should not have resolved yet
			let resolved = false;
			sleepPromise.then(() => {
				resolved = true;
			});

			expect(resolved).toBe(false);

			// Fast-forward time
			await vi.advanceTimersByTimeAsync(1000);

			// Now should be resolved
			await sleepPromise;
			expect(resolved).toBe(true);
		});
	});

	describe('createOpenAIClient', () => {
		let originalFetch: typeof globalThis.fetch;

		beforeEach(() => {
			originalFetch = globalThis.fetch;
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it('should throw if API key is not provided', () => {
			expect(() => createOpenAIClient({ apiKey: '' })).toThrow('API key is required');
		});

		it('should create a client with required options', () => {
			const client = createOpenAIClient({ apiKey: 'test-key' });
			expect(client).toBeDefined();
			expect(client.createChatCompletion).toBeInstanceOf(Function);
		});

		describe('createChatCompletion', () => {
			it('should call OpenAI API with correct headers', async () => {
				const mockResponse = {
					id: 'chatcmpl-123',
					object: 'chat.completion',
					created: 1677652288,
					model: 'gpt-4o',
					choices: [
						{
							index: 0,
							message: { role: 'assistant', content: 'Hello!' },
							finish_reason: 'stop'
						}
					],
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
				};

				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () => Promise.resolve(mockResponse)
				});

				const client = createOpenAIClient({ apiKey: 'test-api-key' });
				await client.createChatCompletion({
					model: 'gpt-4o',
					messages: [{ role: 'user', content: 'Hi' }]
				});

				expect(globalThis.fetch).toHaveBeenCalledWith(
					'https://api.openai.com/v1/chat/completions',
					expect.objectContaining({
						method: 'POST',
						headers: expect.objectContaining({
							Authorization: 'Bearer test-api-key',
							'Content-Type': 'application/json'
						})
					})
				);
			});

			it('should return parsed response on success', async () => {
				const mockResponse = {
					id: 'chatcmpl-123',
					object: 'chat.completion',
					created: 1677652288,
					model: 'gpt-4o',
					choices: [
						{
							index: 0,
							message: { role: 'assistant', content: 'Hello!' },
							finish_reason: 'stop'
						}
					],
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
				};

				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () => Promise.resolve(mockResponse)
				});

				const client = createOpenAIClient({ apiKey: 'test-key' });
				const result = await client.createChatCompletion({
					model: 'gpt-4o',
					messages: [{ role: 'user', content: 'Hi' }]
				});

				expect(result.choices[0].message.content).toBe('Hello!');
			});

			it('should throw error with status for non-OK response', async () => {
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: false,
					status: 401,
					json: () => Promise.resolve({ error: { message: 'Invalid API key' } })
				});

				const client = createOpenAIClient({ apiKey: 'bad-key' });

				await expect(
					client.createChatCompletion({
						model: 'gpt-4o',
						messages: [{ role: 'user', content: 'Hi' }]
					})
				).rejects.toMatchObject({
					status: 401
				});
			});

			it('should retry on retryable errors', async () => {
				vi.useFakeTimers();

				const mockErrorResponse = {
					ok: false,
					status: 429,
					json: () => Promise.resolve({ error: { message: 'Rate limited' } })
				};

				const mockSuccessResponse = {
					ok: true,
					json: () =>
						Promise.resolve({
							id: 'chatcmpl-123',
							choices: [{ index: 0, message: { role: 'assistant', content: 'OK' } }]
						})
				};

				globalThis.fetch = vi
					.fn()
					.mockResolvedValueOnce(mockErrorResponse)
					.mockResolvedValueOnce(mockSuccessResponse);

				const client = createOpenAIClient({ apiKey: 'test-key', maxRetries: 2 });
				const promise = client.createChatCompletion({
					model: 'gpt-4o',
					messages: [{ role: 'user', content: 'Hi' }]
				});

				// Advance through retry delay
				await vi.advanceTimersByTimeAsync(1000);

				const result = await promise;
				expect(result.choices[0].message.content).toBe('OK');
				expect(globalThis.fetch).toHaveBeenCalledTimes(2);

				vi.useRealTimers();
			});

			it('should include response_format when provided', async () => {
				const mockResponse = {
					id: 'chatcmpl-123',
					choices: [{ index: 0, message: { role: 'assistant', content: '{"translation":"こんにちは"}' } }]
				};

				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () => Promise.resolve(mockResponse)
				});

				const client = createOpenAIClient({ apiKey: 'test-key' });
				await client.createChatCompletion({
					model: 'gpt-4o',
					messages: [{ role: 'user', content: 'translate' }],
					response_format: {
						type: 'json_schema',
						json_schema: {
							name: 'translation_response',
							strict: true,
							schema: { type: 'object', properties: { translation: { type: 'string' } } }
						}
					}
				});

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.response_format).toBeDefined();
				expect(body.response_format.type).toBe('json_schema');
			});

			it('should include GPT-5 parameters when model starts with gpt-5', async () => {
				const mockResponse = {
					id: 'chatcmpl-123',
					choices: [{ index: 0, message: { role: 'assistant', content: 'OK' } }]
				};

				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: true,
					json: () => Promise.resolve(mockResponse)
				});

				const client = createOpenAIClient({ apiKey: 'test-key' });
				await client.createChatCompletion({
					model: 'gpt-5-mini',
					messages: [{ role: 'user', content: 'Hi' }],
					verbosity: 'low',
					reasoning_effort: 'medium'
				});

				const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
				const body = JSON.parse(fetchCall[1]?.body as string);
				expect(body.verbosity).toBe('low');
				expect(body.reasoning_effort).toBe('medium');
			});
		});
	});
});
