export async function rectifyDocument(chunks, rectifyChunkFn, options = {}) {
  const { onProgress } = options;
  const rectifiedChunks = [];
  const startTime = Date.now();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkStartTime = Date.now();

    const rectifiedContent = await rectifyChunkFn(chunk.content);

    rectifiedChunks.push({
      ...chunk,
      originalContent: chunk.content,
      rectifiedContent
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

  return { rectifiedChunks };
}
