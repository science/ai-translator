/**
 * Shortens chunk content for inclusion in an error message.
 */
function previewChunk(content, maxLength = 80) {
  const flattened = content.replace(/\s+/g, ' ').trim();
  return flattened.length <= maxLength ? flattened : `${flattened.slice(0, maxLength)}…`;
}

export async function translateDocument(chunks, translateChunkFn, options = {}) {
  const { onProgress } = options;
  const translatedChunks = [];
  const startTime = Date.now();
  let previousTranslation = null;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkStartTime = Date.now();

    // Build context for context-aware translation
    const context = {
      previousEnglish: i > 0 ? chunks[i - 1].content : null,
      nextEnglish: i < chunks.length - 1 ? chunks[i + 1].content : null,
      previousTranslation: previousTranslation,
      isFirstChunk: i === 0,
      isLastChunk: i === chunks.length - 1
    };

    let translatedContent;
    try {
      translatedContent = await translateChunkFn(chunk.content, context);
    } catch (error) {
      // Without the chunk's identity a mid-document failure is undiagnosable.
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Chunk ${i + 1} of ${chunks.length} failed: ${message} ` +
        `(starts with: "${previewChunk(chunk.content)}")`,
        { cause: error }
      );
    }

    // Store translation for next chunk's context
    previousTranslation = translatedContent;

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
