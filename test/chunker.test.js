import { chunkMarkdown, chunkBySize } from '../src/chunker.js';
import { readMarkdownFile } from '../src/fileReader.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('chunker', () => {
  describe('chunkMarkdown', () => {
    test('should chunk simple markdown file correctly', async () => {
      const filePath = join(__dirname, 'fixtures', 'simple.md');
      const content = await readMarkdownFile(filePath);
      const chunks = chunkMarkdown(content);
      
      const expectedPath = join(__dirname, 'fixtures', 'simple-chunks.json');
      const expected = JSON.parse(await readFile(expectedPath, 'utf-8'));
      
      expect(chunks).toEqual(expected);
    });

    test('should chunk multi-header markdown file correctly', async () => {
      const filePath = join(__dirname, 'fixtures', 'multi-header.md');
      const content = await readMarkdownFile(filePath);
      const chunks = chunkMarkdown(content);
      
      const expectedPath = join(__dirname, 'fixtures', 'multi-header-chunks.json');
      const expected = JSON.parse(await readFile(expectedPath, 'utf-8'));
      
      expect(chunks).toEqual(expected);
    });

    test('should preserve header levels correctly', async () => {
      const filePath = join(__dirname, 'fixtures', 'multi-header.md');
      const content = await readMarkdownFile(filePath);
      const chunks = chunkMarkdown(content);
      
      expect(chunks[0].headerLevel).toBe(1);
      expect(chunks[1].headerLevel).toBe(2);
      expect(chunks[2].headerLevel).toBe(2);
      expect(chunks[3].headerLevel).toBe(3);
      expect(chunks[4].headerLevel).toBe(1);
    });

    test('should include header in chunk content', async () => {
      const filePath = join(__dirname, 'fixtures', 'multi-header.md');
      const content = await readMarkdownFile(filePath);
      const chunks = chunkMarkdown(content);
      
      expect(chunks[0].content).toContain('# Chapter 1');
      expect(chunks[1].content).toContain('## Section 1.1');
      expect(chunks[4].content).toContain('# Chapter 2');
    });

    test('should assign sequential indexes', async () => {
      const filePath = join(__dirname, 'fixtures', 'multi-header.md');
      const content = await readMarkdownFile(filePath);
      const chunks = chunkMarkdown(content);
      
      chunks.forEach((chunk, i) => {
        expect(chunk.index).toBe(i);
      });
    });

    test('should mark chunks as header-section type', async () => {
      const filePath = join(__dirname, 'fixtures', 'multi-header.md');
      const content = await readMarkdownFile(filePath);
      const chunks = chunkMarkdown(content);
      
      chunks.forEach(chunk => {
        expect(chunk.type).toBe('header-section');
      });
    });
  });

  describe('chunkBySize', () => {
    test('should not split small chunks', async () => {
      const filePath = join(__dirname, 'fixtures', 'simple.md');
      const content = await readMarkdownFile(filePath);
      const chunks = chunkBySize(content, 4000);
      
      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toContain('# Simple Test');
    });

    test('should split large chunks by paragraphs', async () => {
      const filePath = join(__dirname, 'fixtures', 'simple.md');
      const content = await readMarkdownFile(filePath);
      const chunks = chunkBySize(content, 50);
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(150);
      });
    });

    test('should preserve metadata when splitting', async () => {
      const filePath = join(__dirname, 'fixtures', 'multi-header.md');
      const content = await readMarkdownFile(filePath);
      const chunks = chunkBySize(content, 50);
      
      chunks.forEach(chunk => {
        expect(chunk).toHaveProperty('index');
        expect(chunk).toHaveProperty('type');
        expect(chunk).toHaveProperty('content');
      });
    });
  });

  describe('empty chunk suppression', () => {
    // Regression: a document beginning with a blank line produced an empty
    // preamble chunk, which the API translated to "" and the translator then
    // rejected as "Missing translation field in response".
    test('should not emit an empty chunk for a leading blank line', async () => {
      const filePath = join(__dirname, 'fixtures', 'leading-blank-line.md');
      const content = await readMarkdownFile(filePath);
      const chunks = chunkBySize(content, 4000);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.filter(c => c.content.trim() === '')).toEqual([]);
      expect(chunks[0].content).toContain('# CHAPTER 1');
    });

    test('should not emit an empty chunk for leading whitespace before a header', () => {
      const chunks = chunkMarkdown('\n\n   \n# Header\n\nBody.');

      expect(chunks.filter(c => c.content.trim() === '')).toEqual([]);
      expect(chunks.length).toBe(1);
    });

    test('should keep indices contiguous after suppressing empty chunks', () => {
      const chunks = chunkMarkdown('\n# One\n\nBody one.\n\n# Two\n\nBody two.');

      expect(chunks.map(c => c.index)).toEqual([0, 1]);
    });

    test('should return an empty array for whitespace-only content', () => {
      expect(chunkMarkdown('\n\n   \n')).toEqual([]);
      expect(chunkBySize('\n\n   \n', 4000)).toEqual([]);
    });

    test('should not emit empty sub-chunks when splitting by paragraphs', () => {
      const body = ['a'.repeat(60), '', '', 'b'.repeat(60), '', '', 'c'.repeat(60)].join('\n\n');
      const chunks = chunkBySize(`# Big\n\n${body}`, 80);

      expect(chunks.filter(c => c.content.trim() === '')).toEqual([]);
    });
  });
});
