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
		const { content, filename, model, chunkSize, reasoningEffort, contextAware = true, stream } = await request.json();

		if (!content) {
			return json({ error: 'No content provided' }, { status: 400 });
		}

		// Import CLI modules for translation
		const { chunkBySize } = await import('../../../../../src/chunker.js');
		const { createTranslator } = await import('../../../../../src/translator.js');
		const { translateDocument } = await import('../../../../../src/translationEngine.js');

		// Chunk the content
		const chunks = chunkBySize(content, chunkSize || 4000);

		// Create translator with specified model and options
		const translator = createTranslator({
			model: model || 'gpt-4o',
			reasoningEffort: reasoningEffort || 'medium',
			contextAware: contextAware,
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
							encoder.encode(createProgressEvent(0, `Starting translation... (${chunks.length} chunks)`))
						);

						// Translate all chunks with progress callback
						const { translatedChunks } = await translateDocument(
							chunks,
							translator.translateChunk,
							{
								onProgress: ({ current, total, percentComplete }: { current: number; total: number; percentComplete: number }) => {
									const message = `Translating chunk ${current}/${total}...`;
									controller.enqueue(encoder.encode(createProgressEvent(percentComplete, message)));
								}
							}
						);

						// Assemble both outputs
						// Japanese-only: just the translations
						const japaneseOnly = translatedChunks
							.map((chunk: { translatedContent: string }) => chunk.translatedContent)
							.join('\n\n');

						// Bilingual: original and translation interleaved with separators
						const bilingual = translatedChunks
							.map((chunk: { originalContent: string; translatedContent: string }) => {
								return `${chunk.originalContent}\n\n---\n\n${chunk.translatedContent}`;
							})
							.join('\n\n---\n\n');

						// Send completion event with both outputs
						const completeData = JSON.stringify({
							type: 'complete',
							japaneseOnly,
							bilingual
						});
						controller.enqueue(encoder.encode(`data: ${completeData}\n\n`));
						controller.close();
					} catch (error) {
						const message = error instanceof Error ? error.message : 'Unknown error';
						controller.enqueue(encoder.encode(createErrorEvent(`Translation failed: ${message}`)));
						controller.close();
					}
				}
			});

			return new Response(readableStream, {
				headers: createSSEHeaders()
			});
		}

		// Non-streaming fallback
		const { translatedChunks } = await translateDocument(chunks, translator.translateChunk);

		const japaneseOnly = translatedChunks
			.map((chunk: { translatedContent: string }) => chunk.translatedContent)
			.join('\n\n');

		const bilingual = translatedChunks
			.map((chunk: { originalContent: string; translatedContent: string }) => {
				return `${chunk.originalContent}\n\n---\n\n${chunk.translatedContent}`;
			})
			.join('\n\n---\n\n');

		return json({ japaneseOnly, bilingual, filename });
	} catch (error) {
		console.error('Translation error:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: `Translation failed: ${message}` }, { status: 500 });
	}
};
