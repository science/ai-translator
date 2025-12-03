/**
 * Sanitize text by removing control characters that can cause JSON parsing issues.
 * Keeps: tab (9), line feed (10), carriage return (13)
 * Converts: form feed (12) to double newline (page break)
 * Removes: all other control characters (0-8, 11, 14-31, 127)
 */
export function sanitizeControlCharacters(text) {
  if (typeof text !== 'string') {
    return text;
  }

  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 12) {
      // Form feed -> double newline (page break)
      result += '\n\n';
    } else if (code === 9 || code === 10 || code === 13) {
      // Keep tab, LF, CR
      result += text[i];
    } else if (code < 32 || code === 127) {
      // Remove other control characters
      continue;
    } else {
      result += text[i];
    }
  }
  return result;
}

export async function createPdfConverter(options = {}) {
  const { default: pdf2md } = await import('@opendocsg/pdf2md');

  const convertToMarkdown = async (pdfBuffer) => {
    try {
      const markdown = await pdf2md(pdfBuffer);
      // Sanitize the output to remove control characters that can cause JSON issues
      return sanitizeControlCharacters(markdown);
    } catch (error) {
      throw new Error(`PDF conversion failed: ${error.message}`);
    }
  };

  return { convertToMarkdown };
}
