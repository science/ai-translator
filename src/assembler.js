import { writeFileSync, mkdirSync } from 'fs';
import { dirname, basename, join } from 'path';

// Language code mapping for common languages
const LANGUAGE_CODES = {
  japanese: 'ja',
  german: 'de',
  french: 'fr',
  spanish: 'es',
  italian: 'it',
  portuguese: 'pt',
  chinese: 'zh',
  korean: 'ko',
  russian: 'ru',
  arabic: 'ar',
  dutch: 'nl',
  swedish: 'sv',
  norwegian: 'no',
  danish: 'da',
  finnish: 'fi',
  polish: 'pl',
  turkish: 'tr',
  hindi: 'hi',
  thai: 'th',
  vietnamese: 'vi',
  indonesian: 'id',
  greek: 'el',
  hebrew: 'he',
  czech: 'cs',
  hungarian: 'hu',
  ukrainian: 'uk'
};

/**
 * Extracts language code from a target language string.
 * Handles both simple language names ("Japanese") and style-qualified descriptions
 * ("business casual German", "formal French").
 * Returns "translated" for unknown languages.
 */
export function getLanguageCode(targetLanguage) {
  if (!targetLanguage) {
    return 'translated';
  }

  const lowerTarget = targetLanguage.toLowerCase();

  // First, check for exact matches
  if (LANGUAGE_CODES[lowerTarget]) {
    return LANGUAGE_CODES[lowerTarget];
  }

  // Look for a known language name anywhere in the string
  for (const [language, code] of Object.entries(LANGUAGE_CODES)) {
    if (lowerTarget.includes(language)) {
      return code;
    }
  }

  return 'translated';
}

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

export function assemblePdfToMarkdown(markdownContent, outputDir, inputFilePath) {
  const inputBasename = basename(inputFilePath, '.pdf');
  const outputFilename = `${inputBasename}.md`;
  const outputPath = join(outputDir, outputFilename);

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, markdownContent, 'utf-8');

  return outputPath;
}
