import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock JSZip before importing the module under test
const mockFile = vi.fn();
const mockGenerateAsync = vi.fn();
const mockJSZipInstance = {
	file: mockFile,
	generateAsync: mockGenerateAsync
};

function MockJSZip() {
	return mockJSZipInstance;
}
vi.mock('jszip', () => ({
	default: MockJSZip
}));

// Mock downloadUtils
vi.mock('$lib/services/downloadUtils', () => ({
	triggerDownload: vi.fn()
}));

import { markdownToEpub, exportMarkdownAsEpub, isEpubExportAvailable } from '$lib/services/epubExporter';
import { triggerDownload } from '$lib/services/downloadUtils';

describe('epubExporter', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGenerateAsync.mockResolvedValue(new Blob(['fake-epub'], { type: 'application/epub+zip' }));
	});

	describe('markdownToEpub', () => {
		it('returns a Blob', async () => {
			const result = await markdownToEpub('# Test\n\nContent');
			expect(result).toBeInstanceOf(Blob);
		});

		it('generates a ZIP with application/epub+zip type', async () => {
			await markdownToEpub('# Test');
			expect(mockGenerateAsync).toHaveBeenCalledWith({
				type: 'blob',
				mimeType: 'application/epub+zip'
			});
		});

		it('includes mimetype file as first entry with STORE compression', async () => {
			await markdownToEpub('# Test');

			const mimetypeCall = mockFile.mock.calls.find(
				(call: unknown[]) => call[0] === 'mimetype'
			);
			expect(mimetypeCall).toBeDefined();
			expect(mimetypeCall![1]).toBe('application/epub+zip');
			expect(mimetypeCall![2]).toEqual({ compression: 'STORE' });
		});

		it('includes META-INF/container.xml', async () => {
			await markdownToEpub('# Test');

			const containerCall = mockFile.mock.calls.find(
				(call: unknown[]) => call[0] === 'META-INF/container.xml'
			);
			expect(containerCall).toBeDefined();
			expect(containerCall![1]).toContain('rootfile');
			expect(containerCall![1]).toContain('OEBPS/content.opf');
		});

		it('includes OEBPS/content.opf with package manifest', async () => {
			await markdownToEpub('# Test');

			const opfCall = mockFile.mock.calls.find(
				(call: unknown[]) => call[0] === 'OEBPS/content.opf'
			);
			expect(opfCall).toBeDefined();
			expect(opfCall![1]).toContain('<package');
			expect(opfCall![1]).toContain('version="3.0"');
			expect(opfCall![1]).toContain('<spine');
		});

		it('includes OEBPS/content.xhtml with converted markdown', async () => {
			await markdownToEpub('# Hello World\n\nSome paragraph.');

			const contentCall = mockFile.mock.calls.find(
				(call: unknown[]) => call[0] === 'OEBPS/content.xhtml'
			);
			expect(contentCall).toBeDefined();
			expect(contentCall![1]).toContain('Hello World');
			expect(contentCall![1]).toContain('Some paragraph');
			expect(contentCall![1]).toContain('xmlns="http://www.w3.org/1999/xhtml"');
		});

		it('includes OEBPS/toc.xhtml navigation document', async () => {
			await markdownToEpub('# Chapter 1\n\nText\n\n## Section A');

			const tocCall = mockFile.mock.calls.find(
				(call: unknown[]) => call[0] === 'OEBPS/toc.xhtml'
			);
			expect(tocCall).toBeDefined();
			expect(tocCall![1]).toContain('epub:type="toc"');
			expect(tocCall![1]).toContain('Chapter 1');
		});

		it('includes OEBPS/style.css', async () => {
			await markdownToEpub('# Test');

			const cssCall = mockFile.mock.calls.find(
				(call: unknown[]) => call[0] === 'OEBPS/style.css'
			);
			expect(cssCall).toBeDefined();
		});

		it('sets Kindle-compatible rendition metadata in OPF', async () => {
			await markdownToEpub('# Test');

			const opfCall = mockFile.mock.calls.find(
				(call: unknown[]) => call[0] === 'OEBPS/content.opf'
			);
			expect(opfCall![1]).toContain('rendition:layout');
			expect(opfCall![1]).toContain('reflowable');
		});

		it('sets metadata title from options', async () => {
			await markdownToEpub('# Test', { title: 'My Book' });

			const opfCall = mockFile.mock.calls.find(
				(call: unknown[]) => call[0] === 'OEBPS/content.opf'
			);
			expect(opfCall![1]).toContain('My Book');
		});

		it('sets metadata language from options', async () => {
			await markdownToEpub('# Test', { language: 'ja' });

			const opfCall = mockFile.mock.calls.find(
				(call: unknown[]) => call[0] === 'OEBPS/content.opf'
			);
			expect(opfCall![1]).toContain('<dc:language>ja</dc:language>');
		});

		it('preserves Japanese content in XHTML', async () => {
			await markdownToEpub('# 日本語テスト\n\nこれはテストです。');

			const contentCall = mockFile.mock.calls.find(
				(call: unknown[]) => call[0] === 'OEBPS/content.xhtml'
			);
			expect(contentCall![1]).toContain('日本語テスト');
			expect(contentCall![1]).toContain('これはテストです');
		});
	});

	describe('exportMarkdownAsEpub', () => {
		it('triggers download with .epub extension', async () => {
			await exportMarkdownAsEpub('# Test', 'my-book.epub');

			expect(triggerDownload).toHaveBeenCalledWith(
				expect.any(Blob),
				'my-book.epub'
			);
		});

		it('appends .epub if not present', async () => {
			await exportMarkdownAsEpub('# Test', 'my-book');

			expect(triggerDownload).toHaveBeenCalledWith(
				expect.any(Blob),
				'my-book.epub'
			);
		});

		it('replaces .md extension with .epub', async () => {
			await exportMarkdownAsEpub('# Test', 'my-book.md');

			expect(triggerDownload).toHaveBeenCalledWith(
				expect.any(Blob),
				'my-book.epub'
			);
		});

		it('returns blob and filename', async () => {
			const result = await exportMarkdownAsEpub('# Test', 'book.epub');

			expect(result).toHaveProperty('blob');
			expect(result).toHaveProperty('filename', 'book.epub');
			expect(result.blob).toBeInstanceOf(Blob);
		});
	});

	describe('isEpubExportAvailable', () => {
		it('returns true when JSZip is available', () => {
			expect(isEpubExportAvailable()).toBe(true);
		});
	});
});
