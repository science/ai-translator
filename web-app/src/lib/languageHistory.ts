/**
 * Language history management for storing and retrieving previously used translation languages.
 * Uses localStorage to persist history across sessions.
 */

export const LANGUAGE_HISTORY_KEY = 'translation-language-history';
export const MAX_HISTORY_ITEMS = 10;

/**
 * Get the language history from localStorage.
 * Returns an array of language strings, most recent first.
 */
export function getLanguageHistory(): string[] {
	try {
		const stored = localStorage.getItem(LANGUAGE_HISTORY_KEY);
		if (!stored) {
			return [];
		}
		const parsed = JSON.parse(stored);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed;
	} catch {
		return [];
	}
}

/**
 * Add a language to the history.
 * - Most recent is placed at the top
 * - Duplicates are removed (existing entry moves to top)
 * - History is limited to MAX_HISTORY_ITEMS
 * - Empty/whitespace-only strings are ignored
 */
export function addLanguageToHistory(language: string): void {
	const trimmed = language.trim();
	if (!trimmed) {
		return;
	}

	const history = getLanguageHistory();

	// Remove existing entry if present (will be re-added at top)
	const filtered = history.filter((item) => item !== trimmed);

	// Add to the front (most recent first)
	filtered.unshift(trimmed);

	// Limit to MAX_HISTORY_ITEMS
	const limited = filtered.slice(0, MAX_HISTORY_ITEMS);

	localStorage.setItem(LANGUAGE_HISTORY_KEY, JSON.stringify(limited));
}

/**
 * Clear all language history.
 */
export function clearLanguageHistory(): void {
	localStorage.removeItem(LANGUAGE_HISTORY_KEY);
}
