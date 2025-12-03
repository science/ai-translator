import { Page } from '@playwright/test';

/**
 * Clears all browser storage (localStorage and IndexedDB)
 */
export async function clearAllStorage(page: Page) {
	await page.evaluate(async () => {
		localStorage.clear();
		const databases = await indexedDB.databases();
		for (const db of databases) {
			if (db.name) indexedDB.deleteDatabase(db.name);
		}
	});
}

/**
 * Document interface for test fixtures
 */
export interface TestDocument {
	id: string;
	name: string;
	type: 'pdf' | 'markdown' | 'text';
	content: string | Blob;
	size: number;
	uploadedAt: string;
	phase?: 'uploaded' | 'converted' | 'cleaned' | 'translated';
	variant?: 'japanese-only' | 'bilingual';
	sourceDocumentId?: string;
}

/**
 * Adds a document to IndexedDB for test setup
 */
export async function addDocumentToIndexedDB(page: Page, doc: TestDocument) {
	await page.evaluate(async (document: TestDocument) => {
		return new Promise<void>((resolve, reject) => {
			const request = indexedDB.open('book-translate-db', 1);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains('documents')) {
					db.createObjectStore('documents', { keyPath: 'id' });
				}
			};
			request.onsuccess = () => {
				const db = request.result;
				const tx = db.transaction('documents', 'readwrite');
				const store = tx.objectStore('documents');

				// Convert base64 to Blob for PDFs
				let content = document.content;
				if (document.type === 'pdf' && typeof content === 'string') {
					const binaryString = atob(content);
					const bytes = new Uint8Array(binaryString.length);
					for (let i = 0; i < binaryString.length; i++) {
						bytes[i] = binaryString.charCodeAt(i);
					}
					content = new Blob([bytes], { type: 'application/pdf' });
				}

				store.put({ ...document, content });
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			};
			request.onerror = () => reject(request.error);
		});
	}, doc);
}

/**
 * Sets the OpenAI API key in localStorage
 */
export async function setApiKey(page: Page, apiKey: string = 'test-api-key') {
	await page.evaluate((key) => {
		localStorage.setItem('openai_api_key', key);
	}, apiKey);
}

/**
 * Interface for captured OpenAI request data
 */
export interface CapturedOpenAIRequest {
	model?: string;
	messages?: Array<{ role: string; content: string }>;
	reasoning_effort?: string;
}

/**
 * Mocks OpenAI chat completions API with a successful response
 * Returns a function to get the captured request
 *
 * @param page - Playwright page
 * @param translatedContent - The content to return (will be JSON-wrapped if jsonWrap is true)
 * @param options.delay - Optional delay before responding
 * @param options.jsonWrap - If true, wraps content in {"translation": "..."} format for contextAware translation
 */
export async function mockOpenAICompletion(
	page: Page,
	translatedContent: string,
	options: { delay?: number; jsonWrap?: boolean } = {}
): Promise<() => CapturedOpenAIRequest | null> {
	let capturedRequest: CapturedOpenAIRequest | null = null;

	await page.route('**/api.openai.com/v1/chat/completions', async (route) => {
		const request = route.request();
		try {
			capturedRequest = JSON.parse((await request.postData()) || '{}');
		} catch {
			capturedRequest = null;
		}

		if (options.delay) {
			await new Promise((resolve) => setTimeout(resolve, options.delay));
		}

		// If jsonWrap is true, wrap the content in the translation JSON format
		const responseContent = options.jsonWrap
			? JSON.stringify({ translation: translatedContent })
			: translatedContent;

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				id: 'chatcmpl-test',
				object: 'chat.completion',
				created: Date.now(),
				model: capturedRequest?.model || 'gpt-5-mini',
				choices: [
					{
						index: 0,
						message: {
							role: 'assistant',
							content: responseContent
						},
						finish_reason: 'stop'
					}
				],
				usage: {
					prompt_tokens: 100,
					completion_tokens: 50,
					total_tokens: 150
				}
			})
		});
	});

	return () => capturedRequest;
}

/**
 * Mocks OpenAI chat completions API with an error response
 */
export async function mockOpenAIError(page: Page, errorMessage: string, statusCode: number = 401) {
	await page.route('**/api.openai.com/v1/chat/completions', async (route) => {
		await route.fulfill({
			status: statusCode,
			contentType: 'application/json',
			body: JSON.stringify({
				error: {
					message: errorMessage,
					type: 'invalid_request_error',
					code: 'invalid_api_key'
				}
			})
		});
	});
}

/**
 * Gets all documents from IndexedDB
 */
export async function getAllDocumentsFromIndexedDB(page: Page): Promise<TestDocument[]> {
	return await page.evaluate(async () => {
		return new Promise((resolve) => {
			const request = indexedDB.open('book-translate-db', 1);
			request.onsuccess = () => {
				const db = request.result;
				const tx = db.transaction('documents', 'readonly');
				const store = tx.objectStore('documents');
				const getAllRequest = store.getAll();
				getAllRequest.onsuccess = () => resolve(getAllRequest.result as any[]);
				getAllRequest.onerror = () => resolve([]);
			};
			request.onerror = () => resolve([]);
		});
	});
}
