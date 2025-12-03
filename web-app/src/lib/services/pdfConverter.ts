// Browser-compatible PDF converter service
// Uses @opendocsg/pdf2md for PDF-to-markdown conversion

import { sanitizeControlCharacters } from '../sanitize';

export interface PdfConverter {
	convertToMarkdown: (pdfBuffer: Uint8Array | ArrayBuffer) => Promise<string>;
}

export interface PdfConverterOptions {
	sanitize?: boolean;
}

/**
 * Creates a browser-compatible PDF converter
 */
export async function createPdfConverter(options: PdfConverterOptions = {}): Promise<PdfConverter> {
	const { sanitize = true } = options;

	// Dynamically import pdf2md (works in browser via Vite bundling)
	const { default: pdf2md } = await import('@opendocsg/pdf2md');

	async function convertToMarkdown(pdfBuffer: Uint8Array | ArrayBuffer): Promise<string> {
		try {
			const markdown = await pdf2md(pdfBuffer);

			// Sanitize control characters by default
			if (sanitize) {
				return sanitizeControlCharacters(markdown);
			}

			return markdown;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`PDF conversion failed: ${message}`);
		}
	}

	return { convertToMarkdown };
}
