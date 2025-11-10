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

    test('should use gpt-4o model by default', async () => {
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

    test('should use custom model when specified', async () => {
      const customTranslator = createTranslator({ model: 'gpt-5' });
      customTranslator.client.chat.completions.create = mockCreate;

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'テスト'
          }
        }]
      });

      await customTranslator.translateChunk('Test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5'
        })
      );
    });

    test('should include verbosity and reasoning_effort for gpt-5 models', async () => {
      const gpt5Translator = createTranslator({ model: 'gpt-5' });
      gpt5Translator.client.chat.completions.create = mockCreate;

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'テスト'
          }
        }]
      });

      await gpt5Translator.translateChunk('Test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          verbosity: 'low',
          reasoning_effort: 'medium'
        })
      );
    });

    test('should not include gpt-5 parameters for gpt-4o model', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'テスト'
          }
        }]
      });

      await translator.translateChunk('Test');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('verbosity');
      expect(callArgs).not.toHaveProperty('reasoning_effort');
    });

    test('should support custom verbosity and reasoning_effort', async () => {
      const gpt5Translator = createTranslator({
        model: 'gpt-5',
        verbosity: 'high',
        reasoningEffort: 'low'
      });
      gpt5Translator.client.chat.completions.create = mockCreate;

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'テスト'
          }
        }]
      });

      await gpt5Translator.translateChunk('Test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          verbosity: 'high',
          reasoning_effort: 'low'
        })
      );
    });

    test('should include gpt-5 parameters for gpt-5-mini model', async () => {
      const gpt5MiniTranslator = createTranslator({ model: 'gpt-5-mini' });
      gpt5MiniTranslator.client.chat.completions.create = mockCreate;

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'テスト'
          }
        }]
      });

      await gpt5MiniTranslator.translateChunk('Test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-mini',
          verbosity: 'low',
          reasoning_effort: 'medium'
        })
      );
    });
  });

  describe('error handling and retry logic', () => {
    let translator;
    let mockCreate;
    let consoleSpy;

    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      mockCreate = jest.fn();
      consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      translator = createTranslator({ maxRetries: 3 });
      translator.client.chat.completions.create = mockCreate;
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    test('should retry on rate limit error', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;

      mockCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          choices: [{
            message: { content: '成功' }
          }]
        });

      const result = await translator.translateChunk('Test chunk');

      expect(result).toBe('成功');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    test('should retry on network error', async () => {
      const networkError = new Error('Network error');
      networkError.code = 'ECONNRESET';

      mockCreate
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          choices: [{
            message: { content: 'ネットワーク回復' }
          }]
        });

      const result = await translator.translateChunk('Network test');

      expect(result).toBe('ネットワーク回復');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    test('should use exponential backoff between retries', async () => {
      const error = new Error('Temporary error');
      error.status = 503;

      jest.useFakeTimers();

      mockCreate
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          choices: [{
            message: { content: '成功' }
          }]
        });

      const promise = translator.translateChunk('Test');

      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('成功');
      expect(mockCreate).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    test('should stop retrying after max retries', async () => {
      const error = new Error('Persistent error');
      error.status = 503;

      mockCreate.mockRejectedValue(error);

      await expect(translator.translateChunk('Test')).rejects.toThrow('Persistent error');

      expect(mockCreate).toHaveBeenCalledTimes(4);
    }, 10000);

    test('should log errors with chunk context', async () => {
      const error = new Error('Test error');
      error.status = 500;

      jest.useFakeTimers();

      mockCreate
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          choices: [{
            message: { content: '回復' }
          }]
        });

      const chunkText = '# Test Chapter\n\nThis is test content.';
      const promise = translator.translateChunk(chunkText);

      await jest.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toBe('回復');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Translation error (attempt 1/4)'),
        expect.objectContaining({
          error: 'Test error',
          chunkLength: 37,
          retryingIn: '1000ms'
        })
      );

      jest.useRealTimers();
    });

    test('should not retry on non-retryable errors', async () => {
      const authError = new Error('Invalid API key');
      authError.status = 401;

      mockCreate.mockRejectedValue(authError);

      await expect(translator.translateChunk('Test')).rejects.toThrow('Invalid API key');

      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    test('should handle timeout errors with retry', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';

      mockCreate
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({
          choices: [{
            message: { content: 'タイムアウト回復' }
          }]
        });

      const result = await translator.translateChunk('Timeout test');

      expect(result).toBe('タイムアウト回復');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    test('should include chunk preview in error logs for long chunks', async () => {
      const error = new Error('Test error');
      error.status = 500;

      mockCreate
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          choices: [{
            message: { content: '成功' }
          }]
        });

      const longChunk = 'A'.repeat(200);
      await translator.translateChunk(longChunk);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          chunkPreview: expect.stringMatching(/^A{47}\.\.\.$/),
          chunkLength: 200
        })
      );
    });
  });
});
