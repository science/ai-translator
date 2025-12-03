/**
 * Sanitize text by removing control characters that can cause JSON parsing issues.
 * Keeps: tab (9), line feed (10), carriage return (13)
 * Converts: form feed (12) to double newline (page break)
 * Removes: all other control characters (0-8, 11, 14-31, 127)
 */
export function sanitizeControlCharacters(text: string | null | undefined): string {
	if (typeof text !== 'string') {
		return text as unknown as string;
	}

	let result = '';
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		if (code === 12) {
			// Form feed -> double newline (page break)
			result += '\n\n';
		} else if (code === 9 || code === 10 || code === 13) {
			// Keep tab, LF, CR
			result += text[i];
		} else if (code < 32 || code === 127) {
			// Remove other control characters
			continue;
		} else {
			result += text[i];
		}
	}
	return result;
}
