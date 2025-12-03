// Browser-compatible chunker service
// Ported from CLI's src/chunker.js

export interface Chunk {
	index: number;
	type: 'header-section' | 'paragraph-section' | 'preamble';
	headerLevel: number | null;
	content: string;
	parentChunk?: number;
}

/**
 * Chunks markdown content by header boundaries
 */
export function chunkMarkdown(content: string): Chunk[] {
	if (!content.trim()) {
		return [];
	}

	const lines = content.split('\n');
	const chunks: Chunk[] = [];
	let currentChunk: string[] = [];
	let currentHeaderLevel: number | null = null;
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

/**
 * Chunks content by size, splitting large sections by paragraphs
 */
export function chunkBySize(content: string, maxChunkSize: number = 4000): Chunk[] {
	const headerChunks = chunkMarkdown(content);
	const finalChunks: Chunk[] = [];
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

/**
 * Splits content by paragraphs to fit within maxSize
 */
function splitByParagraphs(content: string, maxSize: number): string[] {
	const paragraphs = content.split(/\r?\n\r?\n+/);
	const chunks: string[] = [];
	let currentChunk: string[] = [];
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
