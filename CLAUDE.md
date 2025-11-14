# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js CLI tool for translating markdown books to Japanese using the OpenAI GPT API. The project is **fully implemented** and production-ready. It splits markdown files into chunks (preserving document structure), translates them via OpenAI, and outputs both Japanese-only and bilingual (alternating EN/JP) versions.

**NEW: Rectification Mode** - The tool now includes English-to-English document rectification to fix OCR errors and PDF conversion artifacts before translation. This uses the same chunking and processing architecture as translation but with a specialized system prompt for cleaning up broken text.

## Commands

### Running the CLI
```bash
node src/index.js <input-file> [options]
```

**Options:**
- `--rectify`: Enable rectification mode (English-to-English cleanup)
- `--output-dir <path>`: Output directory (default: `output/`)
- `--chunk-size <number>`: Max chunk size in characters (default: `4000`)
- `--model <model-name>`: OpenAI model (default: `gpt-5-mini`)
- `--reasoning-effort <low|medium|high>`: GPT-5 reasoning effort (default: `medium`)

**Translation Example:**
```bash
node src/index.js book.md --model gpt-4o --chunk-size 3000
```

**Rectification Example:**
```bash
node src/index.js broken-book.md --rectify --output-dir cleaned/
```

**Common Workflow:**
```bash
# Step 1: Rectify broken PDF-to-markdown conversion
node src/index.js broken.md --rectify --output-dir cleaned/

# Step 2: Translate the cleaned version
node src/index.js cleaned/broken-rectified.md --output-dir translated/
```

### Testing
```bash
npm test
```
Runs Jest tests using experimental VM modules (required for ES modules).

### Development Scripts
```bash
node scripts/inspectChunks.js
```
Processes test fixtures and outputs chunk analysis to JSON files for debugging.

## Architecture

### Module Structure

The codebase uses **ES modules** (`"type": "module"` in package.json). All imports must use `.js` extensions.

**Key modules:**
- `src/index.js`: CLI entry point, orchestrates entire pipeline (handles both translation and rectification modes)
- `src/cli.js`: Parses command-line arguments (includes `--rectify` flag)
- `src/fileReader.js`: Reads markdown files, handles file errors
- `src/chunker.js`: Splits markdown into chunks by headers/paragraphs (shared by both modes)
  - `chunkBySize()`: Main chunking function, accepts content and maxChunkSize
  - Returns chunks with metadata: `{index, type, headerLevel, content}`
- `src/translator.js`: OpenAI API wrapper for translation
  - `createTranslator(options)`: Factory function returning `{client, translateChunk}`
  - Handles retry logic with exponential backoff for retryable errors (429, 500, 502, 503, 504)
  - GPT-5 models require `verbosity` and `reasoning_effort` parameters
- `src/translationEngine.js`: Orchestrates translation loop
  - `translateDocument(chunks, translateChunkFn, options)`: Sequential processing with progress tracking
- `src/rectifier.js`: OpenAI API wrapper for rectification (NEW)
  - `createRectifier(options)`: Factory function returning `{client, rectifyChunk}`
  - Same retry logic and error handling as translator
  - Specialized system prompt for fixing OCR errors and PDF artifacts
- `src/rectificationEngine.js`: Orchestrates rectification loop (NEW)
  - `rectifyDocument(chunks, rectifyChunkFn, options)`: Sequential processing with progress tracking
  - Parallel structure to translationEngine for consistency
- `src/cache.js`: Translation cache system (currently unused but implemented)
  - `TranslationCache` class with `load()`, `set()`, `get()`, `save()` methods
- `src/assembler.js`: Generates output files (supports both modes)
  - `assembleJapaneseOnly()`: Creates Japanese-only markdown
  - `assembleBilingual()`: Creates alternating EN/JP with `---` separators
  - `assembleRectified()`: Creates cleaned English markdown (NEW)

### Translation Pipeline

The main flow in `src/index.js` (translation mode):
1. Parse CLI args (`parseCliArgs`)
2. Read markdown file (`readMarkdownFile`)
3. Chunk document (`chunkBySize`)
4. Create translator (`createTranslator`)
5. Translate all chunks (`translateDocument`)
6. Assemble outputs (`assembleJapaneseOnly`, `assembleBilingual`)

### Rectification Pipeline (NEW)

The main flow in `src/index.js` (rectification mode, enabled with `--rectify` flag):
1. Parse CLI args (`parseCliArgs`) - detects `--rectify` flag
2. Read markdown file (`readMarkdownFile`)
3. Chunk document (`chunkBySize`) - same chunking logic
4. Create rectifier (`createRectifier`)
5. Rectify all chunks (`rectifyDocument`)
6. Assemble output (`assembleRectified`)

### Chunking Strategy

The chunker preserves document hierarchy:
1. Primary splitting at header boundaries (H1-H6 via regex `/^(#{1,6})\s+(.+)$/`)
2. Headers are **included** in chunk content
3. Large chunks are sub-divided by paragraph breaks (`\n\n+`)
4. Each chunk tracks: type (`'header-section'`, `'paragraph-section'`, `'preamble'`), headerLevel, index

### Translation System Prompt

The translator in `src/translator.js` uses a detailed system prompt emphasizing:
- Natural Japanese translation (not word-for-word)
- Complete translation of all English text (100% Japanese output)
- Preservation of markdown formatting, emphasis, and structure
- No meta-instructions or labels in output (pure translation only)
- Exceptions for proper nouns and established loanwords only

### Rectification System Prompt (NEW)

The rectifier in `src/rectifier.js` uses a specialized system prompt emphasizing:
- **Fix OCR errors**: Correct missing/wrong letters (e.g., "ontents" → "Contents", "tae" → "The", "Ww hile" → "While")
- **Remove PDF artifacts**: Delete page numbers, footer markers, and gibberish text that break paragraph flow
- **Restore paragraph flow**: Rejoin text split by page breaks and footer markers
- **Preserve markdown structure**: Keep all legitimate headers, formatting, and content
- **No meta-commentary**: Output ONLY the corrected English text, no explanations or labels
- **Complete rectification**: Every visible error must be corrected, no OCR artifacts should remain

**Key difference from translation**: Rectification is English-to-English, focusing on cleaning and fixing rather than language conversion. The output should read naturally as if it were never corrupted.

### Error Handling

- Retryable errors (429, 500-504, network errors) trigger exponential backoff
- Non-retryable errors fail immediately
- Translation errors include chunk preview and length in logs

### Testing Approach

- **Framework**: Jest with `--experimental-vm-modules` flag
- **Location**: `test/` directory
- **Fixtures**: Test markdown files in `test/fixtures/`
  - Standard fixtures for translation testing
  - Broken document fixtures for rectification testing (e.g., `broken-missing-letters.md`, `broken-gibberish.md`)
- **Test types**:
  - Unit tests for each module (e.g., `test/chunker.test.js`, `test/rectifier.test.js`)
  - Integration tests in `test/integration/` for full pipeline and translator
  - **133 total tests** including 21 new tests for rectification feature
- Tests use `fileURLToPath` and `dirname` for ES module path resolution

**Test Coverage (NEW):**
- `test/rectifier.test.js`: 6 tests for rectifier module
- `test/rectificationEngine.test.js`: 7 tests for rectification engine
- `test/assembler.test.js`: Added 5 tests for `assembleRectified()`
- `test/cli.test.js`: Added 3 tests for `--rectify` flag

## Environment

- **API Key**: Set `OPENAI_API_KEY` in `.env` file (see `.env.example`)
- **Output**: Translated files written to `output/` directory (default)
- **Dependencies**: `openai` for API client, `dotenv` for env vars

## Important Notes

- **GPT-5 models**: gpt-5 and gpt-5-mini are real, valid models. Never question their availability.
- **Default model**: Currently `gpt-5-mini` (changed from original default of `gpt-5`)
- **Model-specific parameters**: GPT-5 models require `verbosity` and `reasoning_effort` parameters in API calls
- **ES modules**: All imports must include `.js` extension
- **Timing**: GPT-5 models are slower (~20-25s per chunk) due to extended reasoning; GPT-4o is faster (~3-5s per chunk)

## Rectification Architecture (NEW)

### DRY Principles Maintained
The rectification feature was built following strict DRY (Don't Repeat Yourself) principles:

**Reused Components:**
- `chunker.js` - Identical chunking logic for both translation and rectification
- `fileReader.js` - Same file reading functionality
- Retry logic pattern from `translator.js` replicated in `rectifier.js`
- Progress tracking pattern from `translationEngine.js` replicated in `rectificationEngine.js`
- Error handling and exponential backoff logic

**New Components (Parallel Architecture):**
- `rectifier.js` - Mirrors `translator.js` structure but with rectification-specific system prompt
- `rectificationEngine.js` - Mirrors `translationEngine.js` structure for consistency
- `assembleRectified()` in `assembler.js` - Follows same pattern as other assembler functions

**Pipeline Branching:**
- `index.js` checks `options.rectify` flag and branches to appropriate pipeline
- Both pipelines follow identical flow: read → chunk → process → assemble
- Consistent logging and progress reporting across both modes

### Use Cases for Rectification

1. **Pre-Translation Cleanup**: Clean documents before translating to ensure high-quality source text
2. **PDF-to-Markdown Conversions**: Fix errors from tools like Adobe Acrobat, pdftotext, or OCR software
3. **Scanned Document Recovery**: Correct OCR errors from scanned books or legacy documents
4. **Legacy Document Migration**: Restore corrupted text files before archival or translation

### Common Rectification Patterns

The rectifier is trained to recognize and fix:
- **Missing first letters**: `ontents` → `Contents`, `Joreface` → `Preface`, `reface` → `Preface`
- **Broken word spacing**: `Ww hile` → `While`, `tae` → `The`
- **Footer markers**: Removes page numbers and section markers that break paragraph flow
- **PDF gibberish**: Removes random character strings like `26 Gimam & eo. @ 7 Wat`
- **Code block artifacts**: Removes OCR-generated ` ``` ` markers that aren't actual code blocks
- **Hyphenation issues**: Rejoins words split across line breaks