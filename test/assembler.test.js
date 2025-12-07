import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { assembleJapaneseOnly, assembleBilingual, assembleRectified, assemblePdfToMarkdown, getLanguageCode } from '../src/assembler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('assembler', () => {
  const testOutputDir = join(__dirname, 'test-output');

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

  describe('assembleJapaneseOnly', () => {
    test('should concatenate translated chunks in order', () => {
      const chunks = [
        {
          index: 0,
          type: 'header-section',
          headerLevel: 1,
          original: '# Introduction\n\nThis is the intro.',
          translation: '# はじめに\n\nこれは紹介です。'
        },
        {
          index: 1,
          type: 'header-section',
          headerLevel: 2,
          original: '## Chapter 1\n\nFirst chapter content.',
          translation: '## 第1章\n\n最初の章の内容。'
        }
      ];

      const outputPath = join(testOutputDir, 'japanese.md');
      assembleJapaneseOnly(chunks, outputPath);

      expect(existsSync(outputPath)).toBe(true);
      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toBe('# はじめに\n\nこれは紹介です。\n\n## 第1章\n\n最初の章の内容。');
    });

    test('should preserve markdown structure', () => {
      const chunks = [
        {
          index: 0,
          type: 'header-section',
          headerLevel: 1,
          original: '# Title\n\n- List item 1\n- List item 2',
          translation: '# タイトル\n\n- リスト項目1\n- リスト項目2'
        }
      ];

      const outputPath = join(testOutputDir, 'with-list.md');
      assembleJapaneseOnly(chunks, outputPath);

      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toContain('# タイトル');
      expect(content).toContain('- リスト項目1');
      expect(content).toContain('- リスト項目2');
    });

    test('should handle empty chunks array', () => {
      const outputPath = join(testOutputDir, 'empty.md');
      assembleJapaneseOnly([], outputPath);

      expect(existsSync(outputPath)).toBe(true);
      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toBe('');
    });

    test('should separate chunks with double newline', () => {
      const chunks = [
        {
          index: 0,
          type: 'header-section',
          headerLevel: 1,
          original: '# Part 1',
          translation: '# パート1'
        },
        {
          index: 1,
          type: 'header-section',
          headerLevel: 1,
          original: '# Part 2',
          translation: '# パート2'
        }
      ];

      const outputPath = join(testOutputDir, 'separated.md');
      assembleJapaneseOnly(chunks, outputPath);

      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toBe('# パート1\n\n# パート2');
    });
  });

  describe('assembleBilingual', () => {
    test('should interleave original and translated chunks', () => {
      const chunks = [
        {
          index: 0,
          type: 'header-section',
          headerLevel: 1,
          original: '# Introduction\n\nThis is the intro.',
          translation: '# はじめに\n\nこれは紹介です。'
        },
        {
          index: 1,
          type: 'header-section',
          headerLevel: 2,
          original: '## Chapter 1\n\nFirst chapter.',
          translation: '## 第1章\n\n最初の章。'
        }
      ];

      const outputPath = join(testOutputDir, 'bilingual.md');
      assembleBilingual(chunks, outputPath);

      expect(existsSync(outputPath)).toBe(true);
      const content = readFileSync(outputPath, 'utf-8');

      expect(content).toContain('# Introduction');
      expect(content).toContain('# はじめに');
      expect(content).toContain('## Chapter 1');
      expect(content).toContain('## 第1章');
    });

    test('should add clear separators between EN and JP sections', () => {
      const chunks = [
        {
          index: 0,
          type: 'header-section',
          headerLevel: 1,
          original: '# Title',
          translation: '# タイトル'
        }
      ];

      const outputPath = join(testOutputDir, 'with-separator.md');
      assembleBilingual(chunks, outputPath);

      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toContain('---');
    });

    test('should maintain alternating pattern for multiple chunks', () => {
      const chunks = [
        {
          index: 0,
          type: 'header-section',
          headerLevel: 1,
          original: '# Part 1',
          translation: '# パート1'
        },
        {
          index: 1,
          type: 'header-section',
          headerLevel: 1,
          original: '# Part 2',
          translation: '# パート2'
        },
        {
          index: 2,
          type: 'header-section',
          headerLevel: 1,
          original: '# Part 3',
          translation: '# パート3'
        }
      ];

      const outputPath = join(testOutputDir, 'multiple.md');
      assembleBilingual(chunks, outputPath);

      const content = readFileSync(outputPath, 'utf-8');
      const lines = content.split('\n');

      expect(content).toMatch(/# Part 1.*---.*# パート1.*---.*# Part 2.*---.*# パート2.*---.*# Part 3.*---.*# パート3/s);
    });

    test('should handle empty chunks array', () => {
      const outputPath = join(testOutputDir, 'empty-bilingual.md');
      assembleBilingual([], outputPath);

      expect(existsSync(outputPath)).toBe(true);
      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toBe('');
    });
  });

  describe('assembleRectified', () => {
    test('should concatenate rectified chunks in order', () => {
      const chunks = [
        {
          index: 0,
          type: 'header-section',
          headerLevel: 1,
          originalContent: 'ontents\n\nJoreword by Jack Kornfield',
          rectifiedContent: 'Contents\n\nForeword by Jack Kornfield'
        },
        {
          index: 1,
          type: 'header-section',
          headerLevel: 2,
          originalContent: 'reface\n\nWw hile studying',
          rectifiedContent: 'Preface\n\nWhile studying'
        }
      ];

      const outputPath = join(testOutputDir, 'rectified.md');
      assembleRectified(chunks, outputPath);

      expect(existsSync(outputPath)).toBe(true);
      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toBe('Contents\n\nForeword by Jack Kornfield\n\nPreface\n\nWhile studying');
    });

    test('should preserve markdown structure', () => {
      const chunks = [
        {
          index: 0,
          type: 'header-section',
          headerLevel: 1,
          originalContent: '# ontents\n\n- Joreword\n- reface',
          rectifiedContent: '# Contents\n\n- Foreword\n- Preface'
        }
      ];

      const outputPath = join(testOutputDir, 'rectified-with-list.md');
      assembleRectified(chunks, outputPath);

      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toContain('# Contents');
      expect(content).toContain('- Foreword');
      expect(content).toContain('- Preface');
    });

    test('should handle empty chunks array', () => {
      const outputPath = join(testOutputDir, 'empty-rectified.md');
      assembleRectified([], outputPath);

      expect(existsSync(outputPath)).toBe(true);
      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toBe('');
    });

    test('should separate chunks with double newline', () => {
      const chunks = [
        {
          index: 0,
          type: 'header-section',
          headerLevel: 1,
          originalContent: '# art 1',
          rectifiedContent: '# Part 1'
        },
        {
          index: 1,
          type: 'header-section',
          headerLevel: 1,
          originalContent: '# art 2',
          rectifiedContent: '# Part 2'
        }
      ];

      const outputPath = join(testOutputDir, 'rectified-separated.md');
      assembleRectified(chunks, outputPath);

      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toBe('# Part 1\n\n# Part 2');
    });

    test('should remove gibberish artifacts', () => {
      const chunks = [
        {
          index: 0,
          type: 'paragraph-section',
          originalContent: '26 Gimam & eo. @ 7 Wat\n\nreface\n\nWw hile studying',
          rectifiedContent: 'Preface\n\nWhile studying'
        }
      ];

      const outputPath = join(testOutputDir, 'rectified-no-gibberish.md');
      assembleRectified(chunks, outputPath);

      const content = readFileSync(outputPath, 'utf-8');
      expect(content).not.toContain('Gimam');
      expect(content).toContain('Preface');
      expect(content).toContain('While studying');
    });
  });

  describe('assemblePdfToMarkdown', () => {
    test('should write markdown content to output file', () => {
      const markdownContent = '# Hello World\n\nThis is a test PDF conversion.';
      const outputDir = testOutputDir;
      const inputFilePath = 'book.pdf';

      const outputPath = assemblePdfToMarkdown(markdownContent, outputDir, inputFilePath);

      expect(existsSync(outputPath)).toBe(true);
      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toBe(markdownContent);
    });

    test('should generate correct output filename from PDF input', () => {
      const markdownContent = '# Test';
      const outputDir = testOutputDir;
      const inputFilePath = 'my-book.pdf';

      const outputPath = assemblePdfToMarkdown(markdownContent, outputDir, inputFilePath);

      expect(outputPath).toContain('my-book.md');
      expect(outputPath).not.toContain('.pdf');
    });

    test('should handle nested input paths', () => {
      const markdownContent = '# Chapter 1';
      const outputDir = testOutputDir;
      const inputFilePath = 'path/to/book.pdf';

      const outputPath = assemblePdfToMarkdown(markdownContent, outputDir, inputFilePath);

      expect(existsSync(outputPath)).toBe(true);
      expect(outputPath).toContain('book.md');
    });

    test('should return the output file path', () => {
      const markdownContent = '# Test Content';
      const outputDir = testOutputDir;
      const inputFilePath = 'sample.pdf';

      const outputPath = assemblePdfToMarkdown(markdownContent, outputDir, inputFilePath);

      expect(typeof outputPath).toBe('string');
      expect(outputPath).toMatch(/sample\.md$/);
    });

    test('should create output directory if it does not exist', () => {
      const markdownContent = '# Content';
      const nestedOutputDir = join(testOutputDir, 'nested', 'dir');
      const inputFilePath = 'book.pdf';

      const outputPath = assemblePdfToMarkdown(markdownContent, nestedOutputDir, inputFilePath);

      expect(existsSync(outputPath)).toBe(true);
      expect(existsSync(nestedOutputDir)).toBe(true);
    });
  });

  describe('getLanguageCode', () => {
    test('should return language code for common languages', () => {
      expect(getLanguageCode('Japanese')).toBe('ja');
      expect(getLanguageCode('German')).toBe('de');
      expect(getLanguageCode('French')).toBe('fr');
      expect(getLanguageCode('Spanish')).toBe('es');
      expect(getLanguageCode('Italian')).toBe('it');
      expect(getLanguageCode('Portuguese')).toBe('pt');
      expect(getLanguageCode('Chinese')).toBe('zh');
      expect(getLanguageCode('Korean')).toBe('ko');
      expect(getLanguageCode('Russian')).toBe('ru');
      expect(getLanguageCode('Dutch')).toBe('nl');
    });

    test('should extract language from style-qualified descriptions', () => {
      expect(getLanguageCode('business casual German')).toBe('de');
      expect(getLanguageCode('formal French')).toBe('fr');
      expect(getLanguageCode('conversational Spanish')).toBe('es');
      expect(getLanguageCode('intimate, warm Japanese')).toBe('ja');
    });

    test('should be case insensitive', () => {
      expect(getLanguageCode('japanese')).toBe('ja');
      expect(getLanguageCode('GERMAN')).toBe('de');
      expect(getLanguageCode('FrEnCh')).toBe('fr');
    });

    test('should return "translated" for unknown languages', () => {
      expect(getLanguageCode('Klingon')).toBe('translated');
      expect(getLanguageCode('Unknown Language')).toBe('translated');
    });

    test('should handle empty or undefined input', () => {
      expect(getLanguageCode('')).toBe('translated');
      expect(getLanguageCode(undefined)).toBe('translated');
      expect(getLanguageCode(null)).toBe('translated');
    });
  });
});
