export async function createPdfConverter(options = {}) {
  const { default: pdf2md } = await import('@opendocsg/pdf2md');

  const convertToMarkdown = async (pdfBuffer) => {
    try {
      const markdown = await pdf2md(pdfBuffer);
      return markdown;
    } catch (error) {
      throw new Error(`PDF conversion failed: ${error.message}`);
    }
  };

  return { convertToMarkdown };
}
