import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { content, filename } = await request.json();

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

		// Use the existing pdfConverter from the CLI tool
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
