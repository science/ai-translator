import { describe, it, expect, jest } from '@jest/globals';
import { rectifyDocument } from '../src/rectificationEngine.js';

describe('Rectification Engine', () => {
  describe('rectifyDocument', () => {
    it('should rectify all chunks sequentially', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'ontents\n\nJoreword' },
        { index: 1, type: 'header-section', content: 'reface\n\nWw hile' }
      ];

      const mockRectifyChunk = jest.fn()
        .mockResolvedValueOnce('Contents\n\nForeword')
        .mockResolvedValueOnce('Preface\n\nWhile');

      const result = await rectifyDocument(chunks, mockRectifyChunk);

      expect(mockRectifyChunk).toHaveBeenCalledTimes(2);
      expect(mockRectifyChunk).toHaveBeenNthCalledWith(1, 'ontents\n\nJoreword');
      expect(mockRectifyChunk).toHaveBeenNthCalledWith(2, 'reface\n\nWw hile');

      expect(result.rectifiedChunks).toHaveLength(2);
      expect(result.rectifiedChunks[0].originalContent).toBe('ontents\n\nJoreword');
      expect(result.rectifiedChunks[0].rectifiedContent).toBe('Contents\n\nForeword');
      expect(result.rectifiedChunks[1].originalContent).toBe('reface\n\nWw hile');
      expect(result.rectifiedChunks[1].rectifiedContent).toBe('Preface\n\nWhile');
    });

    it('should track progress during rectification', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'Content 1' },
        { index: 1, type: 'header-section', content: 'Content 2' },
        { index: 2, type: 'header-section', content: 'Content 3' }
      ];

      const mockRectifyChunk = jest.fn()
        .mockResolvedValue('Rectified');

      const progressUpdates = [];
      const onProgress = jest.fn((progress) => {
        progressUpdates.push(progress);
      });

      await rectifyDocument(chunks, mockRectifyChunk, { onProgress });

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

      const mockRectifyChunk = jest.fn().mockResolvedValue('Rectified');
      const progressUpdates = [];
      const onProgress = jest.fn((progress) => {
        progressUpdates.push(progress);
      });

      await rectifyDocument(chunks, mockRectifyChunk, { onProgress });

      expect(progressUpdates[0].percentComplete).toBe(50);
      expect(progressUpdates[1].percentComplete).toBe(100);
    });

    it('should estimate time remaining', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'Content 1' },
        { index: 1, type: 'header-section', content: 'Content 2' }
      ];

      const mockRectifyChunk = jest.fn()
        .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('Rectified'), 100)));

      const progressUpdates = [];
      const onProgress = jest.fn((progress) => {
        progressUpdates.push(progress);
      });

      await rectifyDocument(chunks, mockRectifyChunk, { onProgress });

      expect(progressUpdates[0].estimatedTimeRemaining).toBeGreaterThan(0);
      expect(progressUpdates[1].estimatedTimeRemaining).toBe(0);
    });

    it('should handle rectification errors gracefully', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'Content 1' },
        { index: 1, type: 'header-section', content: 'Content 2' }
      ];

      const mockRectifyChunk = jest.fn()
        .mockResolvedValueOnce('Rectified 1')
        .mockRejectedValueOnce(new Error('API Error'));

      await expect(
        rectifyDocument(chunks, mockRectifyChunk)
      ).rejects.toThrow('API Error');
    });

    it('should return empty result for empty chunks array', async () => {
      const chunks = [];
      const mockRectifyChunk = jest.fn();

      const result = await rectifyDocument(chunks, mockRectifyChunk);

      expect(mockRectifyChunk).not.toHaveBeenCalled();
      expect(result.rectifiedChunks).toHaveLength(0);
    });

    it('should process chunks sequentially, not in parallel', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'Content 1' },
        { index: 1, type: 'header-section', content: 'Content 2' }
      ];

      const callOrder = [];
      const mockRectifyChunk = jest.fn((content) => {
        callOrder.push(`start-${content}`);
        return new Promise(resolve => {
          setTimeout(() => {
            callOrder.push(`end-${content}`);
            resolve('Rectified');
          }, 50);
        });
      });

      await rectifyDocument(chunks, mockRectifyChunk);

      expect(callOrder).toEqual([
        'start-Content 1',
        'end-Content 1',
        'start-Content 2',
        'end-Content 2'
      ]);
    });
  });
});
