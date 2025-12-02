import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createActivityEvent,
	createCompleteEvent,
	createErrorEvent,
	createSSEHeaders
} from '$lib/streaming';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { content, filename, stream } = await request.json();

		if (!content) {
			return json({ error: 'No content provided' }, { status: 400 });
		}

		// Decode base64 content to buffer
		const binaryString = atob(content);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		const pdfBuffer = Buffer.from(bytes);

		// If streaming is requested, use SSE
		if (stream) {
			const encoder = new TextEncoder();

			const readableStream = new ReadableStream({
				async start(controller) {
					try {
						// Send activity events to show progress
						controller.enqueue(encoder.encode(createActivityEvent('Initializing PDF converter...')));

						const { createPdfConverter } = await import('../../../../../src/pdfConverter.js');
						controller.enqueue(encoder.encode(createActivityEvent('Loading PDF document...')));

						const converter = await createPdfConverter();
						controller.enqueue(encoder.encode(createActivityEvent('Extracting text and structure...')));

						const markdown = await converter.convertToMarkdown(pdfBuffer);
						controller.enqueue(encoder.encode(createActivityEvent('Generating markdown output...')));

						// Send completion event
						controller.enqueue(encoder.encode(createCompleteEvent(markdown)));
						controller.close();
					} catch (error) {
						const message = error instanceof Error ? error.message : 'Unknown error';
						controller.enqueue(encoder.encode(createErrorEvent(`Conversion failed: ${message}`)));
						controller.close();
					}
				}
			});

			return new Response(readableStream, {
				headers: createSSEHeaders()
			});
		}

		// Non-streaming fallback (original behavior)
		const { createPdfConverter } = await import('../../../../../src/pdfConverter.js');
		const converter = await createPdfConverter();
		const markdown = await converter.convertToMarkdown(pdfBuffer);

		return json({ markdown, filename });
	} catch (error) {
		console.error('PDF conversion error:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: `Conversion failed: ${message}` }, { status: 500 });
	}
};
