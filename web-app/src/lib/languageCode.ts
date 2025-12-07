/**
 * Language code utility for converting language names to ISO codes.
 * Used for naming output files (e.g., book-de.md for German).
 */

// Language code mapping for common languages
const LANGUAGE_CODES: Record<string, string> = {
	japanese: 'ja',
	german: 'de',
	french: 'fr',
	spanish: 'es',
	italian: 'it',
	portuguese: 'pt',
	chinese: 'zh',
	korean: 'ko',
	russian: 'ru',
	arabic: 'ar',
	dutch: 'nl',
	swedish: 'sv',
	norwegian: 'no',
	danish: 'da',
	finnish: 'fi',
	polish: 'pl',
	turkish: 'tr',
	hindi: 'hi',
	thai: 'th',
	vietnamese: 'vi',
	indonesian: 'id',
	greek: 'el',
	hebrew: 'he',
	czech: 'cs',
	hungarian: 'hu',
	ukrainian: 'uk'
};

/**
 * Extracts language code from a target language string.
 * Handles both simple language names ("Japanese") and style-qualified descriptions
 * ("business casual German", "formal French").
 * Returns "translated" for unknown languages.
 */
export function getLanguageCode(targetLanguage: string | null | undefined): string {
	if (!targetLanguage) {
		return 'translated';
	}

	const lowerTarget = targetLanguage.toLowerCase();

	// First, check for exact matches
	if (LANGUAGE_CODES[lowerTarget]) {
		return LANGUAGE_CODES[lowerTarget];
	}

	// Look for a known language name anywhere in the string
	for (const [language, code] of Object.entries(LANGUAGE_CODES)) {
		if (lowerTarget.includes(language)) {
			return code;
		}
	}

	return 'translated';
}

/**
 * Extracts the primary language name from a target language string.
 * Used for display purposes in UI tabs.
 * For "business casual German" returns "German".
 */
export function getLanguageName(targetLanguage: string | null | undefined): string {
	if (!targetLanguage) {
		return 'Translated';
	}

	const lowerTarget = targetLanguage.toLowerCase();

	// Look for a known language name
	for (const language of Object.keys(LANGUAGE_CODES)) {
		if (lowerTarget.includes(language)) {
			// Capitalize first letter
			return language.charAt(0).toUpperCase() + language.slice(1);
		}
	}

	// If no match, return the input as-is (trimmed, capitalized first letter)
	const trimmed = targetLanguage.trim();
	if (trimmed) {
		return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
	}

	return 'Translated';
}
