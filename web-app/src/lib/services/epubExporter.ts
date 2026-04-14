/**
 * EPUB3 Export utility for browser-side markdown to EPUB conversion.
 * Uses JSZip for ZIP container and marked for markdown-to-XHTML conversion.
 * Produces Kindle-compatible EPUB3 (reflowable, no DRM).
 */

import JSZip from 'jszip';
import { marked } from 'marked';
import { triggerDownload } from './downloadUtils';

export interface EpubMetadata {
	title?: string;
	author?: string;
	language?: string;
}

export interface EpubExportResult {
	blob: Blob;
	filename: string;
}

/**
 * Convert markdown to XHTML suitable for EPUB3.
 * Ensures self-closing tags are XHTML-compliant.
 */
function markdownToXhtml(markdown: string): string {
	const html = marked.parse(markdown, { async: false }) as string;
	// Fix self-closing tags for XHTML compliance
	return html
		.replace(/<br\s*>/g, '<br />')
		.replace(/<hr\s*>/g, '<hr />')
		.replace(/<img([^>]*?)(?<!\/)>/g, '<img$1 />');
}

/**
 * Extract headings from markdown for table of contents.
 */
function extractHeadings(markdown: string): Array<{ level: number; text: string; id: string }> {
	const headings: Array<{ level: number; text: string; id: string }> = [];
	const idCounts = new Map<string, number>();
	const lines = markdown.split('\n');
	for (const line of lines) {
		const match = line.match(/^(#{1,6})\s+(.+)$/);
		if (match) {
			const level = match[1].length;
			const text = match[2].trim();
			let baseId = text
				.toLowerCase()
				.replace(/[^\w\s-]/g, '')
				.replace(/\s+/g, '-')
				.replace(/^-+|-+$/g, '');

			if (!baseId) {
				baseId = 'heading';
			}

			const count = idCounts.get(baseId) || 0;
			idCounts.set(baseId, count + 1);
			const id = count === 0 ? baseId : `${baseId}-${count + 1}`;

			headings.push({ level, text, id });
		}
	}
	return headings;
}

/**
 * Generate the EPUB3 content.opf (package document).
 */
function generateOpf(metadata: EpubMetadata): string {
	const title = metadata.title || 'Untitled';
	const language = metadata.language || 'en';
	const author = metadata.author || 'Unknown';
	const uuid = generateUUID();

	return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>${escapeXml(language)}</dc:language>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
    <meta property="rendition:layout">reflowable</meta>
    <meta property="rendition:flow">auto</meta>
  </metadata>
  <manifest>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml" />
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="style" href="style.css" media-type="text/css" />
  </manifest>
  <spine>
    <itemref idref="content" />
  </spine>
</package>`;
}

/**
 * Generate the EPUB3 navigation document (toc.xhtml).
 */
function generateNav(headings: Array<{ level: number; text: string; id: string }>): string {
	let tocItems = '';
	for (const heading of headings) {
		tocItems += `      <li><a href="content.xhtml#${heading.id}">${escapeXml(heading.text)}</a></li>\n`;
	}

	if (!tocItems) {
		tocItems = '      <li><a href="content.xhtml">Start</a></li>\n';
	}

	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${tocItems}    </ol>
  </nav>
</body>
</html>`;
}

/**
 * Generate the main content XHTML document.
 */
function generateContent(
	xhtml: string,
	headings: Array<{ level: number; text: string; id: string }>
): string {
	// Find all heading tags in the XHTML by position, then pair 1:1 with
	// the headings array (both are in document order). This avoids matching
	// by text content, which breaks when marked HTML-escapes characters
	// (e.g. & becomes &amp;).
	let processedXhtml = xhtml;
	const headingPositions: Array<{ index: number; fullMatch: string; tag: string }> = [];

	for (let level = 1; level <= 6; level++) {
		const tag = `h${level}`;
		const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi');
		let match;
		while ((match = regex.exec(processedXhtml)) !== null) {
			headingPositions.push({ index: match.index, fullMatch: match[0], tag });
		}
	}

	headingPositions.sort((a, b) => a.index - b.index);

	// Replace in reverse order to preserve string indices
	for (let i = headingPositions.length - 1; i >= 0; i--) {
		if (i < headings.length) {
			const pos = headingPositions[i];
			const heading = headings[i];
			const replacement = pos.fullMatch.replace(`<${pos.tag}>`, `<${pos.tag} id="${heading.id}">`);
			processedXhtml =
				processedXhtml.slice(0, pos.index) +
				replacement +
				processedXhtml.slice(pos.index + pos.fullMatch.length);
		}
	}

	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Content</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
${processedXhtml}
</body>
</html>`;
}

/**
 * Minimal CSS for readable EPUB formatting.
 */
const EPUB_STYLE = `body {
  font-family: serif;
  line-height: 1.6;
  margin: 1em;
}
h1, h2, h3, h4, h5, h6 {
  font-family: sans-serif;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}
h1 { font-size: 1.8em; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.3em; }
h4 { font-size: 1.1em; }
p { margin: 0.8em 0; }
hr { border: none; border-top: 1px solid #ccc; margin: 2em 0; }
code { font-family: monospace; background: #f5f5f5; padding: 0.2em 0.4em; }
pre { background: #f5f5f5; padding: 1em; overflow-x: auto; }
blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #555; }
`;

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`;

/**
 * Generate a UUID v4. Falls back to crypto.getRandomValues when
 * crypto.randomUUID is unavailable (non-secure HTTP contexts).
 */
function generateUUID(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Convert markdown content to an EPUB3 blob.
 */
export async function markdownToEpub(
	markdown: string,
	metadata: EpubMetadata = {}
): Promise<Blob> {
	const zip = new JSZip();

	// mimetype must be first entry, uncompressed
	zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

	// META-INF
	zip.file('META-INF/container.xml', CONTAINER_XML);

	// Extract headings for TOC
	const headings = extractHeadings(markdown);

	// Convert markdown to XHTML
	const xhtml = markdownToXhtml(markdown);

	// OEBPS contents
	zip.file('OEBPS/content.opf', generateOpf(metadata));
	zip.file('OEBPS/toc.xhtml', generateNav(headings));
	zip.file('OEBPS/content.xhtml', generateContent(xhtml, headings));
	zip.file('OEBPS/style.css', EPUB_STYLE);

	return await zip.generateAsync({
		type: 'blob',
		mimeType: 'application/epub+zip'
	});
}

/**
 * Convert markdown to EPUB3 and trigger download in browser.
 */
export async function exportMarkdownAsEpub(
	markdown: string,
	filename: string = 'document.epub',
	metadata: EpubMetadata = {}
): Promise<EpubExportResult> {
	const blob = await markdownToEpub(markdown, metadata);

	// Ensure filename ends with .epub (replace .md if present)
	let epubFilename = filename.replace(/\.md$/i, '');
	epubFilename = epubFilename.endsWith('.epub') ? epubFilename : `${epubFilename}.epub`;

	triggerDownload(blob, epubFilename);

	return { blob, filename: epubFilename };
}

/**
 * Check if EPUB export is available in this environment.
 */
export function isEpubExportAvailable(): boolean {
	return typeof JSZip === 'function';
}
