import { readFile } from 'fs/promises';

export async function readPdfFile(filePath) {
  try {
    const buffer = await readFile(filePath);
    return buffer;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw new Error(`Error reading PDF file: ${error.message}`);
  }
}
