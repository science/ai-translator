import { describe, test, expect, jest } from '@jest/globals';
import { createPdfConverter } from '../src/pdfConverter.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('pdfConverter', () => {
  describe('createPdfConverter', () => {
    test('should return an object with convertToMarkdown function', async () => {
      const converter = await createPdfConverter();

      expect(converter).toBeDefined();
      expect(typeof converter.convertToMarkdown).toBe('function');
    });

    test('should convert PDF buffer to markdown', async () => {
      const converter = await createPdfConverter();
      const pdfPath = join(__dirname, 'fixtures', 'sample.pdf');
      const pdfBuffer = await readFile(pdfPath);

      const markdown = await converter.convertToMarkdown(pdfBuffer);

      expect(typeof markdown).toBe('string');
      expect(markdown.length).toBeGreaterThan(0);
    });

    test('should handle conversion errors gracefully', async () => {
      const converter = await createPdfConverter();
      const invalidBuffer = Buffer.from('not a valid PDF');

      await expect(converter.convertToMarkdown(invalidBuffer)).rejects.toThrow();
    });

    test('should accept empty options', async () => {
      const converter = await createPdfConverter({});

      expect(converter).toBeDefined();
      expect(typeof converter.convertToMarkdown).toBe('function');
    });
  });
});
