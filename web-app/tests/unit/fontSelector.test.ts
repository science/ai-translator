import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
	selectFontForLanguage,
	getFontData,
	AVAILABLE_FONTS,
	clearFontCaches,
	type FontSelection
} from '$lib/services/fontSelector';

describe('fontSelector', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearFontCaches();
	});

	describe('AVAILABLE_FONTS', () => {
		it('contains builtin font with null URL', () => {
			expect(AVAILABLE_FONTS.builtin).toBeDefined();
			expect(AVAILABLE_FONTS.builtin.url).toBeNull();
		});

		it('contains NotoSansJP for Japanese', () => {
			expect(AVAILABLE_FONTS.NotoSansJP).toBeDefined();
			expect(AVAILABLE_FONTS.NotoSansJP.url).toBeTruthy();
		});

		it('contains fonts for major non-Latin scripts', () => {
			expect(AVAILABLE_FONTS.NotoSansKR).toBeDefined();
			expect(AVAILABLE_FONTS.NotoSansSC).toBeDefined();
			expect(AVAILABLE_FONTS.NotoSansArabic).toBeDefined();
			expect(AVAILABLE_FONTS.NotoSansThai).toBeDefined();
			expect(AVAILABLE_FONTS.NotoSansDevanagari).toBeDefined();
			expect(AVAILABLE_FONTS.NotoSansHebrew).toBeDefined();
		});
	});

	describe('selectFontForLanguage', () => {
		it('calls OpenAI API with structured JSON output', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{
						message: { content: JSON.stringify({ font: 'NotoSansJP', reason: 'Japanese script' }) }
					}]
				})
			});

			await selectFontForLanguage('Japanese', 'test-api-key');

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.openai.com/v1/chat/completions',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						Authorization: 'Bearer test-api-key'
					})
				})
			);

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.response_format).toEqual({ type: 'json_object' });
		});

		it('returns correct font ID from LLM response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{
						message: { content: JSON.stringify({ font: 'NotoSansArabic', reason: 'Arabic script' }) }
					}]
				})
			});

			const result = await selectFontForLanguage('Arabic for a psychotherapist', 'test-key');

			expect(result.font).toBe('NotoSansArabic');
		});

		it('falls back to builtin on API error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Server Error'
			});

			const result = await selectFontForLanguage('Japanese', 'test-key');

			expect(result.font).toBe('builtin');
		});

		it('falls back to builtin on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await selectFontForLanguage('Japanese', 'test-key');

			expect(result.font).toBe('builtin');
		});

		it('falls back to builtin on invalid JSON response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{
						message: { content: 'not valid json' }
					}]
				})
			});

			const result = await selectFontForLanguage('Japanese', 'test-key');

			expect(result.font).toBe('builtin');
		});

		it('falls back to builtin if LLM returns unknown font ID', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{
						message: { content: JSON.stringify({ font: 'UnknownFont', reason: 'test' }) }
					}]
				})
			});

			const result = await selectFontForLanguage('Japanese', 'test-key');

			expect(result.font).toBe('builtin');
		});

		it('caches result per translation description', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [{
						message: { content: JSON.stringify({ font: 'NotoSansJP', reason: 'Japanese' }) }
					}]
				})
			});

			await selectFontForLanguage('Japanese', 'test-key');
			await selectFontForLanguage('Japanese', 'test-key');

			// Should only call API once due to caching
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it('uses gpt-5.4-mini model by default', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{
						message: { content: JSON.stringify({ font: 'builtin', reason: 'Latin' }) }
					}]
				})
			});

			await selectFontForLanguage('French', 'test-key');

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.model).toBe('gpt-5.4-mini');
		});
	});

	describe('getFontData', () => {
		it('returns null for builtin font', async () => {
			const result = await getFontData('builtin');
			expect(result).toBeNull();
		});

		it('fetches font data from URL for non-builtin fonts', async () => {
			const fakeArrayBuffer = new ArrayBuffer(8);
			mockFetch.mockResolvedValueOnce({
				ok: true,
				arrayBuffer: async () => fakeArrayBuffer
			});

			const result = await getFontData('NotoSansJP');

			expect(result).toBe(fakeArrayBuffer);
			expect(mockFetch).toHaveBeenCalledWith(AVAILABLE_FONTS.NotoSansJP.url);
		});

		it('caches font data across calls', async () => {
			const fakeArrayBuffer = new ArrayBuffer(8);
			mockFetch.mockResolvedValue({
				ok: true,
				arrayBuffer: async () => fakeArrayBuffer
			});

			await getFontData('NotoSansKR');
			await getFontData('NotoSansKR');

			// fetch should only be called once
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it('returns null on fetch error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await getFontData('NotoSansJP');
			expect(result).toBeNull();
		});
	});
});
