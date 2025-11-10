import { jest } from '@jest/globals';
import { readMarkdownFile } from '../../src/fileReader.js';
import { chunkBySize } from '../../src/chunker.js';
import { translateDocument } from '../../src/translationEngine.js';
import { assembleJapaneseOnly, assembleBilingual } from '../../src/assembler.js';
import { readFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Full Pipeline Integration Tests', () => {
  const testOutputDir = join(__dirname, 'test-output');

  beforeEach(async () => {
    await mkdir(testOutputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testOutputDir, { recursive: true, force: true });
  });

  test('should process tiny sample document end-to-end', async () => {
    const inputPath = join(__dirname, 'fixtures', 'tiny-sample.md');

    const content = await readMarkdownFile(inputPath);
    expect(content).toContain('# Introduction');
    expect(content).toContain('## Chapter 1');

    const chunks = chunkBySize(content, 4000);
    expect(chunks.length).toBeGreaterThan(0);

    const mockTranslateFn = jest.fn().mockImplementation(async (text) => {
      if (text.includes('# Introduction')) {
        return '# イントロダクション\n\nこれはシンプルなテストドキュメントです。';
      }
      if (text.includes('## Chapter 1')) {
        return '## 第1章\n\nここは翻訳が必要なコンテンツを含む段落です。';
      }
      return `翻訳: ${text}`;
    });

    const { translatedChunks } = await translateDocument(chunks, mockTranslateFn);

    expect(translatedChunks.length).toBe(chunks.length);
    expect(mockTranslateFn).toHaveBeenCalledTimes(chunks.length);

    const transformedChunks = translatedChunks.map(chunk => ({
      ...chunk,
      original: chunk.originalContent,
      translation: chunk.translatedContent
    }));

    const japaneseOutputPath = join(testOutputDir, 'output-japanese.md');
    const bilingualOutputPath = join(testOutputDir, 'output-bilingual.md');

    assembleJapaneseOnly(transformedChunks, japaneseOutputPath);
    assembleBilingual(transformedChunks, bilingualOutputPath);

    const japaneseContent = await readFile(japaneseOutputPath, 'utf-8');
    expect(japaneseContent).toContain('イントロダクション');
    expect(japaneseContent).toContain('第1章');
    expect(japaneseContent).not.toContain('Introduction');

    const bilingualContent = await readFile(bilingualOutputPath, 'utf-8');
    expect(bilingualContent).toContain('Introduction');
    expect(bilingualContent).toContain('イントロダクション');
    expect(bilingualContent).toContain('Chapter 1');
    expect(bilingualContent).toContain('第1章');
  });

  test('should handle empty document', async () => {
    const chunks = [];
    const mockTranslateFn = jest.fn();

    const { translatedChunks } = await translateDocument(chunks, mockTranslateFn);

    expect(translatedChunks).toHaveLength(0);
    expect(mockTranslateFn).not.toHaveBeenCalled();
  });

  test('should preserve markdown structure through pipeline', async () => {
    const markdownContent = `# Header 1

Paragraph with **bold** and *italic*.

## Header 2

- List item 1
- List item 2

[Link text](https://example.com)`;

    const chunks = chunkBySize(markdownContent, 1000);

    const mockTranslateFn = jest.fn().mockImplementation(async (text) => {
      return text.replace(/Header/g, 'ヘッダー')
        .replace(/Paragraph/g, '段落')
        .replace(/bold/g, '太字')
        .replace(/italic/g, '斜体')
        .replace(/List item/g, 'リスト項目')
        .replace(/Link text/g, 'リンクテキスト');
    });

    const { translatedChunks } = await translateDocument(chunks, mockTranslateFn);

    const transformedChunks = translatedChunks.map(chunk => ({
      ...chunk,
      original: chunk.originalContent,
      translation: chunk.translatedContent
    }));

    const japaneseOutputPath = join(testOutputDir, 'structure-test-japanese.md');
    assembleJapaneseOnly(transformedChunks, japaneseOutputPath);

    const output = await readFile(japaneseOutputPath, 'utf-8');

    expect(output).toContain('# ヘッダー 1');
    expect(output).toContain('## ヘッダー 2');
    expect(output).toContain('**太字**');
    expect(output).toContain('*斜体*');
    expect(output).toContain('- リスト項目');
    expect(output).toContain('[リンクテキスト](https://example.com)');
  });
});
