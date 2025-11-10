import { jest } from '@jest/globals';
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

  describe('translateChunk', () => {
    let translator;
    let mockCreate;

    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      mockCreate = jest.fn();

      translator = createTranslator();
      translator.client.chat.completions.create = mockCreate;
    });

    test('should translate text to Japanese by default', async () => {
      const inputText = '# Hello World';
      const expectedTranslation = '# こんにちは世界';

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: expectedTranslation
          }
        }]
      });

      const result = await translator.translateChunk(inputText);

      expect(result).toBe(expectedTranslation);
      expect(mockCreate).toHaveBeenCalledWith({
        model: expect.any(String),
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate the following English text to Japanese while preserving markdown formatting.'
          },
          {
            role: 'user',
            content: inputText
          }
        ]
      });
    });

    test('should preserve markdown formatting in translation', async () => {
      const inputText = '## Introduction\n\nThis is a **bold** statement with a [link](https://example.com).';
      const expectedOutput = '## はじめに\n\nこれは**太字**の文で、[リンク](https://example.com)があります。';

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: expectedOutput
          }
        }]
      });

      const result = await translator.translateChunk(inputText);

      expect(result).toBe(expectedOutput);
    });

    test('should support custom target language', async () => {
      const inputText = 'Hello World';
      const expectedTranslation = 'Hola Mundo';

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: expectedTranslation
          }
        }]
      });

      const result = await translator.translateChunk(inputText, 'Spanish');

      expect(result).toBe(expectedTranslation);
      expect(mockCreate).toHaveBeenCalledWith({
        model: expect.any(String),
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate the following English text to Spanish while preserving markdown formatting.'
          },
          {
            role: 'user',
            content: inputText
          }
        ]
      });
    });

    test('should throw error if API response is invalid', async () => {
      mockCreate.mockResolvedValue({
        choices: []
      });

      await expect(translator.translateChunk('Test')).rejects.toThrow('Invalid response from OpenAI API');
    });

    test('should throw error if choices array is missing', async () => {
      mockCreate.mockResolvedValue({});

      await expect(translator.translateChunk('Test')).rejects.toThrow('Invalid response from OpenAI API');
    });

    test('should propagate API errors', async () => {
      const apiError = new Error('API rate limit exceeded');
      mockCreate.mockRejectedValue(apiError);

      await expect(translator.translateChunk('Test')).rejects.toThrow('API rate limit exceeded');
    });

    test('should use gpt-4o model', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'テスト'
          }
        }]
      });

      await translator.translateChunk('Test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o'
        })
      );
    });
  });
});
