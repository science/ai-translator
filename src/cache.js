import fs from 'fs/promises';
import { dirname } from 'path';

export class TranslationCache {
  constructor(cacheFilePath) {
    this.cacheFilePath = cacheFilePath;
    this.cache = {};
  }

  async load() {
    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf-8');
      this.cache = JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.cache = {};
      } else if (error instanceof SyntaxError) {
        this.cache = {};
      } else {
        this.cache = {};
      }
    }
  }

  async set(key, original, translated) {
    this.cache[key] = { original, translated };
    await this.save();
  }

  get(key) {
    return this.cache[key] || null;
  }

  has(key) {
    return key in this.cache;
  }

  getAll() {
    return { ...this.cache };
  }

  async clear() {
    this.cache = {};
    await this.save();
  }

  async save() {
    try {
      const dir = dirname(this.cacheFilePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.cacheFilePath, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save cache: ${error.message}`);
    }
  }
}
