import { jest } from '@jest/globals';
import { createRectifier } from '../src/rectifier.js';
import { calculateMaxCompletionTokens } from '../src/translator.js';

describe('Rectifier', () => {
  let mockCreate;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-api-key';
    mockCreate = jest.fn();
  });

  describe('createRectifier', () => {
    it('should create a rectifier with client and rectifyChunk function', () => {
      const rectifier = createRectifier();

      expect(rectifier).toHaveProperty('client');
      expect(rectifier).toHaveProperty('rectifyChunk');
      expect(typeof rectifier.rectifyChunk).toBe('function');
    });
  });

  describe('rectifyChunk', () => {
    it('should rectify a chunk with OCR errors', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Contents\n\nForeword by Jack Kornfield'
          }
        }]
      };
      mockCreate.mockResolvedValue(mockResponse);

      const rectifier = createRectifier();
      rectifier.client.chat.completions.create = mockCreate;

      const chunk = {
        index: 0,
        type: 'preamble',
        content: 'ontents\n\nJoreword by Jack Kornfield'
      };

      const result = await rectifier.rectifyChunk(chunk);
      expect(result).toBe('Contents\n\nForeword by Jack Kornfield');
    });

    it('should remove gibberish and preserve legitimate content', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Preface\n\nWhile studying to obtain my master\'s degree'
          }
        }]
      };
      mockCreate.mockResolvedValue(mockResponse);

      const rectifier = createRectifier();
      rectifier.client.chat.completions.create = mockCreate;

      const chunk = {
        index: 0,
        type: 'paragraph-section',
        content: '26 Gimam & eo. @ 7 Wat\n=sie 00\n\nreface\n\nWw hile studying to obtain my master\'s degree'
      };

      const result = await rectifier.rectifyChunk(chunk);
      expect(result).toContain('Preface');
      expect(result).toContain('While studying');
      expect(result).not.toContain('Gimam');
    });

    it('should handle errors and retry on retryable errors', async () => {
      const error429 = new Error('Rate limit exceeded');
      error429.status = 429;

      const mockResponse = {
        choices: [{
          message: {
            content: 'Corrected text'
          }
        }]
      };

      mockCreate
        .mockRejectedValueOnce(error429)
        .mockResolvedValueOnce(mockResponse);

      const rectifier = createRectifier({ verbose: false });
      rectifier.client.chat.completions.create = mockCreate;

      const chunk = {
        index: 0,
        type: 'preamble',
        content: 'test content'
      };

      const result = await rectifier.rectifyChunk(chunk);
      expect(result).toBe('Corrected text');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should preserve markdown formatting', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '## Chapter 1\n\n### An Ethic of Relationship\n\nThe text continues here.'
          }
        }]
      };
      mockCreate.mockResolvedValue(mockResponse);

      const rectifier = createRectifier();
      rectifier.client.chat.completions.create = mockCreate;

      const chunk = {
        index: 0,
        type: 'header-section',
        headerLevel: 2,
        content: '## Chapter 1\n\n### An Ethic of Relationship\n\ntae text continues here.'
      };

      const result = await rectifier.rectifyChunk(chunk);
      expect(result).toContain('## Chapter 1');
      expect(result).toContain('### An Ethic of Relationship');
      expect(result).toContain('The text continues');
    });

    it('should handle footer markers that break paragraphs', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'I have chosen to use the broad term nonordinary states of consciousness to include any state of consciousness in which there is heightened sensitivity.'
          }
        }]
      };
      mockCreate.mockResolvedValue(mockResponse);

      const rectifier = createRectifier();
      rectifier.client.chat.completions.create = mockCreate;

      const chunk = {
        index: 0,
        type: 'paragraph-section',
        content: 'I have chosen to use the\n\nPreface xxi\n\nbroad term nonordinary states of consciousness to include any\nstate of consciousness in which there is heightened sensitivity.'
      };

      const result = await rectifier.rectifyChunk(chunk);
      expect(result).not.toContain('Preface xxi');
      expect(result).toContain('broad term');
    });
  });

  describe('reasoning_effort model validation', () => {
    it('should use "none" as default reasoning_effort for gpt-5.4 models', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Corrected text' }
        }]
      };
      mockCreate.mockResolvedValue(mockResponse);

      const rectifier = createRectifier({ model: 'gpt-5.4' });
      rectifier.client.chat.completions.create = mockCreate;

      await rectifier.rectifyChunk({ index: 0, type: 'preamble', content: 'test' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5.4',
          reasoning_effort: 'none'
        })
      );
    });

    it('should pass through "none" reasoning_effort for gpt-5 models', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Corrected text' }
        }]
      };
      mockCreate.mockResolvedValue(mockResponse);

      const rectifier = createRectifier({ model: 'gpt-5', reasoningEffort: 'none' });
      rectifier.client.chat.completions.create = mockCreate;

      await rectifier.rectifyChunk({ index: 0, type: 'preamble', content: 'test' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          reasoning_effort: 'none'
        })
      );
    });

    it('should use default "none" reasoning_effort for unknown gpt-5 models', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Corrected text' }
        }]
      };
      mockCreate.mockResolvedValue(mockResponse);

      const rectifier = createRectifier({ model: 'gpt-5' });
      rectifier.client.chat.completions.create = mockCreate;

      await rectifier.rectifyChunk({ index: 0, type: 'preamble', content: 'test' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          reasoning_effort: 'none'
        })
      );
    });
  });

  // Same unbounded-completion and null-content exposure as the translator.
  describe('response handling', () => {
    const makeRectifier = (options = {}) => {
      const rectifier = createRectifier({ maxRetries: 0, verbose: false, ...options });
      rectifier.client.chat.completions.create = mockCreate;
      return rectifier;
    };
    const chunk = content => ({ index: 0, type: 'preamble', content });

    it('should send max_completion_tokens scaled to the chunk', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Fixed' }, finish_reason: 'stop' }]
      });

      await makeRectifier().rectifyChunk(chunk('x'.repeat(4000)));

      expect(mockCreate.mock.calls[0][0].max_completion_tokens).toBe(
        calculateMaxCompletionTokens(4000)
      );
    });

    it('should honour an explicit maxCompletionTokens option', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Fixed' }, finish_reason: 'stop' }]
      });

      await makeRectifier({ maxCompletionTokens: 321 }).rectifyChunk(chunk('Broken'));

      expect(mockCreate.mock.calls[0][0].max_completion_tokens).toBe(321);
    });

    it('should throw a clear error when the response is truncated', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Half a sen' }, finish_reason: 'length' }]
      });

      await expect(
        makeRectifier({ maxCompletionTokens: 500 }).rectifyChunk(chunk('Broken'))
      ).rejects.toThrow(/truncated.*500.*completion token/i);
    });

    it('should throw a clear error when the model refuses', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: { content: null, refusal: 'I cannot help with that.' },
          finish_reason: 'stop'
        }]
      });

      await expect(makeRectifier().rectifyChunk(chunk('Broken'))).rejects.toThrow(
        'Model refused to rectify chunk: I cannot help with that.'
      );
    });

    it('should throw a clear error when content is null without a refusal', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null }, finish_reason: 'stop' }]
      });

      await expect(makeRectifier().rectifyChunk(chunk('Broken'))).rejects.toThrow(
        'Empty response from OpenAI API'
      );
    });
  });
});
