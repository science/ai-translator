import { readMarkdownFile } from '../src/fileReader.js';
import { chunkMarkdown, chunkBySize } from '../src/chunker.js';
import { writeFile } from 'fs/promises';

const files = ['test/fixtures/simple.md', 'test/fixtures/multi-header.md'];

for (const file of files) {
  console.log('\n' + '='.repeat(60));
  console.log('Processing: ' + file);
  console.log('='.repeat(60));
  
  const content = await readMarkdownFile(file);
  const chunks = chunkMarkdown(content);
  
  console.log('\nTotal chunks: ' + chunks.length + '\n');
  
  chunks.forEach((chunk, i) => {
    console.log('--- Chunk ' + i + ' ---');
    console.log('Type: ' + chunk.type);
    console.log('Header Level: ' + (chunk.headerLevel || 'N/A'));
    console.log('Content Length: ' + chunk.content.length + ' chars');
    console.log('Content Preview: ' + chunk.content.substring(0, 100) + (chunk.content.length > 100 ? '...' : ''));
    console.log();
  });
  
  const outputFile = file.replace('.md', '-chunks.json');
  await writeFile(outputFile, JSON.stringify(chunks, null, 2));
  console.log('Saved chunks to: ' + outputFile + '\n');
}
