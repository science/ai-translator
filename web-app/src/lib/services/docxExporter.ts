/**
 * DOCX Export utility for browser-side markdown to DOCX conversion
 * Uses @mohtasham/md-to-docx library
 */

import { convertMarkdownToDocx } from '@mohtasham/md-to-docx';

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
 * Trigger a file download in the browser
 */
function triggerDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
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

	// Trigger download using standard browser mechanism
	triggerDownload(blob, docxFilename);

	return { blob, filename: docxFilename };
}

/**
 * Check if DOCX export is available in this environment
 */
export function isDocxExportAvailable(): boolean {
	return typeof convertMarkdownToDocx === 'function';
}
