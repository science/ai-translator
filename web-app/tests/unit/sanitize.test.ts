import { describe, it, expect } from 'vitest';
import { sanitizeControlCharacters } from '$lib/sanitize';

describe('sanitizeControlCharacters', () => {
	it('removes null and other dangerous control characters', () => {
		const input = 'Hello\x00\x01\x02World';
		const sanitized = sanitizeControlCharacters(input);
		expect(sanitized).toBe('HelloWorld');
	});

	it('converts form feed to double newline', () => {
		const input = 'Page 1\x0CPage 2';
		const sanitized = sanitizeControlCharacters(input);
		expect(sanitized).toBe('Page 1\n\nPage 2');
	});

	it('keeps tabs, line feeds, and carriage returns', () => {
		const input = 'Line 1\tTabbed\nLine 2\rCarriage';
		const sanitized = sanitizeControlCharacters(input);
		expect(sanitized).toBe('Line 1\tTabbed\nLine 2\rCarriage');
	});

	it('removes all control characters except allowed ones', () => {
		// Create input with all control characters (0-31) and DEL (127)
		let input = '';
		for (let i = 0; i < 32; i++) {
			input += String.fromCharCode(i);
		}
		input += 'Hello';
		input += String.fromCharCode(127); // DEL
		input += 'World';

		const sanitized = sanitizeControlCharacters(input);

		// Should only keep tab (9), LF (10), CR (13), and form feed converted to \n\n
		expect(sanitized).toBe('\t\n\n\n\rHelloWorld');
	});

	it('handles empty string', () => {
		expect(sanitizeControlCharacters('')).toBe('');
	});

	it('handles null input', () => {
		expect(sanitizeControlCharacters(null)).toBe(null);
	});

	it('handles undefined input', () => {
		expect(sanitizeControlCharacters(undefined)).toBe(undefined);
	});

	it('preserves unicode characters', () => {
		const input = 'Hello 世界 — em dash — café';
		const sanitized = sanitizeControlCharacters(input);
		expect(sanitized).toBe('Hello 世界 — em dash — café');
	});

	it('result can safely be used in JSON', () => {
		const input = 'Page 1\x00\x0C\x1FPage 2';
		const sanitized = sanitizeControlCharacters(input);

		// This should not throw
		const json = JSON.stringify({ content: sanitized });
		const parsed = JSON.parse(json);

		expect(parsed.content).toBe(sanitized);
	});
});
