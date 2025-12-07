#!/usr/bin/env node

import { parseCliArgs } from './cli.js';
import { readMarkdownFile } from './fileReader.js';
import { readPdfFile } from './pdfReader.js';
import { chunkBySize } from './chunker.js';
import { createTranslator } from './translator.js';
import { createRectifier } from './rectifier.js';
import { createPdfConverter } from './pdfConverter.js';
import { translateDocument } from './translationEngine.js';
import { rectifyDocument } from './rectificationEngine.js';
import { assembleJapaneseOnly, assembleBilingual, assembleRectified, assemblePdfToMarkdown, getLanguageCode } from './assembler.js';
import { join, basename, extname } from 'path';

async function main() {
  try {
    const options = parseCliArgs(process.argv);

    if (options.pdfToMd) {
      console.log('PDF-to-Markdown Conversion Configuration:');
      console.log(`  Input file: ${options.inputFile}`);
      console.log(`  Output directory: ${options.outputDir}`);
      console.log();

      console.log('Reading PDF file...');
      const pdfBuffer = await readPdfFile(options.inputFile);
      console.log(`  PDF size: ${pdfBuffer.length} bytes`);

      console.log('Converting PDF to markdown...');
      const converter = await createPdfConverter();
      const markdown = await converter.convertToMarkdown(pdfBuffer);
      console.log(`  Converted to ${markdown.length} characters`);
      console.log();

      console.log('Writing output file...');
      const outputPath = assemblePdfToMarkdown(markdown, options.outputDir, options.inputFile);
      console.log(`  Saved: ${outputPath}`);

      console.log();
      console.log('✓ PDF conversion completed successfully!');
    } else if (options.rectify) {
      console.log('Rectification Configuration:');
      console.log(`  Input file: ${options.inputFile}`);
      console.log(`  Output directory: ${options.outputDir}`);
      console.log(`  Chunk size: ${options.chunkSize}`);
      console.log(`  Model: ${options.model}`);
      console.log(`  Reasoning effort: ${options.reasoningEffort}`);
      console.log();

      console.log('Reading markdown file...');
      const content = await readMarkdownFile(options.inputFile);
      console.log(`  File size: ${content.length} characters`);

      console.log('Chunking document...');
      const chunks = chunkBySize(content, options.chunkSize);
      console.log(`  Total chunks: ${chunks.length}`);
      console.log();

      console.log('Initializing rectifier...');
      const rectifier = createRectifier({
        model: options.model,
        reasoningEffort: options.reasoningEffort
      });

      console.log('Starting rectification...');
      const { rectifiedChunks } = await rectifyDocument(
        chunks,
        rectifier.rectifyChunk,
        {
          onProgress: (progress) => {
            const etaSeconds = Math.round(progress.estimatedTimeRemaining / 1000);
            console.log(
              `  Progress: ${progress.current}/${progress.total} (${progress.percentComplete}%) - ETA: ${etaSeconds}s`
            );
          }
        }
      );
      console.log('Rectification complete!');
      console.log();

      const fileBaseName = basename(options.inputFile, extname(options.inputFile));
      const rectifiedOutputPath = join(options.outputDir, `${fileBaseName}-rectified.md`);

      console.log('Assembling rectified output...');
      assembleRectified(rectifiedChunks, rectifiedOutputPath);
      console.log(`  Saved: ${rectifiedOutputPath}`);

      console.log();
      console.log('✓ Rectification completed successfully!');
    } else {
      console.log('Translation Configuration:');
      console.log(`  Input file: ${options.inputFile}`);
      console.log(`  Output directory: ${options.outputDir}`);
      console.log(`  Target language: ${options.targetLanguage}`);
      console.log(`  Chunk size: ${options.chunkSize}`);
      console.log(`  Model: ${options.model}`);
      console.log(`  Reasoning effort: ${options.reasoningEffort}`);
      console.log(`  Context-aware: ${options.contextAware}`);
      console.log();

      console.log('Reading markdown file...');
      const content = await readMarkdownFile(options.inputFile);
      console.log(`  File size: ${content.length} characters`);

      console.log('Chunking document...');
      const chunks = chunkBySize(content, options.chunkSize);
      console.log(`  Total chunks: ${chunks.length}`);
      console.log();

      console.log('Initializing translator...');
      const translator = createTranslator({
        model: options.model,
        reasoningEffort: options.reasoningEffort,
        contextAware: options.contextAware,
        targetLanguage: options.targetLanguage
      });

      console.log('Starting translation...');
      const { translatedChunks } = await translateDocument(
        chunks,
        translator.translateChunk,
        {
          onProgress: (progress) => {
            const etaSeconds = Math.round(progress.estimatedTimeRemaining / 1000);
            console.log(
              `  Progress: ${progress.current}/${progress.total} (${progress.percentComplete}%) - ETA: ${etaSeconds}s`
            );
          }
        }
      );
      console.log('Translation complete!');
      console.log();

      const transformedChunks = translatedChunks.map(chunk => ({
        ...chunk,
        original: chunk.originalContent,
        translation: chunk.translatedContent
      }));

      const fileBaseName = basename(options.inputFile, extname(options.inputFile));
      const languageCode = getLanguageCode(options.targetLanguage);
      const translatedOutputPath = join(options.outputDir, `${fileBaseName}-${languageCode}.md`);
      const bilingualOutputPath = join(options.outputDir, `${fileBaseName}-bilingual.md`);

      console.log(`Assembling ${options.targetLanguage} output...`);
      assembleJapaneseOnly(transformedChunks, translatedOutputPath);
      console.log(`  Saved: ${translatedOutputPath}`);

      console.log('Assembling bilingual output...');
      assembleBilingual(transformedChunks, bilingualOutputPath);
      console.log(`  Saved: ${bilingualOutputPath}`);

      console.log();
      console.log('✓ Translation completed successfully!');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
