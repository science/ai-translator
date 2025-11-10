import { readFile } from 'fs/promises';

export async function readMarkdownFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw new Error(`Error reading file: ${error.message}`);
  }
}
