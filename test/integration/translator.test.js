import { jest } from '@jest/globals';
import { createTranslator } from '../../src/translator.js';

describe('Translator Integration Tests', () => {
  let mockClient;
  let originalOpenAI;

  beforeEach(() => {
    mockClient = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should translate a simple chunk successfully', async () => {
    mockClient.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'こんにちは世界'
          }
        }
      ]
    });

    const translator = createTranslator({
      client: mockClient,
      model: 'gpt-4o'
    });

    const result = await translator.translateChunk('Hello world');

    expect(result).toBe('こんにちは世界');
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Translate the following English text to Japanese while preserving markdown formatting.'
        },
        {
          role: 'user',
          content: 'Hello world'
        }
      ]
    });
  });

  test('should handle retries on retryable errors', async () => {
    const retryableError = new Error('Rate limit exceeded');
    retryableError.status = 429;

    mockClient.chat.completions.create
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '翻訳されたテキスト'
            }
          }
        ]
      });

    const translator = createTranslator({
      client: mockClient,
      model: 'gpt-4o',
      maxRetries: 2
    });

    const result = await translator.translateChunk('Test text');

    expect(result).toBe('翻訳されたテキスト');
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  test('should add gpt-5 specific parameters when using gpt-5 model', async () => {
    mockClient.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: '翻訳'
          }
        }
      ]
    });

    const translator = createTranslator({
      client: mockClient,
      model: 'gpt-5',
      verbosity: 'high',
      reasoningEffort: 'high'
    });

    await translator.translateChunk('Test');

    const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
    expect(callArgs.model).toBe('gpt-5');
    expect(callArgs.verbosity).toBe('high');
    expect(callArgs.reasoning_effort).toBe('high');
  });
});
