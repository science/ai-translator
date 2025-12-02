import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { content, filename, model, chunkSize } = await request.json();

		if (!content) {
			return json({ error: 'No content provided' }, { status: 400 });
		}

		// Import CLI modules for rectification
		const { chunkBySize } = await import('../../../../../src/chunker.js');
		const { createRectifier } = await import('../../../../../src/rectifier.js');
		const { rectifyDocument } = await import('../../../../../src/rectificationEngine.js');

		// Chunk the content
		const chunks = chunkBySize(content, chunkSize || 4000);

		// Create rectifier with specified model
		const rectifier = createRectifier({
			model: model || 'gpt-4o',
			verbose: false
		});

		// Rectify all chunks
		const { rectifiedChunks } = await rectifyDocument(chunks, rectifier.rectifyChunk);

		// Assemble the rectified content
		const markdown = rectifiedChunks.map((chunk: { rectifiedContent: string }) => chunk.rectifiedContent).join('\n\n');

		return json({ markdown, filename });
	} catch (error) {
		console.error('Cleanup error:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: `Cleanup failed: ${message}` }, { status: 500 });
	}
};
