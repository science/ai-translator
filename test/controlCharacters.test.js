import { jest } from '@jest/globals';

describe('Control Character Handling', () => {
  describe('JSON.stringify/parse round-trip', () => {
    test('form feed character survives JSON round-trip', () => {
      const original = "Page 1\x0CPage 2"; // form feed
      const json = JSON.stringify({ content: original });
      const parsed = JSON.parse(json);
      expect(parsed.content).toBe(original);
      expect(parsed.content.charCodeAt(6)).toBe(12); // form feed
    });

    test('all control characters are properly escaped', () => {
      // Test various control characters
      const controlChars = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07', // 0-7
        '\x08', '\x0B', '\x0C', '\x0E', '\x0F', // 8, 11, 12, 14, 15
        '\x10', '\x11', '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', // 16-23
        '\x18', '\x19', '\x1A', '\x1B', '\x1C', '\x1D', '\x1E', '\x1F', // 24-31
      ];

      for (const char of controlChars) {
        const original = `before${char}after`;
        const json = JSON.stringify({ content: original });
        const parsed = JSON.parse(json);
        expect(parsed.content).toBe(original);
      }
    });

    test('double JSON round-trip works', () => {
      // Simulates: pdf2md -> SSE JSON -> parse -> store -> cleanup JSON -> parse
      const pdfContent = "Chapter 1\x0C\nChapter 2"; // form feed + newline

      // First stringify (SSE complete event)
      const sseJson = JSON.stringify({ type: 'complete', markdown: pdfContent });

      // First parse (client receives SSE)
      const sseEvent = JSON.parse(sseJson);
      const storedContent = sseEvent.markdown;

      // Second stringify (cleanup API request)
      const requestJson = JSON.stringify({ content: storedContent, model: 'gpt-4o' });

      // Second parse (server receives request)
      const request = JSON.parse(requestJson);

      expect(request.content).toBe(pdfContent);
    });
  });

  describe('sanitizeControlCharacters', () => {
    let sanitizeControlCharacters;

    beforeAll(async () => {
      const module = await import('../src/pdfConverter.js');
      sanitizeControlCharacters = module.sanitizeControlCharacters;
    });

    test('removes null and other dangerous control characters', () => {
      const input = "Hello\x00\x01\x02World";
      const sanitized = sanitizeControlCharacters(input);
      expect(sanitized).toBe("HelloWorld");
    });

    test('converts form feed to double newline', () => {
      const input = "Page 1\x0CPage 2";
      const sanitized = sanitizeControlCharacters(input);
      expect(sanitized).toBe("Page 1\n\nPage 2");
    });

    test('keeps tabs, line feeds, and carriage returns', () => {
      const input = "Line 1\tTabbed\nLine 2\rCarriage";
      const sanitized = sanitizeControlCharacters(input);
      expect(sanitized).toBe("Line 1\tTabbed\nLine 2\rCarriage");
    });

    test('removes all control characters except allowed ones', () => {
      // Create input with all control characters (0-31) and DEL (127)
      let input = "";
      for (let i = 0; i < 32; i++) {
        input += String.fromCharCode(i);
      }
      input += "Hello";
      input += String.fromCharCode(127); // DEL
      input += "World";

      const sanitized = sanitizeControlCharacters(input);

      // Should only keep tab (9), LF (10), CR (13), and form feed converted to \n\n
      expect(sanitized).toBe("\t\n\n\n\rHelloWorld");
    });

    test('handles empty string', () => {
      expect(sanitizeControlCharacters("")).toBe("");
    });

    test('handles non-string input', () => {
      expect(sanitizeControlCharacters(null)).toBe(null);
      expect(sanitizeControlCharacters(undefined)).toBe(undefined);
      expect(sanitizeControlCharacters(123)).toBe(123);
    });

    test('preserves unicode characters', () => {
      const input = "Hello 世界 — em dash — café";
      const sanitized = sanitizeControlCharacters(input);
      expect(sanitized).toBe("Hello 世界 — em dash — café");
    });

    test('result can safely be used in JSON', () => {
      const input = "Page 1\x00\x0C\x1FPage 2";
      const sanitized = sanitizeControlCharacters(input);

      // This should not throw
      const json = JSON.stringify({ content: sanitized });
      const parsed = JSON.parse(json);

      expect(parsed.content).toBe(sanitized);
    });
  });
});
