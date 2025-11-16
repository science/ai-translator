import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { readPdfFile } from '../../src/pdfReader.js';
import { createPdfConverter } from '../../src/pdfConverter.js';
import { assemblePdfToMarkdown } from '../../src/assembler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('PDF-to-Markdown Integration', () => {
  const testOutputDir = join(__dirname, '../test-output-pdf');

  beforeEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true });
    }
    mkdirSync(testOutputDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true });
    }
  });

  test('should convert PDF to markdown end-to-end', async () => {
    const pdfPath = join(__dirname, '../fixtures/sample.pdf');
    const outputDir = testOutputDir;
    const inputFilePath = 'sample.pdf';

    const pdfBuffer = await readPdfFile(pdfPath);
    const converter = await createPdfConverter();
    const markdown = await converter.convertToMarkdown(pdfBuffer);
    const outputPath = assemblePdfToMarkdown(markdown, outputDir, inputFilePath);

    expect(existsSync(outputPath)).toBe(true);
    expect(outputPath).toContain('sample.md');

    const content = readFileSync(outputPath, 'utf-8');
    expect(typeof content).toBe('string');
    expect(content.length).toBeGreaterThan(0);
  });

  test('should handle PDF with content extraction', async () => {
    const pdfPath = join(__dirname, '../fixtures/sample.pdf');
    const pdfBuffer = await readPdfFile(pdfPath);

    const converter = await createPdfConverter();
    const markdown = await converter.convertToMarkdown(pdfBuffer);

    expect(typeof markdown).toBe('string');
    expect(markdown.length).toBeGreaterThan(0);
    expect(markdown).toContain('Hello World');
  });

  test('should create output file with correct naming', async () => {
    const pdfPath = join(__dirname, '../fixtures/sample.pdf');
    const pdfBuffer = await readPdfFile(pdfPath);

    const converter = await createPdfConverter();
    const markdown = await converter.convertToMarkdown(pdfBuffer);
    const outputPath = assemblePdfToMarkdown(markdown, testOutputDir, 'my-book.pdf');

    expect(outputPath).toContain('my-book.md');
    expect(outputPath).not.toContain('.pdf');
    expect(existsSync(outputPath)).toBe(true);
  });

  describe('Complex PDF (Indigenous Knowledges)', () => {
    test('should extract main title with # markdown heading', async () => {
      const pdfPath = join(__dirname, '../fixtures/Indigenous-Knowledges-in-Psychedelic-Science-Evgenia-Fotiou.pdf');
      const pdfBuffer = await readPdfFile(pdfPath);

      const converter = await createPdfConverter();
      const markdown = await converter.convertToMarkdown(pdfBuffer);

      expect(markdown).toMatch(/^#\s+The role of Indigenous knowledges/m);
    });

    test('should extract section headings with ## markdown', async () => {
      const pdfPath = join(__dirname, '../fixtures/Indigenous-Knowledges-in-Psychedelic-Science-Evgenia-Fotiou.pdf');
      const pdfBuffer = await readPdfFile(pdfPath);

      const converter = await createPdfConverter();
      const markdown = await converter.convertToMarkdown(pdfBuffer);

      expect(markdown).toContain('## INTRODUCTION');
      expect(markdown).toContain('## THE STORY SO FAR');
      expect(markdown).toContain('## DECOLONIZING PSYCHEDELIC SCIENCE');
      expect(markdown).toContain('## CONCLUSIONS');
      expect(markdown).toContain('## REFERENCES');
    });

    test('should extract author and key content', async () => {
      const pdfPath = join(__dirname, '../fixtures/Indigenous-Knowledges-in-Psychedelic-Science-Evgenia-Fotiou.pdf');
      const pdfBuffer = await readPdfFile(pdfPath);

      const converter = await createPdfConverter();
      const markdown = await converter.convertToMarkdown(pdfBuffer);

      expect(markdown).toContain('EVGENIA FOTIOU');
      expect(markdown).toContain('psychedelic science');
      expect(markdown).toContain('Indigenous knowledge');
    });

    test('should produce substantial markdown output', async () => {
      const pdfPath = join(__dirname, '../fixtures/Indigenous-Knowledges-in-Psychedelic-Science-Evgenia-Fotiou.pdf');
      const pdfBuffer = await readPdfFile(pdfPath);

      const converter = await createPdfConverter();
      const markdown = await converter.convertToMarkdown(pdfBuffer);

      expect(markdown.length).toBeGreaterThan(30000);
      expect(markdown.split('\n').length).toBeGreaterThan(50);
    });

    test('should write complex PDF to output file correctly', async () => {
      const pdfPath = join(__dirname, '../fixtures/Indigenous-Knowledges-in-Psychedelic-Science-Evgenia-Fotiou.pdf');
      const pdfBuffer = await readPdfFile(pdfPath);

      const converter = await createPdfConverter();
      const markdown = await converter.convertToMarkdown(pdfBuffer);
      const outputPath = assemblePdfToMarkdown(
        markdown,
        testOutputDir,
        'Indigenous-Knowledges-in-Psychedelic-Science-Evgenia-Fotiou.pdf'
      );

      expect(existsSync(outputPath)).toBe(true);
      expect(outputPath).toContain('Indigenous-Knowledges-in-Psychedelic-Science-Evgenia-Fotiou.md');

      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toContain('# The role of Indigenous knowledges');
      expect(content).toContain('## INTRODUCTION');
      expect(content).toContain('## CONCLUSIONS');
    });
  });
});
