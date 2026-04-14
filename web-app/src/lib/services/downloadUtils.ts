/**
 * Shared download utility for browser-side file downloads.
 * Used by all exporters (DOCX, EPUB, PDF).
 */

/**
 * Trigger a file download in the browser by creating a temporary anchor element.
 */
export function triggerDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
