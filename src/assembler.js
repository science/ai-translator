import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export function assembleJapaneseOnly(chunks, outputPath) {
  const translatedContent = chunks
    .map(chunk => chunk.translation)
    .join('\n\n');

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, translatedContent, 'utf-8');
}

export function assembleBilingual(chunks, outputPath) {
  if (chunks.length === 0) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, '', 'utf-8');
    return;
  }

  const bilingualContent = chunks
    .map(chunk => {
      return `${chunk.original}\n\n---\n\n${chunk.translation}`;
    })
    .join('\n\n---\n\n');

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, bilingualContent, 'utf-8');
}

export function assembleRectified(chunks, outputPath) {
  const rectifiedContent = chunks
    .map(chunk => chunk.rectifiedContent)
    .join('\n\n');

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rectifiedContent, 'utf-8');
}
