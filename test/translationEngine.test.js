import { describe, it, expect, jest } from '@jest/globals';
import { translateDocument } from '../src/translationEngine.js';

describe('Translation Engine', () => {
  describe('translateDocument', () => {
    it('should translate all chunks sequentially', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: '# Test Header\n\nParagraph 1' },
        { index: 1, type: 'header-section', content: '## Section 2\n\nParagraph 2' }
      ];

      const mockTranslateChunk = jest.fn()
        .mockResolvedValueOnce('# テストヘッダー\n\n段落1')
        .mockResolvedValueOnce('## セクション2\n\n段落2');

      const result = await translateDocument(chunks, mockTranslateChunk);

      expect(mockTranslateChunk).toHaveBeenCalledTimes(2);
      // Now passes (content, context) - verify content is correct
      expect(mockTranslateChunk).toHaveBeenNthCalledWith(1, '# Test Header\n\nParagraph 1', expect.any(Object));
      expect(mockTranslateChunk).toHaveBeenNthCalledWith(2, '## Section 2\n\nParagraph 2', expect.any(Object));

      expect(result.translatedChunks).toHaveLength(2);
      expect(result.translatedChunks[0].originalContent).toBe('# Test Header\n\nParagraph 1');
      expect(result.translatedChunks[0].translatedContent).toBe('# テストヘッダー\n\n段落1');
      expect(result.translatedChunks[1].originalContent).toBe('## Section 2\n\nParagraph 2');
      expect(result.translatedChunks[1].translatedContent).toBe('## セクション2\n\n段落2');
    });

    it('should track progress during translation', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'Content 1' },
        { index: 1, type: 'header-section', content: 'Content 2' },
        { index: 2, type: 'header-section', content: 'Content 3' }
      ];

      const mockTranslateChunk = jest.fn()
        .mockResolvedValue('Translated');

      const progressUpdates = [];
      const onProgress = jest.fn((progress) => {
        progressUpdates.push(progress);
      });

      await translateDocument(chunks, mockTranslateChunk, { onProgress });

      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(progressUpdates[0]).toMatchObject({ current: 1, total: 3 });
      expect(progressUpdates[1]).toMatchObject({ current: 2, total: 3 });
      expect(progressUpdates[2]).toMatchObject({ current: 3, total: 3 });
    });

    it('should calculate percentage complete', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'Content 1' },
        { index: 1, type: 'header-section', content: 'Content 2' }
      ];

      const mockTranslateChunk = jest.fn().mockResolvedValue('Translated');
      const progressUpdates = [];
      const onProgress = jest.fn((progress) => {
        progressUpdates.push(progress);
      });

      await translateDocument(chunks, mockTranslateChunk, { onProgress });

      expect(progressUpdates[0].percentComplete).toBe(50);
      expect(progressUpdates[1].percentComplete).toBe(100);
    });

    it('should estimate time remaining', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'Content 1' },
        { index: 1, type: 'header-section', content: 'Content 2' }
      ];

      const mockTranslateChunk = jest.fn()
        .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('Translated'), 100)));

      const progressUpdates = [];
      const onProgress = jest.fn((progress) => {
        progressUpdates.push(progress);
      });

      await translateDocument(chunks, mockTranslateChunk, { onProgress });

      expect(progressUpdates[0].estimatedTimeRemaining).toBeGreaterThan(0);
      expect(progressUpdates[1].estimatedTimeRemaining).toBe(0);
    });

    it('should handle translation errors gracefully', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'Content 1' },
        { index: 1, type: 'header-section', content: 'Content 2' }
      ];

      const mockTranslateChunk = jest.fn()
        .mockResolvedValueOnce('Translated 1')
        .mockRejectedValueOnce(new Error('API Error'));

      await expect(
        translateDocument(chunks, mockTranslateChunk)
      ).rejects.toThrow('API Error');
    });

    it('should return empty result for empty chunks array', async () => {
      const chunks = [];
      const mockTranslateChunk = jest.fn();

      const result = await translateDocument(chunks, mockTranslateChunk);

      expect(mockTranslateChunk).not.toHaveBeenCalled();
      expect(result.translatedChunks).toHaveLength(0);
    });

    it('should process chunks sequentially, not in parallel', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'Content 1' },
        { index: 1, type: 'header-section', content: 'Content 2' }
      ];

      const callOrder = [];
      const mockTranslateChunk = jest.fn((content) => {
        callOrder.push(`start-${content}`);
        return new Promise(resolve => {
          setTimeout(() => {
            callOrder.push(`end-${content}`);
            resolve('Translated');
          }, 50);
        });
      });

      await translateDocument(chunks, mockTranslateChunk);

      expect(callOrder).toEqual([
        'start-Content 1',
        'end-Content 1',
        'start-Content 2',
        'end-Content 2'
      ]);
    });
  });

  describe('context-aware translation', () => {
    it('should pass context with previous/next English content to translateChunkFn', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'First chunk content' },
        { index: 1, type: 'header-section', content: 'Second chunk content' },
        { index: 2, type: 'header-section', content: 'Third chunk content' }
      ];

      const capturedContexts = [];
      const mockTranslateChunk = jest.fn((content, context) => {
        capturedContexts.push({ content, context });
        return Promise.resolve(`Translated: ${content}`);
      });

      await translateDocument(chunks, mockTranslateChunk);

      // First chunk: no previous, has next
      expect(capturedContexts[0].context.previousEnglish).toBeNull();
      expect(capturedContexts[0].context.nextEnglish).toBe('Second chunk content');
      expect(capturedContexts[0].context.isFirstChunk).toBe(true);
      expect(capturedContexts[0].context.isLastChunk).toBe(false);

      // Second chunk: has previous and next
      expect(capturedContexts[1].context.previousEnglish).toBe('First chunk content');
      expect(capturedContexts[1].context.nextEnglish).toBe('Third chunk content');
      expect(capturedContexts[1].context.isFirstChunk).toBe(false);
      expect(capturedContexts[1].context.isLastChunk).toBe(false);

      // Third chunk: has previous, no next
      expect(capturedContexts[2].context.previousEnglish).toBe('Second chunk content');
      expect(capturedContexts[2].context.nextEnglish).toBeNull();
      expect(capturedContexts[2].context.isFirstChunk).toBe(false);
      expect(capturedContexts[2].context.isLastChunk).toBe(true);
    });

    it('should chain previousTranslation from one chunk to the next', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'Chunk 1' },
        { index: 1, type: 'header-section', content: 'Chunk 2' },
        { index: 2, type: 'header-section', content: 'Chunk 3' }
      ];

      const capturedContexts = [];
      const mockTranslateChunk = jest.fn((content, context) => {
        capturedContexts.push({ content, context });
        return Promise.resolve(`翻訳: ${content}`);
      });

      await translateDocument(chunks, mockTranslateChunk);

      // First chunk: no previous translation
      expect(capturedContexts[0].context.previousTranslation).toBeNull();

      // Second chunk: gets first chunk's translation
      expect(capturedContexts[1].context.previousTranslation).toBe('翻訳: Chunk 1');

      // Third chunk: gets second chunk's translation
      expect(capturedContexts[2].context.previousTranslation).toBe('翻訳: Chunk 2');
    });

    it('should handle single chunk document correctly', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'Only chunk' }
      ];

      const capturedContexts = [];
      const mockTranslateChunk = jest.fn((content, context) => {
        capturedContexts.push({ content, context });
        return Promise.resolve('翻訳済み');
      });

      await translateDocument(chunks, mockTranslateChunk);

      expect(capturedContexts[0].context.previousEnglish).toBeNull();
      expect(capturedContexts[0].context.nextEnglish).toBeNull();
      expect(capturedContexts[0].context.previousTranslation).toBeNull();
      expect(capturedContexts[0].context.isFirstChunk).toBe(true);
      expect(capturedContexts[0].context.isLastChunk).toBe(true);
    });
  });
});
