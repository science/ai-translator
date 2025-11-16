import { describe, test, expect } from '@jest/globals';
import { readPdfFile } from '../src/pdfReader.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('pdfReader', () => {
  describe('readPdfFile', () => {
    test('should read a PDF file as a buffer', async () => {
      const fixturePath = join(__dirname, 'fixtures', 'sample.pdf');
      const pdfBuffer = await readPdfFile(fixturePath);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    test('should return buffer with PDF signature', async () => {
      const fixturePath = join(__dirname, 'fixtures', 'sample.pdf');
      const pdfBuffer = await readPdfFile(fixturePath);

      const pdfSignature = pdfBuffer.toString('utf-8', 0, 4);
      expect(pdfSignature).toBe('%PDF');
    });

    test('should throw error for non-existent file', async () => {
      const filePath = join(__dirname, 'fixtures', 'nonexistent.pdf');

      await expect(readPdfFile(filePath)).rejects.toThrow('File not found');
    });

    test('should handle invalid file path', async () => {
      const filePath = '/invalid/path/to/file.pdf';

      await expect(readPdfFile(filePath)).rejects.toThrow('File not found');
    });
  });
});
