import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createProgressEvent,
	createCompleteEvent,
	createErrorEvent,
	createSSEHeaders
} from '$lib/streaming';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { content, filename, model, chunkSize, stream } = await request.json();

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

		// If streaming is requested, use SSE
		if (stream) {
			const encoder = new TextEncoder();

			const readableStream = new ReadableStream({
				async start(controller) {
					try {
						// Send initial progress
						controller.enqueue(
							encoder.encode(createProgressEvent(0, `Starting cleanup... (${chunks.length} chunks)`))
						);

						// Rectify all chunks with progress callback
						const { rectifiedChunks } = await rectifyDocument(
							chunks,
							rectifier.rectifyChunk,
							{
								onProgress: ({ current, total, percentComplete }: { current: number; total: number; percentComplete: number }) => {
									const message = `Processing chunk ${current}/${total}...`;
									controller.enqueue(encoder.encode(createProgressEvent(percentComplete, message)));
								}
							}
						);

						// Assemble the rectified content
						const markdown = rectifiedChunks
							.map((chunk: { rectifiedContent: string }) => chunk.rectifiedContent)
							.join('\n\n');

						// Send completion event
						controller.enqueue(encoder.encode(createCompleteEvent(markdown)));
						controller.close();
					} catch (error) {
						const message = error instanceof Error ? error.message : 'Unknown error';
						controller.enqueue(encoder.encode(createErrorEvent(`Cleanup failed: ${message}`)));
						controller.close();
					}
				}
			});

			return new Response(readableStream, {
				headers: createSSEHeaders()
			});
		}

		// Non-streaming fallback (original behavior)
		const { rectifiedChunks } = await rectifyDocument(chunks, rectifier.rectifyChunk);
		const markdown = rectifiedChunks
			.map((chunk: { rectifiedContent: string }) => chunk.rectifiedContent)
			.join('\n\n');

		return json({ markdown, filename });
	} catch (error) {
		console.error('Cleanup error:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: `Cleanup failed: ${message}` }, { status: 500 });
	}
};
