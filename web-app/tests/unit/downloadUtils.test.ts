import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerDownload } from '$lib/services/downloadUtils';

describe('downloadUtils', () => {
	describe('triggerDownload', () => {
		let mockAnchor: {
			href: string;
			download: string;
			click: ReturnType<typeof vi.fn>;
		};
		let createObjectURLSpy: ReturnType<typeof vi.fn>;
		let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			mockAnchor = {
				href: '',
				download: '',
				click: vi.fn()
			};

			vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
			vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as unknown as Node);
			vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as unknown as Node);

			createObjectURLSpy = vi.fn().mockReturnValue('blob:http://localhost/fake-url');
			revokeObjectURLSpy = vi.fn();
			globalThis.URL.createObjectURL = createObjectURLSpy as typeof URL.createObjectURL;
			globalThis.URL.revokeObjectURL = revokeObjectURLSpy as typeof URL.revokeObjectURL;
		});

		it('creates an object URL from the blob', () => {
			const blob = new Blob(['test content'], { type: 'text/plain' });
			triggerDownload(blob, 'test.txt');

			expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
		});

		it('creates an anchor element with correct href and download attributes', () => {
			const blob = new Blob(['test content'], { type: 'text/plain' });
			triggerDownload(blob, 'my-file.md');

			expect(document.createElement).toHaveBeenCalledWith('a');
			expect(mockAnchor.href).toBe('blob:http://localhost/fake-url');
			expect(mockAnchor.download).toBe('my-file.md');
		});

		it('appends anchor to body, clicks it, then removes it', () => {
			const blob = new Blob(['test'], { type: 'text/plain' });
			triggerDownload(blob, 'file.txt');

			expect(document.body.appendChild).toHaveBeenCalled();
			expect(mockAnchor.click).toHaveBeenCalled();
			expect(document.body.removeChild).toHaveBeenCalled();
		});

		it('revokes the object URL after download', () => {
			const blob = new Blob(['test'], { type: 'text/plain' });
			triggerDownload(blob, 'file.txt');

			expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/fake-url');
		});
	});
});
