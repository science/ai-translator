import { jest } from '@jest/globals';
import { translateDocument } from '../../src/translationEngine.js';

describe('Translation Engine Integration Tests', () => {
  test('should translate all chunks sequentially', async () => {
    const chunks = [
      { index: 0, type: 'header-section', content: '# Title', headerLevel: 1 },
      { index: 1, type: 'paragraph-section', content: 'Paragraph 1', headerLevel: null },
      { index: 2, type: 'paragraph-section', content: 'Paragraph 2', headerLevel: null }
    ];

    const mockTranslateFn = jest.fn()
      .mockResolvedValueOnce('# タイトル')
      .mockResolvedValueOnce('段落1')
      .mockResolvedValueOnce('段落2');

    const { translatedChunks } = await translateDocument(chunks, mockTranslateFn);

    expect(translatedChunks).toHaveLength(3);
    expect(translatedChunks[0].originalContent).toBe('# Title');
    expect(translatedChunks[0].translatedContent).toBe('# タイトル');
    expect(translatedChunks[1].translatedContent).toBe('段落1');
    expect(translatedChunks[2].translatedContent).toBe('段落2');
    expect(mockTranslateFn).toHaveBeenCalledTimes(3);
  });

  test('should call onProgress callback with correct data', async () => {
    const chunks = [
      { index: 0, type: 'header-section', content: 'Chunk 1', headerLevel: 1 },
      { index: 1, type: 'paragraph-section', content: 'Chunk 2', headerLevel: null }
    ];

    const mockTranslateFn = jest.fn()
      .mockResolvedValueOnce('チャンク1')
      .mockResolvedValueOnce('チャンク2');

    const progressUpdates = [];
    const onProgress = jest.fn((progress) => {
      progressUpdates.push(progress);
    });

    await translateDocument(chunks, mockTranslateFn, { onProgress });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(progressUpdates[0].current).toBe(1);
    expect(progressUpdates[0].total).toBe(2);
    expect(progressUpdates[0].percentComplete).toBe(50);
    expect(progressUpdates[1].current).toBe(2);
    expect(progressUpdates[1].total).toBe(2);
    expect(progressUpdates[1].percentComplete).toBe(100);
  });

  test('should calculate ETA correctly', async () => {
    const chunks = [
      { index: 0, type: 'header-section', content: 'A', headerLevel: 1 },
      { index: 1, type: 'paragraph-section', content: 'B', headerLevel: null },
      { index: 2, type: 'paragraph-section', content: 'C', headerLevel: null }
    ];

    const mockTranslateFn = jest.fn().mockImplementation(async (content) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return `Translated: ${content}`;
    });

    const progressUpdates = [];
    const onProgress = jest.fn((progress) => {
      progressUpdates.push(progress);
    });

    await translateDocument(chunks, mockTranslateFn, { onProgress });

    expect(progressUpdates[0].estimatedTimeRemaining).toBeGreaterThan(0);
    expect(progressUpdates[1].estimatedTimeRemaining).toBeGreaterThan(0);
    expect(progressUpdates[2].estimatedTimeRemaining).toBe(0);
  });

  test('should propagate errors from translation function', async () => {
    const chunks = [
      { index: 0, type: 'header-section', content: 'Test', headerLevel: 1 }
    ];

    const mockTranslateFn = jest.fn().mockRejectedValue(new Error('API error'));

    await expect(translateDocument(chunks, mockTranslateFn)).rejects.toThrow('API error');
  });
});
