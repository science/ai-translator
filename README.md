# Book Translate

A Node.js command-line tool for translating markdown books to Japanese using the OpenAI GPT API. The tool intelligently splits markdown files into chunks while preserving document structure, translates them via OpenAI, and outputs both Japanese-only and bilingual (alternating EN/JP) versions.

## Features

- **Structure-Aware Chunking**: Splits markdown at logical boundaries (headers, paragraphs) to maintain context
- **Dual Output Formats**:
  - Japanese-only translation
  - Bilingual version with alternating English/Japanese sections
- **Resume Capability**: Cache system allows resuming interrupted translations
- **Progress Tracking**: Real-time progress updates with ETA calculations
- **Configurable**: Customizable chunk size, model selection, and output directory

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

### Basic Usage

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

### Advanced Options

```bash
node src/index.js <input-file> [options]
```

**Options:**
- `--output-dir <path>`: Specify output directory (default: `output/`)
- `--chunk-size <number>`: Maximum chunk size in characters (default: `4000`)
- `--model <model-name>`: OpenAI model to use (default: `gpt-5`)

**Examples:**

```bash
# Custom output directory
node src/index.js book.md --output-dir translated/

# Custom chunk size
node src/index.js book.md --chunk-size 2000

# Specify different model (faster but less sophisticated)
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
│   ├── index.js              # Main CLI entry point
│   ├── cli.js                # Command-line argument parser
│   ├── fileReader.js         # Markdown file reader
│   ├── chunker.js            # Document chunking logic
│   ├── markdownParser.js     # Markdown structure parser
│   ├── translator.js         # OpenAI translation wrapper
│   ├── translationEngine.js  # Translation orchestration
│   ├── cache.js              # Translation cache system
│   ├── progressLogger.js     # Progress tracking
│   └── assembler.js          # Output file assembly
├── test/                     # Jest test suite
├── output/                   # Generated translations
├── .env                      # Environment variables (not in git)
├── .env.example              # Environment template
├── package.json              # Project dependencies
└── TODO.md                   # Development roadmap
```

## How It Works

1. **Read**: Loads the markdown file into memory
2. **Chunk**: Splits content at header boundaries (H1-H6), subdividing by paragraphs if chunks exceed size limit
3. **Translate**: Sends each chunk to OpenAI API with translation instructions
4. **Cache**: Saves translated chunks progressively (enables resume on failure)
5. **Assemble**: Combines translated chunks into final output files

## Chunking Strategy

The chunker preserves document hierarchy:
- Primary splitting at header boundaries (H1-H6)
- Large sections are subdivided by paragraph breaks
- Each chunk includes metadata (type, header level, index)
- Headers are included in chunk content to maintain context

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
