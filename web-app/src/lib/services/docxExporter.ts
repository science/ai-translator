/**
 * DOCX Export utility for browser-side markdown to DOCX conversion
 * Uses @mohtasham/md-to-docx library
 */

import { convertMarkdownToDocx } from '@mohtasham/md-to-docx';
import { triggerDownload } from './downloadUtils';

export interface DocxExportResult {
	blob: Blob;
	filename: string;
}

/**
 * Convert markdown content to a DOCX blob
 */
export async function markdownToDocx(markdown: string): Promise<Blob> {
	const blob = await convertMarkdownToDocx(markdown);
	return blob;
}

/**
 * Convert markdown and trigger download in browser
 */
export async function exportMarkdownAsDocx(
	markdown: string,
	filename: string = 'document.docx'
): Promise<DocxExportResult> {
	const blob = await convertMarkdownToDocx(markdown);

	// Ensure filename ends with .docx
	const docxFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

	triggerDownload(blob, docxFilename);

	return { blob, filename: docxFilename };
}

/**
 * Check if DOCX export is available in this environment
 */
export function isDocxExportAvailable(): boolean {
	return typeof convertMarkdownToDocx === 'function';
}
