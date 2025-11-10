import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { TranslationCache } from '../src/cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_CACHE_DIR = join(__dirname, 'fixtures', 'cache-test');
const TEST_CACHE_FILE = join(TEST_CACHE_DIR, 'test-cache.json');

describe('TranslationCache', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_CACHE_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
    } catch (error) {
    }
  });

  describe('initialization', () => {
    test('creates new cache when file does not exist', async () => {
      const cache = new TranslationCache(TEST_CACHE_FILE);
      await cache.load();

      expect(cache.getAll()).toEqual({});
    });

    test('loads existing cache from file', async () => {
      const existingCache = {
        'chunk-0': { original: 'Hello', translated: 'こんにちは' },
        'chunk-1': { original: 'World', translated: '世界' }
      };
      await fs.writeFile(TEST_CACHE_FILE, JSON.stringify(existingCache, null, 2));

      const cache = new TranslationCache(TEST_CACHE_FILE);
      await cache.load();

      expect(cache.get('chunk-0')).toEqual({ original: 'Hello', translated: 'こんにちは' });
      expect(cache.get('chunk-1')).toEqual({ original: 'World', translated: '世界' });
    });

    test('handles corrupted cache file gracefully', async () => {
      await fs.writeFile(TEST_CACHE_FILE, 'invalid json{]');

      const cache = new TranslationCache(TEST_CACHE_FILE);
      await cache.load();

      expect(cache.getAll()).toEqual({});
    });
  });

  describe('get and set operations', () => {
    test('stores and retrieves translation', async () => {
      const cache = new TranslationCache(TEST_CACHE_FILE);
      await cache.load();

      await cache.set('chunk-0', 'Hello', 'こんにちは');

      expect(cache.get('chunk-0')).toEqual({ original: 'Hello', translated: 'こんにちは' });
    });

    test('returns null for non-existent key', async () => {
      const cache = new TranslationCache(TEST_CACHE_FILE);
      await cache.load();

      expect(cache.get('non-existent')).toBeNull();
    });

    test('overwrites existing translation', async () => {
      const cache = new TranslationCache(TEST_CACHE_FILE);
      await cache.load();

      await cache.set('chunk-0', 'Hello', 'こんにちは');
      await cache.set('chunk-0', 'Hello', 'ハロー');

      expect(cache.get('chunk-0')).toEqual({ original: 'Hello', translated: 'ハロー' });
    });
  });

  describe('has operation', () => {
    test('returns true for cached chunk', async () => {
      const cache = new TranslationCache(TEST_CACHE_FILE);
      await cache.load();
      await cache.set('chunk-0', 'Hello', 'こんにちは');

      expect(cache.has('chunk-0')).toBe(true);
    });

    test('returns false for non-cached chunk', async () => {
      const cache = new TranslationCache(TEST_CACHE_FILE);
      await cache.load();

      expect(cache.has('chunk-0')).toBe(false);
    });
  });

  describe('persistence', () => {
    test('saves cache to file after set', async () => {
      const cache = new TranslationCache(TEST_CACHE_FILE);
      await cache.load();

      await cache.set('chunk-0', 'Hello', 'こんにちは');

      const fileContent = await fs.readFile(TEST_CACHE_FILE, 'utf-8');
      const savedCache = JSON.parse(fileContent);

      expect(savedCache['chunk-0']).toEqual({ original: 'Hello', translated: 'こんにちは' });
    });

    test('persists multiple translations', async () => {
      const cache = new TranslationCache(TEST_CACHE_FILE);
      await cache.load();

      await cache.set('chunk-0', 'Hello', 'こんにちは');
      await cache.set('chunk-1', 'World', '世界');
      await cache.set('chunk-2', 'Test', 'テスト');

      const cache2 = new TranslationCache(TEST_CACHE_FILE);
      await cache2.load();

      expect(cache2.get('chunk-0')?.translated).toBe('こんにちは');
      expect(cache2.get('chunk-1')?.translated).toBe('世界');
      expect(cache2.get('chunk-2')?.translated).toBe('テスト');
    });
  });

  describe('getAll operation', () => {
    test('returns all cached translations', async () => {
      const cache = new TranslationCache(TEST_CACHE_FILE);
      await cache.load();

      await cache.set('chunk-0', 'Hello', 'こんにちは');
      await cache.set('chunk-1', 'World', '世界');

      const all = cache.getAll();

      expect(all).toEqual({
        'chunk-0': { original: 'Hello', translated: 'こんにちは' },
        'chunk-1': { original: 'World', translated: '世界' }
      });
    });
  });

  describe('clear operation', () => {
    test('clears all cached translations', async () => {
      const cache = new TranslationCache(TEST_CACHE_FILE);
      await cache.load();

      await cache.set('chunk-0', 'Hello', 'こんにちは');
      await cache.set('chunk-1', 'World', '世界');

      await cache.clear();

      expect(cache.getAll()).toEqual({});
      expect(cache.has('chunk-0')).toBe(false);
    });

    test('clears cache file on disk', async () => {
      const cache = new TranslationCache(TEST_CACHE_FILE);
      await cache.load();

      await cache.set('chunk-0', 'Hello', 'こんにちは');
      await cache.clear();

      const fileContent = await fs.readFile(TEST_CACHE_FILE, 'utf-8');
      const savedCache = JSON.parse(fileContent);

      expect(savedCache).toEqual({});
    });
  });
});
