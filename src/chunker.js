export function chunkMarkdown(content) {
  const lines = content.split('\n');
  const chunks = [];
  let currentChunk = [];
  let currentHeaderLevel = null;
  let chunkIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headerMatch) {
      if (currentChunk.length > 0) {
        chunks.push({
          index: chunkIndex++,
          type: currentHeaderLevel ? 'header-section' : 'preamble',
          headerLevel: currentHeaderLevel,
          content: currentChunk.join('\n').trim()
        });
        currentChunk = [];
      }

      currentHeaderLevel = headerMatch[1].length;
      currentChunk.push(line);
    } else {
      currentChunk.push(line);
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      index: chunkIndex++,
      type: currentHeaderLevel ? 'header-section' : 'preamble',
      headerLevel: currentHeaderLevel,
      content: currentChunk.join('\n').trim()
    });
  }

  return chunks;
}

export function chunkBySize(content, maxChunkSize = 4000) {
  const headerChunks = chunkMarkdown(content);
  const finalChunks = [];
  let chunkIndex = 0;

  for (const chunk of headerChunks) {
    if (chunk.content.length <= maxChunkSize) {
      finalChunks.push({
        ...chunk,
        index: chunkIndex++
      });
    } else {
      const subChunks = splitByParagraphs(chunk.content, maxChunkSize);
      for (const subChunk of subChunks) {
        finalChunks.push({
          index: chunkIndex++,
          type: 'paragraph-section',
          headerLevel: chunk.headerLevel,
          parentChunk: chunk.index,
          content: subChunk
        });
      }
    }
  }

  return finalChunks;
}

function splitByParagraphs(content, maxSize) {
  const paragraphs = content.split(/\n\n+/);
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  for (const paragraph of paragraphs) {
    const paragraphSize = paragraph.length;

    if (currentSize + paragraphSize > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(paragraph);
    currentSize += paragraphSize;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }

  return chunks;
}
