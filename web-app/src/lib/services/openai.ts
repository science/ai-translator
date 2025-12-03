// Browser-compatible OpenAI API service
// Uses native fetch() instead of OpenAI SDK

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface ChatCompletionOptions {
	model: string;
	messages: ChatMessage[];
	response_format?: {
		type: 'json_schema';
		json_schema: {
			name: string;
			strict: boolean;
			schema: object;
		};
	};
	verbosity?: string;
	reasoning_effort?: string;
}

export interface ChatCompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		message: {
			role: string;
			content: string;
		};
		finish_reason: string;
	}[];
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

export interface OpenAIClientOptions {
	apiKey: string;
	maxRetries?: number;
	timeout?: number;
}

export interface OpenAIError extends Error {
	status?: number;
	code?: string;
}

export interface OpenAIClient {
	createChatCompletion: (options: ChatCompletionOptions) => Promise<ChatCompletionResponse>;
}

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Strips surrounding quotes from API key (common copy-paste error)
 */
export function sanitizeApiKey(key: string): string {
	let sanitized = key.trim();
	// Strip surrounding double quotes
	if (sanitized.startsWith('"') && sanitized.endsWith('"')) {
		sanitized = sanitized.slice(1, -1);
	}
	// Strip surrounding single quotes
	if (sanitized.startsWith("'") && sanitized.endsWith("'")) {
		sanitized = sanitized.slice(1, -1);
	}
	return sanitized;
}

/**
 * Creates a browser-compatible OpenAI client using native fetch
 */
export function createOpenAIClient(options: OpenAIClientOptions): OpenAIClient {
	if (!options.apiKey || options.apiKey.trim() === '') {
		throw new Error('API key is required');
	}

	const apiKey = sanitizeApiKey(options.apiKey);
	const maxRetries = options.maxRetries ?? 2;

	async function createChatCompletion(
		completionOptions: ChatCompletionOptions
	): Promise<ChatCompletionResponse> {
		const maxAttempts = maxRetries + 1;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				// Build request body
				const body: Record<string, unknown> = {
					model: completionOptions.model,
					messages: completionOptions.messages
				};

				// Add response_format if provided
				if (completionOptions.response_format) {
					body.response_format = completionOptions.response_format;
				}

				// Add GPT-5 parameters if model starts with gpt-5
				if (completionOptions.model.startsWith('gpt-5')) {
					if (completionOptions.verbosity) {
						body.verbosity = completionOptions.verbosity;
					}
					if (completionOptions.reasoning_effort) {
						body.reasoning_effort = completionOptions.reasoning_effort;
					}
				}

				const response = await fetch(OPENAI_API_URL, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${apiKey}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(body)
				});

				if (!response.ok) {
					const errorBody = await response.json().catch(() => ({}));
					const error: OpenAIError = new Error(
						errorBody?.error?.message || `HTTP ${response.status}`
					);
					error.status = response.status;
					throw error;
				}

				const data = await response.json();
				return data as ChatCompletionResponse;
			} catch (error) {
				const isLastAttempt = attempt === maxAttempts;
				const shouldRetry = isRetryableError(error as OpenAIError);

				if (!isLastAttempt && shouldRetry) {
					const backoffDelay = Math.pow(2, attempt - 1) * 1000;
					await sleep(backoffDelay);
				} else {
					throw error;
				}
			}
		}

		// This should never be reached, but TypeScript needs it
		throw new Error('Unexpected end of retry loop');
	}

	return {
		createChatCompletion
	};
}

/**
 * Checks if an error is retryable (429, 5xx, network errors)
 */
export function isRetryableError(error: OpenAIError): boolean {
	const retryableStatusCodes = [429, 500, 502, 503, 504];
	const retryableErrorCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];

	if (error.status && retryableStatusCodes.includes(error.status)) {
		return true;
	}

	if (error.code && retryableErrorCodes.includes(error.code)) {
		return true;
	}

	return false;
}

/**
 * Sleep helper for retry backoff
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
