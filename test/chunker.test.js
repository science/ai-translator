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
});
