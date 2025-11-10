import { createTranslator } from '../src/translator.js';

describe('translator', () => {
  describe('createTranslator', () => {
    const originalEnv = process.env.OPENAI_API_KEY;

    afterEach(() => {
      if (originalEnv) {
        process.env.OPENAI_API_KEY = originalEnv;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
    });

    test('should create translator with API key from environment', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';

      const translator = createTranslator();

      expect(translator).toBeDefined();
      expect(translator.client).toBeDefined();
    });

    test('should throw error when API key is missing', () => {
      delete process.env.OPENAI_API_KEY;

      expect(() => createTranslator()).toThrow('OPENAI_API_KEY environment variable is required');
    });

    test('should throw error when API key is empty string', () => {
      process.env.OPENAI_API_KEY = '';

      expect(() => createTranslator()).toThrow('OPENAI_API_KEY environment variable is required');
    });

    test('should accept custom API key as parameter', () => {
      const customKey = 'custom-test-key';

      const translator = createTranslator({ apiKey: customKey });

      expect(translator).toBeDefined();
      expect(translator.client).toBeDefined();
    });

    test('should accept configuration options', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';

      const translator = createTranslator({
        timeout: 60000,
        maxRetries: 5
      });

      expect(translator).toBeDefined();
      expect(translator.client).toBeDefined();
    });

    test('should return object with client and translateChunk method', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';

      const translator = createTranslator();

      expect(translator).toHaveProperty('client');
      expect(translator).toHaveProperty('translateChunk');
      expect(typeof translator.translateChunk).toBe('function');
    });
  });
});
