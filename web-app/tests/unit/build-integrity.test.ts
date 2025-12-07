import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Build integrity tests to catch missing chunk files that cause
 * "error loading dynamically imported module" errors in production.
 *
 * These tests verify that:
 * 1. All chunk files referenced in built JS files actually exist
 * 2. Dynamic import references point to valid files
 * 3. The build output is complete and consistent
 */

const BUILD_DIR = resolve(__dirname, '../../build');
const CHUNKS_DIR = join(BUILD_DIR, '_app/immutable/chunks');

// Helper to recursively find all JS files in a directory
function findJsFiles(dir: string, files: string[] = []): string[] {
	if (!existsSync(dir)) return files;

	const entries = readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			findJsFiles(fullPath, files);
		} else if (entry.name.endsWith('.js')) {
			files.push(fullPath);
		}
	}
	return files;
}

// Helper to extract chunk references from JS content
function extractChunkReferences(content: string): string[] {
	const refs: string[] = [];

	// Match import("./SomeChunk.js") patterns
	const importRegex = /import\s*\(\s*["']\.\/([^"']+\.js)["']\s*\)/g;
	let match;
	while ((match = importRegex.exec(content)) !== null) {
		refs.push(match[1]);
	}

	// Match __vite__mapDeps arrays like: ["./Chunk1.js","./Chunk2.js"]
	const mapDepsRegex = /\["\.\/([^"]+\.js)"(?:,\s*"\.\/([^"]+\.js)")*\]/g;
	while ((match = mapDepsRegex.exec(content)) !== null) {
		// Extract all ./filename.js patterns from the array
		const arrayContent = match[0];
		const fileRegex = /"\.\/([^"]+\.js)"/g;
		let fileMatch;
		while ((fileMatch = fileRegex.exec(arrayContent)) !== null) {
			refs.push(fileMatch[1]);
		}
	}

	return [...new Set(refs)]; // Remove duplicates
}

describe('Build Integrity', () => {
	let buildExists: boolean;
	let chunkFiles: string[];
	let allJsFiles: string[];

	beforeAll(() => {
		buildExists = existsSync(BUILD_DIR);
		if (buildExists) {
			chunkFiles = existsSync(CHUNKS_DIR)
				? readdirSync(CHUNKS_DIR).filter(f => f.endsWith('.js'))
				: [];
			allJsFiles = findJsFiles(join(BUILD_DIR, '_app'));
		} else {
			chunkFiles = [];
			allJsFiles = [];
		}
	});

	it('should have a build directory', () => {
		expect(buildExists).toBe(true);
	});

	it('should have chunk files in the build', () => {
		expect(chunkFiles.length).toBeGreaterThan(0);
	});

	it('should have the large PDF.js chunk (unpdf dependency)', () => {
		// The PDF.js chunk should be one of the larger chunks (>500KB)
		const largeChunks = chunkFiles.filter(name => {
			const filePath = join(CHUNKS_DIR, name);
			const stats = statSync(filePath);
			return stats.size > 500 * 1024; // > 500KB
		});

		expect(largeChunks.length).toBeGreaterThanOrEqual(1);
	});

	it('should have all referenced chunks exist as files', () => {
		const missingChunks: { file: string; missing: string }[] = [];

		for (const jsFile of allJsFiles) {
			const content = readFileSync(jsFile, 'utf-8');
			const chunkRefs = extractChunkReferences(content);

			for (const chunkRef of chunkRefs) {
				// Chunk references are relative to the same directory
				const chunkDir = join(jsFile, '..');
				const chunkPath = join(chunkDir, chunkRef);

				if (!existsSync(chunkPath)) {
					missingChunks.push({
						file: jsFile.replace(BUILD_DIR, ''),
						missing: chunkRef
					});
				}
			}
		}

		if (missingChunks.length > 0) {
			const errorMsg = missingChunks
				.map(m => `  ${m.file} references missing chunk: ${m.missing}`)
				.join('\n');
			expect.fail(`Found ${missingChunks.length} missing chunk references:\n${errorMsg}`);
		}
	});

	it('should have pdfConverter chunk with valid dependencies', () => {
		// Find the chunk that contains pdfConverter (identified by sanitize function pattern)
		const pdfConverterChunk = allJsFiles.find(file => {
			const content = readFileSync(file, 'utf-8');
			return content.includes('PDF conversion failed') ||
			       content.includes('sanitizeControlCharacters') ||
			       content.includes('convertToMarkdown');
		});

		expect(pdfConverterChunk).toBeDefined();

		if (pdfConverterChunk) {
			const content = readFileSync(pdfConverterChunk, 'utf-8');
			const refs = extractChunkReferences(content);

			// All referenced chunks should exist
			for (const ref of refs) {
				const chunkDir = join(pdfConverterChunk, '..');
				const chunkPath = join(chunkDir, ref);
				expect(existsSync(chunkPath), `Missing chunk ${ref} referenced from pdfConverter`).toBe(true);
			}
		}
	});

	it('should have index.html with valid script references', () => {
		const indexHtml = join(BUILD_DIR, 'index.html');
		expect(existsSync(indexHtml)).toBe(true);

		const content = readFileSync(indexHtml, 'utf-8');

		// Extract all _app/* references from the HTML
		const appRefs = content.match(/_app\/[^"'\s)]+\.js/g) || [];

		for (const ref of appRefs) {
			const fullPath = join(BUILD_DIR, ref);
			expect(existsSync(fullPath), `Missing file referenced in index.html: ${ref}`).toBe(true);
		}
	});
});
