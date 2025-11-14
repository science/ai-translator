# Book Translate

A Node.js command-line tool for translating markdown books to Japanese using the OpenAI GPT API. The tool intelligently splits markdown files into chunks while preserving document structure, translates them via OpenAI, and outputs both Japanese-only and bilingual (alternating EN/JP) versions.

**NEW:** Now includes **document rectification** - fix OCR errors and PDF conversion artifacts before translation!

## Features

### Translation Features
- **Structure-Aware Chunking**: Splits markdown at logical boundaries (headers, paragraphs) to maintain context
- **Dual Output Formats**:
  - Japanese-only translation
  - Bilingual version with alternating English/Japanese sections
- **Resume Capability**: Cache system allows resuming interrupted translations
- **Progress Tracking**: Real-time progress updates with ETA calculations
- **Configurable**: Customizable chunk size, model selection, and output directory

### Rectification Features (NEW)
- **OCR Error Correction**: Fixes missing/wrong letters (e.g., "ontents" → "Contents", "tae" → "The")
- **PDF Artifact Removal**: Removes page numbers, footer markers, and gibberish text
- **Paragraph Flow Restoration**: Rejoins text broken by page breaks and footer markers
- **Pre-Translation Cleanup**: Clean your documents before translating for better results
- **Same Pipeline**: Uses the same chunking and progress tracking as translation

## Prerequisites

- **Node.js**: Version 20 LTS or later
- **OpenAI API Key**: Valid API key with access to GPT models

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd book-translate
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=your_actual_api_key_here
```

## Usage

### Translation Mode (Default)

```bash
node src/index.js path/to/your-book.md
```

This will:
- Read the markdown file
- Split it into chunks
- Translate each chunk to Japanese
- Generate two output files in the `output/` directory:
  - `your-book-japanese.md` (Japanese only)
  - `your-book-bilingual.md` (Alternating English/Japanese)

### Rectification Mode (NEW)

Fix OCR errors and PDF conversion artifacts in your documents:

```bash
node src/index.js path/to/broken-book.md --rectify
```

This will:
- Read the markdown file
- Split it into chunks
- Fix OCR errors, remove gibberish, and restore paragraph flow
- Generate cleaned output in the `output/` directory:
  - `broken-book-rectified.md` (Clean English markdown)

**Common workflow:**
```bash
# Step 1: Rectify the broken PDF-to-markdown conversion
node src/index.js broken-book.md --rectify --output-dir cleaned/

# Step 2: Translate the cleaned version
node src/index.js cleaned/broken-book-rectified.md --output-dir translated/
```

### Advanced Options

```bash
node src/index.js <input-file> [options]
```

**Options:**
- `--rectify`: Enable rectification mode (English-to-English cleanup)
- `--output-dir <path>`: Specify output directory (default: `output/`)
- `--chunk-size <number>`: Maximum chunk size in characters (default: `4000`)
- `--model <model-name>`: OpenAI model to use (default: `gpt-5-mini`)
- `--reasoning-effort <low|medium|high>`: GPT-5 reasoning effort (default: `medium`)

**Examples:**

```bash
# Rectify with custom output directory
node src/index.js broken.md --rectify --output-dir cleaned/

# Rectify with different model
node src/index.js broken.md --rectify --model gpt-4o

# Translation: Custom output directory
node src/index.js book.md --output-dir translated/

# Translation: Custom chunk size
node src/index.js book.md --chunk-size 2000

# Translation: Specify different model (faster but less sophisticated)
node src/index.js book.md --model gpt-4o

# Combine options
node src/index.js book.md --output-dir results/ --chunk-size 3000 --model gpt-4o
```

### Expected Runtime

Translation speed varies by model:
- **GPT-4o**: ~3-5 seconds per chunk (faster, suitable for large documents)
- **GPT-5**: ~20-25 seconds per chunk (slower due to extended reasoning, higher quality)

For a typical book (~140 chunks):
- GPT-4o: 10-15 minutes
- GPT-5: 45-60 minutes

The tool displays real-time progress with ETA calculations.

## Output Formats

### Japanese-Only (`*-japanese.md`)
Contains only the translated Japanese text, preserving the original markdown structure (headers, lists, links, formatting).

### Bilingual (`*-bilingual.md`)
Alternates between original English and Japanese translation:
```markdown
## Original Header

Original paragraph text...

---

## 翻訳されたヘッダー

翻訳された段落テキスト...

---
```

## Project Structure

```
book-translate/
├── src/
│   ├── index.js                 # Main CLI entry point (handles both modes)
│   ├── cli.js                   # Command-line argument parser
│   ├── fileReader.js            # Markdown file reader
│   ├── chunker.js               # Document chunking logic (shared)
│   ├── markdownParser.js        # Markdown structure parser
│   ├── translator.js            # OpenAI translation wrapper
│   ├── translationEngine.js     # Translation orchestration
│   ├── rectifier.js             # OpenAI rectification wrapper (NEW)
│   ├── rectificationEngine.js   # Rectification orchestration (NEW)
│   ├── cache.js                 # Translation cache system
│   ├── progressLogger.js        # Progress tracking
│   └── assembler.js             # Output file assembly (both modes)
├── test/                        # Jest test suite (133 tests)
│   ├── fixtures/                # Test markdown files
│   │   ├── broken-*.md          # Broken document fixtures (NEW)
│   │   └── expected-*.md        # Expected rectification output (NEW)
│   └── integration/             # Integration tests
├── output/                      # Generated translations/rectifications
├── .env                         # Environment variables (not in git)
├── .env.example                 # Environment template
├── package.json                 # Project dependencies
├── TODO.md                      # Development roadmap
└── TODO-rectifier.md            # Rectifier feature tracking (NEW)
```

## How It Works

### Translation Mode
1. **Read**: Loads the markdown file into memory
2. **Chunk**: Splits content at header boundaries (H1-H6), subdividing by paragraphs if chunks exceed size limit
3. **Translate**: Sends each chunk to OpenAI API with translation instructions
4. **Cache**: Saves translated chunks progressively (enables resume on failure)
5. **Assemble**: Combines translated chunks into final output files (Japanese-only and bilingual)

### Rectification Mode (NEW)
1. **Read**: Loads the markdown file into memory
2. **Chunk**: Splits content using the same chunking logic as translation
3. **Rectify**: Sends each chunk to OpenAI API with rectification instructions:
   - Fix OCR errors (missing letters, typos)
   - Remove PDF artifacts (page numbers, gibberish)
   - Restore paragraph flow (remove footer markers)
   - Preserve markdown structure exactly
4. **Assemble**: Combines rectified chunks into a single cleaned English markdown file

## Chunking Strategy

The chunker preserves document hierarchy (used by both translation and rectification):
- Primary splitting at header boundaries (H1-H6)
- Large sections are subdivided by paragraph breaks
- Each chunk includes metadata (type, header level, index)
- Headers are included in chunk content to maintain context

## Rectification Use Cases (NEW)

The rectification feature is ideal for:

1. **PDF-to-Markdown Conversions**: Clean up documents converted from PDF using tools like Adobe Acrobat, pdftotext, or OCR software
2. **Scanned Documents**: Fix OCR errors from scanned books or papers
3. **Pre-Translation Cleanup**: Ensure high-quality source text before translating to Japanese
4. **Legacy Document Recovery**: Restore corrupted or poorly formatted text files

**Common errors fixed:**
- Missing first letters: `ontents` → `Contents`, `Joreface` → `Preface`
- Broken spacing: `Ww hile` → `While`, `tae` → `The`
- Footer markers breaking paragraphs: `text\n\nPage 21\n\nmore text` → `text more text`
- PDF gibberish: Random character strings like `26 Gimam & eo. @ 7 Wat` are removed
- Code block artifacts: Removes OCR-generated ` ``` ` markers that aren't actual code

## Development

### Running Tests

```bash
npm test
```

### Inspecting Chunks

Debug the chunking process:
```bash
node scripts/inspectChunks.js
```

## Configuration

### Environment Variables

Create a `.env` file with:
```
OPENAI_API_KEY=sk-...
```

### Rate Limits & Cost

- The tool processes chunks sequentially to manage API rate limits
- Translation costs depend on:
  - Document size (character/token count)
  - Model selected (GPT-4o vs GPT-5)
  - OpenAI pricing at time of use

Consider testing with a small sample file first to estimate costs.

## Resume Capability

If translation is interrupted, the cache system saves progress. Simply re-run the same command to resume where you left off.

## Troubleshooting

**API Key Errors:**
- Ensure `OPENAI_API_KEY` is set in `.env`
- Verify the key is valid and has API access

**Rate Limit Errors:**
- The tool includes automatic retry logic with exponential backoff
- For persistent issues, consider reducing chunk size or adding delays

**File Not Found:**
- Verify the input file path is correct
- Use absolute paths if relative paths fail

## License

ISC

## Dependencies

- `openai` - Official OpenAI API client
- `dotenv` - Environment variable management

## Development Dependencies

- `jest` - Testing framework
