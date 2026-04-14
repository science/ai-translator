/**
 * PDF Export utility for browser-side markdown to PDF conversion.
 * Uses jsPDF for PDF generation and fontSelector for LLM-based font selection.
 */

import { jsPDF } from 'jspdf';
import { marked } from 'marked';
import { triggerDownload } from './downloadUtils';
import { selectFontForLanguage, getFontData } from './fontSelector';

export interface PdfExportOptions {
	translationDescription?: string;
	apiKey?: string;
	pageSize?: 'a4' | 'letter';
	fontSize?: number;
}

export interface PdfExportResult {
	blob: Blob;
	filename: string;
}

interface ContentBlock {
	type: 'heading' | 'paragraph' | 'code' | 'hr' | 'list-item';
	level?: number; // For headings: 1-6
	text: string;
}

const HEADING_SIZES: Record<number, number> = {
	1: 22,
	2: 18,
	3: 15,
	4: 13,
	5: 12,
	6: 11
};

const MARGINS = { top: 20, bottom: 20, left: 20, right: 20 };
const DEFAULT_FONT_SIZE = 11;

/**
 * Parse HTML string into structured content blocks.
 */
function parseHtmlToBlocks(html: string): ContentBlock[] {
	const blocks: ContentBlock[] = [];

	// Use regex to extract block-level elements from HTML
	// This is simpler than DOMParser and works in all environments
	const blockPattern =
		/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>|<p[^>]*>([\s\S]*?)<\/p>|<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>|<li[^>]*>([\s\S]*?)<\/li>|<hr\s*\/?>/g;

	let match;
	while ((match = blockPattern.exec(html)) !== null) {
		const fullMatch = match[0];

		if (fullMatch.startsWith('<h')) {
			const level = parseInt(match[1].charAt(1));
			const text = stripHtmlTags(match[2]);
			if (text.trim()) {
				blocks.push({ type: 'heading', level, text: text.trim() });
			}
		} else if (match[3] !== undefined) {
			const text = stripHtmlTags(match[3]);
			if (text.trim()) {
				blocks.push({ type: 'paragraph', text: text.trim() });
			}
		} else if (match[4] !== undefined) {
			blocks.push({ type: 'code', text: decodeHtmlEntities(match[4]) });
		} else if (match[5] !== undefined) {
			const text = stripHtmlTags(match[5]);
			if (text.trim()) {
				blocks.push({ type: 'list-item', text: `• ${text.trim()}` });
			}
		} else if (fullMatch.startsWith('<hr')) {
			blocks.push({ type: 'hr', text: '' });
		}
	}

	// If no blocks found, treat the whole text as a paragraph
	if (blocks.length === 0) {
		const text = stripHtmlTags(html).trim();
		if (text) {
			blocks.push({ type: 'paragraph', text });
		}
	}

	return blocks;
}

function stripHtmlTags(html: string): string {
	return html.replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

/**
 * Convert markdown content to a PDF blob.
 */
export async function markdownToPdf(
	markdown: string,
	options: PdfExportOptions = {}
): Promise<Blob> {
	const doc = new jsPDF({
		orientation: 'portrait',
		unit: 'mm',
		format: options.pageSize || 'a4'
	});

	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const contentWidth = pageWidth - MARGINS.left - MARGINS.right;
	const fontSize = options.fontSize || DEFAULT_FONT_SIZE;

	// Load font if needed
	if (options.translationDescription && options.apiKey) {
		const fontSelection = await selectFontForLanguage(
			options.translationDescription,
			options.apiKey
		);

		if (fontSelection.font !== 'builtin') {
			const fontData = await getFontData(fontSelection.font);
			if (fontData) {
				const fontFileName = `${fontSelection.font}.ttf`;
				// Convert ArrayBuffer to base64 string for jsPDF
				const uint8 = new Uint8Array(fontData);
				let binary = '';
				for (let i = 0; i < uint8.length; i++) {
					binary += String.fromCharCode(uint8[i]);
				}
				const base64 = btoa(binary);

				doc.addFileToVFS(fontFileName, base64);
				doc.addFont(fontFileName, fontSelection.font, 'normal');
				doc.setFont(fontSelection.font);
			}
		}
	}

	// Parse markdown to HTML then to blocks
	const html = marked.parse(markdown, { async: false }) as string;
	const blocks = parseHtmlToBlocks(html);

	let y = MARGINS.top;

	for (const block of blocks) {
		const blockFontSize =
			block.type === 'heading' && block.level
				? HEADING_SIZES[block.level] || fontSize
				: block.type === 'code'
					? fontSize - 1
					: fontSize;

		doc.setFontSize(blockFontSize);

		if (block.type === 'hr') {
			y += 5;
			if (y > pageHeight - MARGINS.bottom) {
				doc.addPage();
				y = MARGINS.top;
			}
			continue;
		}

		// Wrap text to fit content width
		const lines = doc.splitTextToSize(block.text, contentWidth);
		const lineHeight = blockFontSize * 0.4; // approximate mm per line

		// Check if we need a new page
		const blockHeight = lines.length * lineHeight;
		if (y + blockHeight > pageHeight - MARGINS.bottom) {
			doc.addPage();
			y = MARGINS.top;
		}

		// Add spacing before headings
		if (block.type === 'heading') {
			y += 3;
		}

		doc.text(lines, MARGINS.left, y);
		y += blockHeight;

		// Add spacing after blocks
		y += block.type === 'heading' ? 2 : 3;
	}

	const pdfData = doc.output('arraybuffer');
	return new Blob([pdfData], { type: 'application/pdf' });
}

/**
 * Convert markdown to PDF and trigger download in browser.
 */
export async function exportMarkdownAsPdf(
	markdown: string,
	filename: string = 'document.pdf',
	options: PdfExportOptions = {}
): Promise<PdfExportResult> {
	const blob = await markdownToPdf(markdown, options);

	// Ensure filename ends with .pdf (replace .md if present)
	let pdfFilename = filename.replace(/\.md$/i, '');
	pdfFilename = pdfFilename.endsWith('.pdf') ? pdfFilename : `${pdfFilename}.pdf`;

	triggerDownload(blob, pdfFilename);

	return { blob, filename: pdfFilename };
}

/**
 * Check if PDF export is available in this environment.
 */
export function isPdfExportAvailable(): boolean {
	return typeof jsPDF === 'function';
}
