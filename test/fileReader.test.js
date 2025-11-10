import { readMarkdownFile } from '../src/fileReader.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('fileReader', () => {
  describe('readMarkdownFile', () => {
    test('should read a simple markdown file', async () => {
      const filePath = join(__dirname, 'fixtures', 'simple.md');
      const content = await readMarkdownFile(filePath);
      
      expect(content).toContain('# Simple Test');
      expect(content).toContain('This is a simple test file');
      expect(typeof content).toBe('string');
    });

    test('should read a multi-header markdown file', async () => {
      const filePath = join(__dirname, 'fixtures', 'multi-header.md');
      const content = await readMarkdownFile(filePath);
      
      expect(content).toContain('# Chapter 1');
      expect(content).toContain('## Section 1.1');
      expect(content).toContain('# Chapter 2');
    });

    test('should throw error for non-existent file', async () => {
      const filePath = join(__dirname, 'fixtures', 'nonexistent.md');
      
      await expect(readMarkdownFile(filePath)).rejects.toThrow('File not found');
    });

    test('should return string content', async () => {
      const filePath = join(__dirname, 'fixtures', 'simple.md');
      const content = await readMarkdownFile(filePath);
      
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
