import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { assembleJapaneseOnly, assembleBilingual } from '../src/assembler.js';

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
});
