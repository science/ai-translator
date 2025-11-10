export async function translateDocument(chunks, translateChunkFn, options = {}) {
  const { onProgress } = options;
  const translatedChunks = [];
  const startTime = Date.now();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkStartTime = Date.now();

    const translatedContent = await translateChunkFn(chunk.content);

    translatedChunks.push({
      ...chunk,
      originalContent: chunk.content,
      translatedContent
    });

    if (onProgress) {
      const current = i + 1;
      const total = chunks.length;
      const percentComplete = Math.round((current / total) * 100);

      const elapsed = Date.now() - startTime;
      const averageTimePerChunk = elapsed / current;
      const remainingChunks = total - current;
      const estimatedTimeRemaining = remainingChunks > 0
        ? Math.round(averageTimePerChunk * remainingChunks)
        : 0;

      onProgress({
        current,
        total,
        percentComplete,
        estimatedTimeRemaining
      });
    }
  }

  return { translatedChunks };
}
