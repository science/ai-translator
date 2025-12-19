# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js CLI tool for translating markdown books to Japanese using the OpenAI GPT API. The project is **fully implemented** and production-ready. It has three main capabilities:

1. **Translation**: Translates markdown files to Japanese, outputting both Japanese-only and bilingual (alternating EN/JP) versions
2. **Rectification**: English-to-English document cleanup to fix OCR errors and PDF conversion artifacts
3. **PDF-to-Markdown Conversion**: Converts PDF files directly to markdown format using pdf2md library

**Typical Workflow:**
```bash
# Step 1: Convert PDF to markdown
node src/index.js book.pdf --pdf-to-md --output-dir converted/

# Step 2: Rectify the converted markdown to fix OCR errors
node src/index.js converted/book.md --rectify --output-dir cleaned/

# Step 3: Translate the cleaned version to Japanese
node src/index.js cleaned/book-rectified.md --output-dir translated/
```

## Development Methodology: TDD Red/Green

**All new functionality MUST follow Test-Driven Development (TDD) using the red/green methodology.** Work in small, incremental steps—never write large amounts of implementation code without corresponding tests.

### The TDD Cycle

1. **RED: Write a failing test first**
   - Write a small, focused test for the next piece of functionality
   - Run the test to **prove it fails** (this confirms the test is valid)
   - If the test passes immediately, the test is wrong or the functionality already exists

2. **GREEN: Write minimal code to pass**
   - Implement just enough code to make the failing test pass
   - Run the test to **prove it passes**
   - Do not add extra functionality beyond what the test requires

3. **REFACTOR: Clean up (optional)**
   - Improve code structure while keeping tests green
   - Run tests again to confirm nothing broke

4. **REPEAT: Move forward incrementally**
   - Add the next small test, repeat the cycle
   - Build functionality piece by piece, always with test coverage

### Test Types by Context

**CLI Tool (root project):** Use Jest unit tests
```bash
# Write test in test/*.test.js, then run:
npm test -- --testPathPattern=myFeature
```

**Web App (`web-app/`):** Use Vitest for unit tests, Playwright for browser tests
```bash
cd web-app
npm run test:unit              # Vitest unit tests
npm run test:e2e               # Playwright browser tests
npm run test:e2e:ui            # Playwright with interactive UI
```

**When to use each:**
- **Unit tests (Jest/Vitest)**: Pure functions, data transformations, business logic, module APIs
- **Playwright browser tests**: User interactions, page navigation, form submissions, visual behavior, component integration

### Debugging Failures (When Things Go Red)

When implementation work causes test failures or unexpected bugs:

1. **Add diagnostic logging**
   ```javascript
   console.log('DEBUG: value =', value);
   console.log('DEBUG: state before =', JSON.stringify(state, null, 2));
   ```

2. **Write a "proving" test that isolates the bug**
   - Create a minimal test case that reproduces the failure
   - Run it to confirm it fails (proves the bug exists)
   - This test becomes part of your regression suite

3. **Identify root cause**
   - Use the failing test + console output to trace the issue
   - Narrow down to the specific line/condition causing the problem

4. **Fix and verify**
   - Implement the fix
   - Run the proving test to confirm it now passes
   - Run full test suite to ensure no regressions

### Example TDD Workflow

Adding a new CLI flag `--verbose`:

```bash
# Step 1: Write failing test
# In test/cli.test.js, add:
test('parses --verbose flag', () => {
  const result = parseCliArgs(['input.md', '--verbose']);
  expect(result.verbose).toBe(true);
});

# Step 2: Run to prove failure
npm test -- --testPathPattern=cli
# ✗ FAIL - result.verbose is undefined (RED)

# Step 3: Implement minimal code in src/cli.js
# Add verbose flag parsing

# Step 4: Run to prove success
npm test -- --testPathPattern=cli
# ✓ PASS (GREEN)

# Step 5: Next test - verbose affects output
# Write test, prove failure, implement, prove success...
```

### Key Principles

- **Never skip the RED step** - Running a test before implementation proves it can fail
- **Small increments** - Each test should cover one small behavior, not entire features
- **Tests are documentation** - They show exactly what the code should do
- **Failing tests are information** - They tell you precisely what's broken
- **Console debugging is temporary** - Remove `console.log` statements after fixing issues

## Commands

### Running the CLI
```bash
node src/index.js <input-file> [options]
```

**Options:**
- `--pdf-to-md`: Enable PDF-to-markdown conversion mode
- `--rectify`: Enable rectification mode (English-to-English cleanup)
- `--output-dir <path>`: Output directory (default: `output/`)
- `--chunk-size <number>`: Max chunk size in characters (default: `4000`)
- `--model <model-name>`: OpenAI model (default: `gpt-5-mini`)
- `--reasoning-effort <low|medium|high>`: GPT-5 reasoning effort (default: `medium`)

**Note:** `--pdf-to-md` and `--rectify` are mutually exclusive.

**PDF-to-Markdown Example:**
```bash
node src/index.js book.pdf --pdf-to-md --output-dir converted/
```

**Translation Example:**
```bash
node src/index.js book.md --model gpt-4o --chunk-size 3000
```

**Rectification Example:**
```bash
node src/index.js broken-book.md --rectify --output-dir cleaned/
```

### Testing
```bash
npm test                                    # Run all tests
npm test -- --testPathPattern=chunker      # Run single test file by name
npm test -- test/chunker.test.js           # Run single test file by path
npm test -- --testNamePattern="splits"     # Run tests matching pattern
```
Runs Jest tests using experimental VM modules (required for ES modules).

## Web App

A browser-based interface is available in `web-app/` built with SvelteKit 2, Svelte 5, and Tailwind CSS 4.

```bash
cd web-app
npm install
npm run dev          # Start development server
npm run build        # Build for production
npm run check        # TypeScript/Svelte type checking
npm test             # Run unit tests (vitest) and e2e tests (playwright)
```

**Routes:**
- `/` - Home/landing page
- `/convert` - PDF-to-markdown conversion
- `/cleanup` - Document rectification
- `/translate` - Translation interface
- `/documents` - Document management
- `/settings` - Configuration

## Architecture

### Module Structure

The codebase uses **ES modules** (`"type": "module"` in package.json). All imports must use `.js` extensions.

**Key modules:**
- `src/index.js`: CLI entry point, orchestrates entire pipeline (handles translation, rectification, and PDF-to-markdown modes)
- `src/cli.js`: Parses command-line arguments (includes `--rectify` and `--pdf-to-md` flags)
- `src/fileReader.js`: Reads markdown files, handles file errors
- `src/pdfReader.js`: Reads PDF files as buffers
  - `readPdfFile(filePath)`: Returns PDF buffer for conversion
  - Mirrors fileReader error handling pattern
- `src/chunker.js`: Splits markdown into chunks by headers/paragraphs (used by translation and rectification modes)
  - `chunkBySize()`: Main chunking function, accepts content and maxChunkSize
  - Returns chunks with metadata: `{index, type, headerLevel, content}`
- `src/translator.js`: OpenAI API wrapper for translation
  - `createTranslator(options)`: Factory function returning `{client, translateChunk}`
  - Handles retry logic with exponential backoff for retryable errors (429, 500, 502, 503, 504)
  - GPT-5 models require `verbosity` and `reasoning_effort` parameters
- `src/translationEngine.js`: Orchestrates translation loop
  - `translateDocument(chunks, translateChunkFn, options)`: Sequential processing with progress tracking
- `src/rectifier.js`: OpenAI API wrapper for rectification
  - `createRectifier(options)`: Factory function returning `{client, rectifyChunk}`
  - Same retry logic and error handling as translator
  - Specialized system prompt for fixing OCR errors and PDF artifacts
- `src/rectificationEngine.js`: Orchestrates rectification loop
  - `rectifyDocument(chunks, rectifyChunkFn, options)`: Sequential processing with progress tracking
  - Parallel structure to translationEngine for consistency
- `src/pdfConverter.js`: PDF-to-markdown converter wrapper
  - `createPdfConverter()`: Factory function returning `{convertToMarkdown}`
  - Uses dynamic import to load CommonJS pdf2md library
  - Handles conversion errors gracefully
- `src/cache.js`: Translation cache system (currently unused but implemented)
  - `TranslationCache` class with `load()`, `set()`, `get()`, `save()` methods
- `src/assembler.js`: Generates output files (supports all modes)
  - `assembleJapaneseOnly()`: Creates Japanese-only markdown
  - `assembleBilingual()`: Creates alternating EN/JP with `---` separators
  - `assembleRectified()`: Creates cleaned English markdown
  - `assemblePdfToMarkdown()`: Creates markdown file from PDF conversion

### Translation Pipeline

The main flow in `src/index.js` (translation mode):
1. Parse CLI args (`parseCliArgs`)
2. Read markdown file (`readMarkdownFile`)
3. Chunk document (`chunkBySize`)
4. Create translator (`createTranslator`)
5. Translate all chunks (`translateDocument`)
6. Assemble outputs (`assembleJapaneseOnly`, `assembleBilingual`)

### Rectification Pipeline

The main flow in `src/index.js` (rectification mode, enabled with `--rectify` flag):
1. Parse CLI args (`parseCliArgs`) - detects `--rectify` flag
2. Read markdown file (`readMarkdownFile`)
3. Chunk document (`chunkBySize`) - same chunking logic
4. Create rectifier (`createRectifier`)
5. Rectify all chunks (`rectifyDocument`)
6. Assemble output (`assembleRectified`)

### PDF-to-Markdown Pipeline

The main flow in `src/index.js` (PDF conversion mode, enabled with `--pdf-to-md` flag):
1. Parse CLI args (`parseCliArgs`) - detects `--pdf-to-md` flag
2. Read PDF file as buffer (`readPdfFile`)
3. Create converter (`createPdfConverter`)
4. Convert PDF to markdown (`convertToMarkdown`)
5. Assemble output (`assemblePdfToMarkdown`)

**Key differences from translation/rectification:**
- No chunking required (converts entire PDF at once)
- No OpenAI API calls (uses pdf2md library locally)
- No retry logic or sequential processing
- Much simpler and faster pipeline

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

### Rectification System Prompt

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
- **Fixtures**: Test files in `test/fixtures/`
  - Standard markdown fixtures for translation testing
  - Broken document fixtures for rectification testing (e.g., `broken-missing-letters.md`, `broken-gibberish.md`)
  - PDF fixture for PDF conversion testing (`sample.pdf`)
- **Test types**:
  - Unit tests for each module (e.g., `test/chunker.test.js`, `test/rectifier.test.js`, `test/pdfReader.test.js`)
  - Integration tests in `test/integration/` for full pipelines
  - **153 total tests** (133 original + 20 for PDF-to-markdown feature)
- Tests use `fileURLToPath` and `dirname` for ES module path resolution

**Test Coverage:**
- Rectification feature (21 tests):
  - `test/rectifier.test.js`: 6 tests for rectifier module
  - `test/rectificationEngine.test.js`: 7 tests for rectification engine
  - `test/assembler.test.js`: 5 tests for `assembleRectified()`
  - `test/cli.test.js`: 3 tests for `--rectify` flag
- PDF-to-markdown feature (20 tests):
  - `test/pdfReader.test.js`: 4 tests for PDF file reading
  - `test/pdfConverter.test.js`: 4 tests for PDF conversion
  - `test/assembler.test.js`: 5 tests for `assemblePdfToMarkdown()`
  - `test/cli.test.js`: 4 tests for `--pdf-to-md` flag
  - `test/integration/pdfToMarkdown.test.js`: 3 integration tests

## Environment

- **API Key**: Set `OPENAI_API_KEY` in `.env` file (see `.env.example`)
  - Required for translation and rectification modes
  - Not required for PDF-to-markdown conversion
- **Output**: Output files written to `output/` directory (default)
- **Dependencies**:
  - `openai` - OpenAI API client for translation and rectification
  - `dotenv` - Environment variable management
  - `@opendocsg/pdf2md` - PDF-to-markdown conversion library

## Important Notes

- **GPT-5 models**: gpt-5.2 and gpt-5-mini are real, valid models. Never question their availability.
- **Default model**: Currently `gpt-5-mini`
- **Model-specific parameters**: GPT-5 models require `verbosity` and `reasoning_effort` parameters in API calls
- **ES modules**: All imports must include `.js` extension
- **Timing**: GPT-5 models are slower (~20-25s per chunk) due to extended reasoning; GPT-4.1 is faster (~3-5s per chunk)

## Model Configuration (Centralized)

Models are configured in a **single source of truth** for easy updates:

**CLI Tool:** `src/models.js`
**Web App:** `web-app/src/lib/models.ts`

### Current Models

| Model | Series | Default Reasoning Effort | Supported Efforts |
|-------|--------|-------------------------|-------------------|
| gpt-5.2 | 5 | none | none, low, medium, high |
| gpt-5-mini | 5 | medium | minimal, low, medium, high |
| gpt-4.1 | 4 | N/A | N/A |
| gpt-4.1-mini | 4 | N/A | N/A |

### How to Add or Update Models

1. **Edit the MODELS array** in both files:

   ```javascript
   // src/models.js (CLI) or web-app/src/lib/models.ts (Web App)
   export const MODELS = [
     {
       id: 'gpt-5.2',           // API model name
       label: 'gpt-5.2',        // Display label in UI
       series: 5,               // Model series (4 or 5)
       defaultReasoningEffort: 'none',  // Default for this model
       supportedReasoningEfforts: ['none', 'low', 'medium', 'high']  // Valid options
     },
     // ... more models
   ];
   ```

2. **Update DEFAULT_MODEL** if changing the default:
   ```javascript
   export const DEFAULT_MODEL = 'gpt-5-mini';
   ```

3. **Run tests** to verify:
   ```bash
   # CLI
   npm test -- test/models.test.js

   # Web App
   cd web-app && npm run test:unit -- --run tests/unit/models.test.ts
   ```

4. **Update tests** that reference specific models (if model names changed)

### Helper Functions Available

- `is5SeriesModel(modelId)` - Check if model is GPT-5 series (uses reasoning effort)
- `isGpt52Model(modelId)` - Check if model is GPT-5.2 family specifically
- `getModelById(modelId)` - Get full model config by ID
- `getReasoningEffortOptions(modelId)` - Get dropdown options for UI
- `getValidReasoningEffort(modelId, requested)` - Convert/validate reasoning effort

### Reasoning Effort Differences

- **GPT-5.2**: Uses `none` as lowest level (default: `none`)
- **GPT-5-mini**: Uses `minimal` as lowest level (default: `medium`)
- The helper functions automatically convert between these when needed

## Rectification Architecture

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

## PDF-to-Markdown Architecture

### DRY Principles Maintained
The PDF-to-markdown feature was built following strict DRY (Don't Repeat Yourself) principles:

**Reused Components:**
- `assembler.js` - Added `assemblePdfToMarkdown()` following same pattern as other assembler functions
- Error handling patterns from existing modules
- CLI parsing pattern from `cli.js`
- File reading pattern from `fileReader.js` (adapted for PDF buffers)

**New Components (Minimal Architecture):**
- `pdfReader.js` - Mirrors `fileReader.js` structure but returns Buffer instead of string
- `pdfConverter.js` - Wraps pdf2md library with factory function pattern like `translator.js`
- Uses dynamic `import()` to load CommonJS pdf2md library in ES module environment

**Pipeline Branching:**
- `index.js` checks `options.pdfToMd` flag and branches to PDF conversion pipeline
- PDF pipeline is simplest of the three: read → convert → assemble
- No chunking, no AI processing, no retry logic needed
- Consistent logging and progress reporting with other modes

### Use Cases for PDF-to-Markdown

1. **Pre-Rectification Step**: Convert PDFs to markdown before applying rectification
2. **Book Digitization**: Extract text from PDF books for translation workflow
3. **Document Processing**: Convert PDF documents to editable markdown format
4. **Complete Workflow**: PDF → Markdown → Rectification → Translation

### Technical Implementation

**ES Modules vs CommonJS:**
The `@opendocsg/pdf2md` library is CommonJS, but this project uses ES modules. Solution:
```javascript
export async function createPdfConverter() {
  const { default: pdf2md } = await import('@opendocsg/pdf2md');

  const convertToMarkdown = async (pdfBuffer) => {
    const markdown = await pdf2md(pdfBuffer);
    return markdown;
  };

  return { convertToMarkdown };
}
```

**Performance:**
- No OpenAI API calls = No API costs
- Local JavaScript processing only
- Fast conversion (seconds for typical books)
- No rate limiting or retry logic needed

**Limitations:**
- PDF conversion quality varies based on PDF source (text-based vs scanned)
- OCR errors from scanned PDFs require rectification
- Users should use `--rectify` after `--pdf-to-md` for best results