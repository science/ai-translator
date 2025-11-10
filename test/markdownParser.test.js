import { describe, test, expect } from '@jest/globals';
import { parseMarkdownStructure, extractHeaders, buildHierarchy } from '../src/markdownParser.js';

describe('Markdown Parser', () => {
  describe('extractHeaders', () => {
    test('should detect H1-H6 headers', () => {
      const content = `# Header 1
## Header 2
### Header 3
#### Header 4
##### Header 5
###### Header 6`;

      const headers = extractHeaders(content);

      expect(headers).toHaveLength(6);
      expect(headers[0]).toEqual({ level: 1, text: 'Header 1', line: 0 });
      expect(headers[1]).toEqual({ level: 2, text: 'Header 2', line: 1 });
      expect(headers[5]).toEqual({ level: 6, text: 'Header 6', line: 5 });
    });

    test('should handle headers with formatting', () => {
      const content = `## Header with **bold** and *italic*`;
      const headers = extractHeaders(content);

      expect(headers).toHaveLength(1);
      expect(headers[0].text).toBe('Header with **bold** and *italic*');
    });

    test('should ignore # in middle of line', () => {
      const content = `This is not # a header
# This is a header`;

      const headers = extractHeaders(content);

      expect(headers).toHaveLength(1);
      expect(headers[0].text).toBe('This is a header');
    });
  });

  describe('buildHierarchy', () => {
    test('should build parent-child relationships', () => {
      const headers = [
        { level: 1, text: 'Chapter 1', line: 0 },
        { level: 2, text: 'Section 1.1', line: 2 },
        { level: 2, text: 'Section 1.2', line: 5 },
        { level: 1, text: 'Chapter 2', line: 8 },
      ];

      const hierarchy = buildHierarchy(headers);

      expect(hierarchy).toHaveLength(2);
      expect(hierarchy[0].text).toBe('Chapter 1');
      expect(hierarchy[0].children).toHaveLength(2);
      expect(hierarchy[0].children[0].text).toBe('Section 1.1');
      expect(hierarchy[1].text).toBe('Chapter 2');
      expect(hierarchy[1].children).toHaveLength(0);
    });

    test('should handle nested hierarchy', () => {
      const headers = [
        { level: 1, text: 'H1', line: 0 },
        { level: 2, text: 'H2', line: 1 },
        { level: 3, text: 'H3', line: 2 },
        { level: 2, text: 'H2-2', line: 3 },
      ];

      const hierarchy = buildHierarchy(headers);

      expect(hierarchy[0].children).toHaveLength(2);
      expect(hierarchy[0].children[0].children).toHaveLength(1);
      expect(hierarchy[0].children[0].children[0].text).toBe('H3');
    });
  });

  describe('parseMarkdownStructure', () => {
    test('should identify markdown links', () => {
      const content = `This is a [link](https://example.com) and [another](./local.md).`;
      const structure = parseMarkdownStructure(content);

      expect(structure.links).toHaveLength(2);
      expect(structure.links[0]).toEqual({
        text: 'link',
        url: 'https://example.com',
        position: expect.any(Number)
      });
    });

    test('should identify bold and italic text', () => {
      const content = `**bold text** and *italic text* and ***bold italic***`;
      const structure = parseMarkdownStructure(content);

      expect(structure.formatting.bold).toHaveLength(2);
      expect(structure.formatting.italic).toHaveLength(2);
    });

    test('should identify code blocks and inline code', () => {
      const content = `Inline \`code\` here

\`\`\`javascript
const x = 1;
\`\`\``;

      const structure = parseMarkdownStructure(content);

      expect(structure.code.inline).toHaveLength(1);
      expect(structure.code.blocks).toHaveLength(1);
      expect(structure.code.blocks[0].language).toBe('javascript');
    });

    test('should identify lists', () => {
      const content = `- Item 1
- Item 2
  - Nested item
- Item 3

1. Ordered item 1
2. Ordered item 2`;

      const structure = parseMarkdownStructure(content);

      expect(structure.lists.unordered).toHaveLength(1);
      expect(structure.lists.ordered).toHaveLength(1);
    });

    test('should return complete structure with headers', () => {
      const content = `# Main Title

Some content with [link](url).

## Subsection`;

      const structure = parseMarkdownStructure(content);

      expect(structure.headers).toHaveLength(2);
      expect(structure.hierarchy).toHaveLength(1);
      expect(structure.hierarchy[0].children).toHaveLength(1);
      expect(structure.links).toHaveLength(1);
    });
  });
});
