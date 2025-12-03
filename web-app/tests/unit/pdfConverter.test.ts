import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPdfConverter } from '$lib/services/pdfConverter';

// Mock the pdf2md module
vi.mock('@opendocsg/pdf2md', () => ({
	default: vi.fn()
}));

describe('pdfConverter service', () => {
	let mockPdf2md: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		// Get the mocked module
		const pdf2mdModule = await import('@opendocsg/pdf2md');
		mockPdf2md = pdf2mdModule.default as ReturnType<typeof vi.fn>;
		mockPdf2md.mockReset();
	});

	describe('createPdfConverter', () => {
		it('should create a converter with convertToMarkdown function', async () => {
			const converter = await createPdfConverter();
			expect(converter.convertToMarkdown).toBeInstanceOf(Function);
		});
	});

	describe('convertToMarkdown', () => {
		it('should convert PDF buffer to markdown', async () => {
			mockPdf2md.mockResolvedValue('# Hello World\n\nThis is a test.');

			const converter = await createPdfConverter();
			const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
			const result = await converter.convertToMarkdown(pdfBuffer);

			expect(result).toBe('# Hello World\n\nThis is a test.');
			expect(mockPdf2md).toHaveBeenCalledWith(pdfBuffer);
		});

		it('should accept ArrayBuffer as input', async () => {
			mockPdf2md.mockResolvedValue('Test markdown');

			const converter = await createPdfConverter();
			const arrayBuffer = new ArrayBuffer(4);
			const result = await converter.convertToMarkdown(arrayBuffer);

			expect(result).toBe('Test markdown');
		});

		it('should sanitize control characters by default', async () => {
			// Form feed (12) should be converted to double newline
			const textWithFormFeed = 'Page 1\x0cPage 2';
			mockPdf2md.mockResolvedValue(textWithFormFeed);

			const converter = await createPdfConverter();
			const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const result = await converter.convertToMarkdown(pdfBuffer);

			expect(result).toBe('Page 1\n\nPage 2');
		});

		it('should remove other control characters', async () => {
			// Bell (7), backspace (8), vertical tab (11), etc.
			const textWithControlChars = 'Hello\x07World\x08Test\x0B';
			mockPdf2md.mockResolvedValue(textWithControlChars);

			const converter = await createPdfConverter();
			const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const result = await converter.convertToMarkdown(pdfBuffer);

			expect(result).toBe('HelloWorldTest');
		});

		it('should preserve tabs, line feeds, and carriage returns', async () => {
			const textWithWhitespace = 'Line1\tTabbed\nLine2\rReturn';
			mockPdf2md.mockResolvedValue(textWithWhitespace);

			const converter = await createPdfConverter();
			const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const result = await converter.convertToMarkdown(pdfBuffer);

			expect(result).toBe('Line1\tTabbed\nLine2\rReturn');
		});

		it('should skip sanitization when sanitize option is false', async () => {
			const textWithFormFeed = 'Page 1\x0cPage 2';
			mockPdf2md.mockResolvedValue(textWithFormFeed);

			const converter = await createPdfConverter({ sanitize: false });
			const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const result = await converter.convertToMarkdown(pdfBuffer);

			expect(result).toBe('Page 1\x0cPage 2');
		});

		it('should throw error when conversion fails', async () => {
			mockPdf2md.mockRejectedValue(new Error('Invalid PDF format'));

			const converter = await createPdfConverter();
			const pdfBuffer = new Uint8Array([0, 0, 0, 0]);

			await expect(converter.convertToMarkdown(pdfBuffer)).rejects.toThrow(
				'PDF conversion failed: Invalid PDF format'
			);
		});

		it('should handle empty result', async () => {
			mockPdf2md.mockResolvedValue('');

			const converter = await createPdfConverter();
			const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const result = await converter.convertToMarkdown(pdfBuffer);

			expect(result).toBe('');
		});
	});
});
