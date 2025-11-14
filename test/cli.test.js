import { describe, test, expect } from '@jest/globals';
import { parseCliArgs } from '../src/cli.js';

describe('CLI', () => {
  describe('parseCliArgs', () => {
    test('should parse required input file path', () => {
      const args = ['node', 'index.js', 'test.md'];
      const result = parseCliArgs(args);

      expect(result.inputFile).toBe('test.md');
    });

    test('should use default values for optional parameters', () => {
      const args = ['node', 'index.js', 'test.md'];
      const result = parseCliArgs(args);

      expect(result.outputDir).toBe('output/');
      expect(result.chunkSize).toBe(4000);
      expect(result.model).toBe('gpt-5-mini');
    });

    test('should parse output directory option', () => {
      const args = ['node', 'index.js', 'test.md', '--output-dir', 'custom-output/'];
      const result = parseCliArgs(args);

      expect(result.outputDir).toBe('custom-output/');
    });

    test('should parse chunk size option', () => {
      const args = ['node', 'index.js', 'test.md', '--chunk-size', '2000'];
      const result = parseCliArgs(args);

      expect(result.chunkSize).toBe(2000);
    });

    test('should parse model option', () => {
      const args = ['node', 'index.js', 'test.md', '--model', 'gpt-4'];
      const result = parseCliArgs(args);

      expect(result.model).toBe('gpt-4');
    });

    test('should parse all options together', () => {
      const args = [
        'node', 'index.js', 'my-book.md',
        '--output-dir', 'translations/',
        '--chunk-size', '3000',
        '--model', 'gpt-4-turbo'
      ];
      const result = parseCliArgs(args);

      expect(result.inputFile).toBe('my-book.md');
      expect(result.outputDir).toBe('translations/');
      expect(result.chunkSize).toBe(3000);
      expect(result.model).toBe('gpt-4-turbo');
    });

    test('should throw error if no input file provided', () => {
      const args = ['node', 'index.js'];

      expect(() => parseCliArgs(args)).toThrow('Input file path is required');
    });

    test('should handle options in any order', () => {
      const args = [
        'node', 'index.js',
        '--model', 'gpt-4',
        'book.md',
        '--chunk-size', '5000'
      ];
      const result = parseCliArgs(args);

      expect(result.inputFile).toBe('book.md');
      expect(result.model).toBe('gpt-4');
      expect(result.chunkSize).toBe(5000);
    });

    test('should parse rectify flag', () => {
      const args = ['node', 'index.js', 'test.md', '--rectify'];
      const result = parseCliArgs(args);

      expect(result.rectify).toBe(true);
    });

    test('should default rectify to false', () => {
      const args = ['node', 'index.js', 'test.md'];
      const result = parseCliArgs(args);

      expect(result.rectify).toBe(false);
    });

    test('should parse rectify flag with other options', () => {
      const args = [
        'node', 'index.js', 'broken.md',
        '--rectify',
        '--output-dir', 'cleaned/',
        '--model', 'gpt-4o'
      ];
      const result = parseCliArgs(args);

      expect(result.inputFile).toBe('broken.md');
      expect(result.rectify).toBe(true);
      expect(result.outputDir).toBe('cleaned/');
      expect(result.model).toBe('gpt-4o');
    });
  });
});
