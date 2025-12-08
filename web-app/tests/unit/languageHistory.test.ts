import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before importing the module
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key];
		}),
		clear: vi.fn(() => {
			store = {};
		}),
		__getStore: () => store,
		__reset: () => {
			store = {};
		}
	};
})();

vi.stubGlobal('localStorage', localStorageMock);

import {
	getLanguageHistory,
	addLanguageToHistory,
	clearLanguageHistory,
	LANGUAGE_HISTORY_KEY,
	MAX_HISTORY_ITEMS
} from '$lib/languageHistory';

describe('Language History', () => {
	beforeEach(() => {
		localStorageMock.__reset();
		localStorageMock.getItem.mockClear();
		localStorageMock.setItem.mockClear();
	});

	describe('getLanguageHistory', () => {
		it('should return empty array when no history exists', () => {
			const history = getLanguageHistory();
			expect(history).toEqual([]);
		});

		it('should load history from localStorage', () => {
			localStorageMock.__getStore()[LANGUAGE_HISTORY_KEY] = JSON.stringify(['Japanese', 'German']);

			const history = getLanguageHistory();

			expect(history).toEqual(['Japanese', 'German']);
			expect(localStorageMock.getItem).toHaveBeenCalledWith(LANGUAGE_HISTORY_KEY);
		});

		it('should return empty array if localStorage contains invalid JSON', () => {
			localStorageMock.__getStore()[LANGUAGE_HISTORY_KEY] = 'not valid json';

			const history = getLanguageHistory();

			expect(history).toEqual([]);
		});
	});

	describe('addLanguageToHistory', () => {
		it('should store language to history', () => {
			addLanguageToHistory('Japanese');

			const history = getLanguageHistory();
			expect(history).toContain('Japanese');
		});

		it('should persist to localStorage', () => {
			addLanguageToHistory('German');

			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				LANGUAGE_HISTORY_KEY,
				expect.stringContaining('German')
			);
		});

		it('should put most recent at top', () => {
			addLanguageToHistory('Japanese');
			addLanguageToHistory('German');
			addLanguageToHistory('French');

			const history = getLanguageHistory();

			expect(history[0]).toBe('French');
			expect(history[1]).toBe('German');
			expect(history[2]).toBe('Japanese');
		});

		it('should not add duplicates', () => {
			addLanguageToHistory('Japanese');
			addLanguageToHistory('German');
			addLanguageToHistory('Japanese');

			const history = getLanguageHistory();

			expect(history.filter(l => l === 'Japanese').length).toBe(1);
		});

		it('should move existing entry to top when added again', () => {
			addLanguageToHistory('Japanese');
			addLanguageToHistory('German');
			addLanguageToHistory('French');
			addLanguageToHistory('Japanese');

			const history = getLanguageHistory();

			expect(history[0]).toBe('Japanese');
			expect(history.length).toBe(3);
		});

		it('should limit history to MAX_HISTORY_ITEMS items', () => {
			// Add more than MAX_HISTORY_ITEMS languages
			for (let i = 0; i < MAX_HISTORY_ITEMS + 5; i++) {
				addLanguageToHistory(`Language ${i}`);
			}

			const history = getLanguageHistory();

			expect(history.length).toBe(MAX_HISTORY_ITEMS);
		});

		it('should remove oldest items when exceeding limit', () => {
			for (let i = 0; i < MAX_HISTORY_ITEMS + 2; i++) {
				addLanguageToHistory(`Language ${i}`);
			}

			const history = getLanguageHistory();

			// Most recent should be at top
			expect(history[0]).toBe(`Language ${MAX_HISTORY_ITEMS + 1}`);
			// Oldest items (Language 0, Language 1) should be removed
			expect(history).not.toContain('Language 0');
			expect(history).not.toContain('Language 1');
		});

		it('should trim whitespace from language input', () => {
			addLanguageToHistory('  Japanese  ');

			const history = getLanguageHistory();

			expect(history[0]).toBe('Japanese');
		});

		it('should not add empty strings', () => {
			addLanguageToHistory('');
			addLanguageToHistory('   ');

			const history = getLanguageHistory();

			expect(history.length).toBe(0);
		});
	});

	describe('clearLanguageHistory', () => {
		it('should clear all history', () => {
			addLanguageToHistory('Japanese');
			addLanguageToHistory('German');

			clearLanguageHistory();

			const history = getLanguageHistory();
			expect(history).toEqual([]);
		});

		it('should remove from localStorage', () => {
			addLanguageToHistory('Japanese');

			clearLanguageHistory();

			expect(localStorageMock.removeItem).toHaveBeenCalledWith(LANGUAGE_HISTORY_KEY);
		});
	});
});
