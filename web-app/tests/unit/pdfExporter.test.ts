import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jsPDF
const mockText = vi.fn().mockReturnThis();
const mockSetFontSize = vi.fn().mockReturnThis();
const mockSetFont = vi.fn().mockReturnThis();
const mockAddPage = vi.fn().mockReturnThis();
const mockAddFileToVFS = vi.fn().mockReturnThis();
const mockAddFont = vi.fn().mockReturnThis();
const mockSplitTextToSize = vi.fn().mockImplementation((text: string) => [text]);
const mockOutput = vi.fn().mockReturnValue('fake-pdf-data');
const mockGetTextDimensions = vi.fn().mockReturnValue({ w: 100, h: 10 });

const mockJsPdfInstance = {
	text: mockText,
	setFontSize: mockSetFontSize,
	setFont: mockSetFont,
	addPage: mockAddPage,
	addFileToVFS: mockAddFileToVFS,
	addFont: mockAddFont,
	splitTextToSize: mockSplitTextToSize,
	output: mockOutput,
	getTextDimensions: mockGetTextDimensions,
	internal: {
		pageSize: { getWidth: () => 210, getHeight: () => 297 }
	}
};

function MockJsPDF() {
	return mockJsPdfInstance;
}
vi.mock('jspdf', () => ({
	jsPDF: MockJsPDF
}));

// Mock fontSelector
vi.mock('$lib/services/fontSelector', () => ({
	selectFontForLanguage: vi.fn().mockResolvedValue({ font: 'builtin', reason: 'Latin' }),
	getFontData: vi.fn().mockResolvedValue(null),
	clearFontCaches: vi.fn()
}));

// Mock downloadUtils
vi.mock('$lib/services/downloadUtils', () => ({
	triggerDownload: vi.fn()
}));

import { markdownToPdf, exportMarkdownAsPdf, isPdfExportAvailable } from '$lib/services/pdfExporter';
import { triggerDownload } from '$lib/services/downloadUtils';
import { selectFontForLanguage, getFontData } from '$lib/services/fontSelector';

describe('pdfExporter', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSplitTextToSize.mockImplementation((text: string) => [text]);
		mockOutput.mockReturnValue('fake-pdf-data');
		mockGetTextDimensions.mockReturnValue({ w: 100, h: 10 });
		(selectFontForLanguage as ReturnType<typeof vi.fn>).mockResolvedValue({ font: 'builtin', reason: 'Latin' });
		(getFontData as ReturnType<typeof vi.fn>).mockResolvedValue(null);
	});

	describe('markdownToPdf', () => {
		it('returns a Blob with PDF mime type', async () => {
			const result = await markdownToPdf('# Test\n\nContent');
			expect(result).toBeInstanceOf(Blob);
			expect(result.type).toBe('application/pdf');
		});

		it('calls jsPDF text methods with parsed markdown content', async () => {
			await markdownToPdf('# Heading\n\nA paragraph of text.');
			expect(mockText).toHaveBeenCalled();
		});

		it('sets heading font sizes larger than body text', async () => {
			await markdownToPdf('# Big Heading\n\nBody text.');

			const fontSizeCalls = mockSetFontSize.mock.calls.map((c: number[]) => c[0]);
			// Should include both heading size and body size
			expect(fontSizeCalls.length).toBeGreaterThanOrEqual(2);
			// Heading should be larger than body
			const maxSize = Math.max(...fontSizeCalls);
			expect(maxSize).toBeGreaterThanOrEqual(18); // h1 should be at least 18pt
		});

		it('uses builtin Helvetica when font selector returns builtin', async () => {
			(selectFontForLanguage as ReturnType<typeof vi.fn>).mockResolvedValue({ font: 'builtin', reason: 'Latin' });

			await markdownToPdf('# Test', { translationDescription: 'English', apiKey: 'key' });

			expect(mockAddFileToVFS).not.toHaveBeenCalled();
			expect(mockAddFont).not.toHaveBeenCalled();
		});

		it('loads and registers font when font selector returns non-builtin', async () => {
			const fakeFontData = new ArrayBuffer(100);
			(selectFontForLanguage as ReturnType<typeof vi.fn>).mockResolvedValue({ font: 'NotoSansJP', reason: 'Japanese' });
			(getFontData as ReturnType<typeof vi.fn>).mockResolvedValue(fakeFontData);

			await markdownToPdf('# テスト', { translationDescription: 'Japanese', apiKey: 'key' });

			expect(mockAddFileToVFS).toHaveBeenCalled();
			expect(mockAddFont).toHaveBeenCalled();
			expect(mockSetFont).toHaveBeenCalled();
		});
	});

	describe('exportMarkdownAsPdf', () => {
		it('triggers download with .pdf extension', async () => {
			await exportMarkdownAsPdf('# Test', 'my-doc.pdf');

			expect(triggerDownload).toHaveBeenCalledWith(
				expect.any(Blob),
				'my-doc.pdf'
			);
		});

		it('appends .pdf if not present', async () => {
			await exportMarkdownAsPdf('# Test', 'my-doc');

			expect(triggerDownload).toHaveBeenCalledWith(
				expect.any(Blob),
				'my-doc.pdf'
			);
		});

		it('replaces .md extension with .pdf', async () => {
			await exportMarkdownAsPdf('# Test', 'my-doc.md');

			expect(triggerDownload).toHaveBeenCalledWith(
				expect.any(Blob),
				'my-doc.pdf'
			);
		});

		it('returns blob and filename', async () => {
			const result = await exportMarkdownAsPdf('# Test', 'doc.pdf');

			expect(result).toHaveProperty('blob');
			expect(result).toHaveProperty('filename', 'doc.pdf');
			expect(result.blob).toBeInstanceOf(Blob);
		});
	});

	describe('isPdfExportAvailable', () => {
		it('returns true when jsPDF is available', () => {
			expect(isPdfExportAvailable()).toBe(true);
		});
	});
});
