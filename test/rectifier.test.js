import { jest } from '@jest/globals';
import { createRectifier } from '../src/rectifier.js';

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
    it('should use "none" as default reasoning_effort for gpt-5.2 models', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Corrected text' }
        }]
      };
      mockCreate.mockResolvedValue(mockResponse);

      const rectifier = createRectifier({ model: 'gpt-5.2' });
      rectifier.client.chat.completions.create = mockCreate;

      await rectifier.rectifyChunk({ index: 0, type: 'preamble', content: 'test' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5.2',
          reasoning_effort: 'none'
        })
      );
    });

    it('should convert "minimal" to "none" for gpt-5.2 models', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Corrected text' }
        }]
      };
      mockCreate.mockResolvedValue(mockResponse);

      const rectifier = createRectifier({ model: 'gpt-5.2', reasoningEffort: 'minimal' });
      rectifier.client.chat.completions.create = mockCreate;

      await rectifier.rectifyChunk({ index: 0, type: 'preamble', content: 'test' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5.2',
          reasoning_effort: 'none'
        })
      );
    });

    it('should convert "none" to "minimal" for gpt-5 models', async () => {
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
          reasoning_effort: 'minimal'
        })
      );
    });

    it('should use default "medium" reasoning_effort for gpt-5 models', async () => {
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
          reasoning_effort: 'medium'
        })
      );
    });
  });
});
