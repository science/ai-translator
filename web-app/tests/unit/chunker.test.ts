import { describe, it, expect } from 'vitest';
import { chunkMarkdown, chunkBySize, type Chunk } from '$lib/services/chunker';

describe('chunker', () => {
	describe('chunkMarkdown', () => {
		it('should return empty array for empty content', () => {
			const chunks = chunkMarkdown('');
			expect(chunks).toEqual([]);
		});

		it('should chunk content without headers as preamble', () => {
			const content = 'This is just some text.\n\nWith multiple paragraphs.';
			const chunks = chunkMarkdown(content);

			expect(chunks.length).toBe(1);
			expect(chunks[0].type).toBe('preamble');
			expect(chunks[0].headerLevel).toBeNull();
			expect(chunks[0].index).toBe(0);
		});

		it('should chunk simple markdown with one header', () => {
			const content = '# Chapter 1\n\nThis is the first chapter.';
			const chunks = chunkMarkdown(content);

			expect(chunks.length).toBe(1);
			expect(chunks[0].type).toBe('header-section');
			expect(chunks[0].headerLevel).toBe(1);
			expect(chunks[0].content).toContain('# Chapter 1');
			expect(chunks[0].content).toContain('This is the first chapter.');
		});

		it('should split on multiple headers', () => {
			const content = `# Chapter 1

First chapter content.

## Section 1.1

Section content.

# Chapter 2

Second chapter content.`;

			const chunks = chunkMarkdown(content);

			expect(chunks.length).toBe(3);
			expect(chunks[0].headerLevel).toBe(1);
			expect(chunks[0].content).toContain('# Chapter 1');
			expect(chunks[1].headerLevel).toBe(2);
			expect(chunks[1].content).toContain('## Section 1.1');
			expect(chunks[2].headerLevel).toBe(1);
			expect(chunks[2].content).toContain('# Chapter 2');
		});

		it('should preserve header levels correctly', () => {
			const content = `# H1

Content

## H2

Content

### H3

Content

#### H4

Content`;

			const chunks = chunkMarkdown(content);

			expect(chunks[0].headerLevel).toBe(1);
			expect(chunks[1].headerLevel).toBe(2);
			expect(chunks[2].headerLevel).toBe(3);
			expect(chunks[3].headerLevel).toBe(4);
		});

		it('should assign sequential indexes', () => {
			const content = `# One

Text

# Two

Text

# Three

Text`;

			const chunks = chunkMarkdown(content);

			expect(chunks.length).toBe(3);
			chunks.forEach((chunk, i) => {
				expect(chunk.index).toBe(i);
			});
		});

		it('should handle preamble before first header', () => {
			const content = `This is preamble text.

More preamble.

# Chapter 1

Chapter content.`;

			const chunks = chunkMarkdown(content);

			expect(chunks.length).toBe(2);
			expect(chunks[0].type).toBe('preamble');
			expect(chunks[0].headerLevel).toBeNull();
			expect(chunks[1].type).toBe('header-section');
			expect(chunks[1].headerLevel).toBe(1);
		});

		it('should include header in chunk content', () => {
			const content = `# My Header

Body text here.`;

			const chunks = chunkMarkdown(content);

			expect(chunks[0].content).toBe('# My Header\n\nBody text here.');
		});
	});

	describe('chunkBySize', () => {
		it('should not split small chunks', () => {
			const content = '# Chapter 1\n\nShort content.';
			const chunks = chunkBySize(content, 4000);

			expect(chunks.length).toBe(1);
			expect(chunks[0].content).toContain('# Chapter 1');
		});

		it('should split large chunks by paragraphs', () => {
			const content = `# Chapter 1

This is paragraph one with some text.

This is paragraph two with some text.

This is paragraph three with some text.`;

			const chunks = chunkBySize(content, 50);

			expect(chunks.length).toBeGreaterThan(1);
			chunks.forEach((chunk) => {
				// Each chunk should be reasonably sized (allowing for paragraph boundaries)
				expect(chunk.content.length).toBeLessThanOrEqual(150);
			});
		});

		it('should preserve metadata when splitting', () => {
			const content = `# Chapter 1

Para 1.

Para 2.

Para 3.`;

			const chunks = chunkBySize(content, 20);

			chunks.forEach((chunk) => {
				expect(chunk).toHaveProperty('index');
				expect(chunk).toHaveProperty('type');
				expect(chunk).toHaveProperty('content');
				expect(chunk).toHaveProperty('headerLevel');
			});
		});

		it('should mark split chunks as paragraph-section', () => {
			const content = `# Chapter 1

Para 1.

Para 2.

Para 3.`;

			const chunks = chunkBySize(content, 20);

			// If chunks were split, they should be paragraph-section type
			if (chunks.length > 1) {
				chunks.forEach((chunk) => {
					expect(chunk.type).toBe('paragraph-section');
				});
			}
		});

		it('should assign sequential indexes after splitting', () => {
			const content = `# One

Long paragraph 1.

Long paragraph 2.

# Two

Long paragraph 3.`;

			const chunks = chunkBySize(content, 30);

			chunks.forEach((chunk, i) => {
				expect(chunk.index).toBe(i);
			});
		});

		it('should use default maxChunkSize of 4000', () => {
			const content = '# Test\n\nShort.';
			const chunks = chunkBySize(content);

			expect(chunks.length).toBe(1);
		});
	});
});
