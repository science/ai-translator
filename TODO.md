# TODO - Markdown Translation Script

Project to translate a markdown book into Japanese using OpenAI's GPT-5 API, with dual output formats.

---

## Phase 1: Project Setup

- [x] Initialize Node.js project
  - Run `npm init -y`
  - Configure `package.json` with project metadata
  - Set `"type": "module"` for ES modules support

- [x] Install dependencies
  - Install `openai` package: `npm install openai`
  - Install `dotenv` for environment variables: `npm install dotenv`

- [x] Environment configuration
  - Create `.env` file with `OPENAI_API_KEY` placeholder
  - Create `.env.example` template for reference

- [x] Project structure
  - Create `.gitignore` (exclude `node_modules/`, `.env`, `output/`, `*.log`)
  - Create `src/` directory for source code
  - Create `output/` directory for translated files

---

## Phase 2: Core Utilities

- [ ] Markdown file reader (`src/fileReader.js`)
  - Read markdown file from path
  - Return full content as string
  - Handle file not found errors

- [ ] Chunking strategy implementation (`src/chunker.js`)
  - Analyze best chunking approach (by headers, paragraphs, or token count)
  - Implement chunk splitting function
  - Preserve chunk boundaries at logical points (headers/paragraphs)
  - Return array of chunks with metadata (position, type)

- [ ] Markdown structure parser (`src/markdownParser.js`)
  - Detect headers (H1-H6)
  - Identify paragraph boundaries
  - Preserve special markdown syntax (links, formatting)
  - Track document hierarchy

---

## Phase 3: OpenAI Integration

- [ ] OpenAI client setup (`src/translator.js`)
  - Import and initialize OpenAI client
  - Load API key from environment variables
  - Configure client options (timeout, retries)

- [ ] Translation function
  - Create `translateChunk()` function using GPT-5
  - Use chat completions API with translation prompt
  - Specify system prompt: "You are a professional translator. Translate the following English text to Japanese while preserving markdown formatting."
  - Return translated text

- [ ] Error handling and resilience
  - Catch API errors (rate limits, network issues)
  - Implement exponential backoff retry logic
  - Log errors with chunk context
  - Add timeout handling

---

## Phase 4: Translation Engine

- [ ] Main translation orchestrator (`src/translationEngine.js`)
  - Load chunks from chunker
  - Process chunks sequentially (avoid parallel to manage rate limits)
  - Track progress (current chunk / total chunks)
  - Estimate time remaining

- [ ] Translation cache system (`src/cache.js`)
  - Save translated chunks to JSON file after each translation
  - Load existing cache on startup (resume capability)
  - Map original chunks to translations
  - Skip already-translated chunks on restart

- [ ] Progress logging
  - Display current chunk being translated
  - Show percentage complete
  - Log timestamp and chunk ID
  - Save logs to file for debugging

---

## Phase 5: Document Assembly

- [ ] Japanese-only assembler (`src/assembler.js`)
  - Take all translated chunks
  - Concatenate in original order
  - Preserve markdown structure
  - Write to `output/book-japanese.md`

- [ ] Alternating EN/JP assembler (`src/assembler.js`)
  - Interleave original and translated chunks
  - Add clear visual separators (e.g., `---` or section headers)
  - Format: English chunk → Japanese chunk → English chunk...
  - Write to `output/book-bilingual.md`

- [ ] Markdown formatting preservation
  - Ensure headers maintain hierarchy
  - Keep links, lists, and formatting intact
  - Validate output structure

---

## Phase 6: Main Script

- [ ] CLI implementation (`src/index.js` or `translate.js`)
  - Accept command-line arguments:
    - Input file path
    - Output directory (optional, default: `output/`)
    - Chunk size (optional)
    - Model selection (optional, default: GPT-5)
  - Example: `node src/index.js "It's_On_Me_ Accept_Hard_Truths-Sara Kuburic.md"`

- [ ] Configuration options
  - Allow custom chunk size via CLI flag
  - Support model selection (GPT-4, GPT-5)
  - Optional flags for output format (JP-only, bilingual, or both)

- [ ] Progress display
  - Real-time progress bar or percentage
  - ETA calculation based on chunks/second
  - Success/failure summary at completion

- [ ] Output file naming
  - Use input filename as base
  - Append `-japanese.md` and `-bilingual.md` suffixes
  - Save to configured output directory

---

## Phase 7: Testing & Validation

- [ ] Unit testing
  - Test chunker with sample markdown
  - Verify chunk boundaries are logical
  - Test cache save/load functionality

- [ ] Integration testing
  - Run translation on first 3-5 chunks only
  - Verify API connectivity and response format
  - Check output file structure

- [ ] Quality validation
  - Review sample translations for accuracy
  - Verify markdown structure preserved
  - Check bilingual format readability

- [ ] Documentation
  - Create `README.md` with:
    - Project description
    - Setup instructions
    - Usage examples
    - Environment variables needed
    - Sample output screenshots/excerpts

---

## Tech Stack

- **Runtime:** Node.js 20 LTS or later
- **API Library:** `openai` (npm package, v5.20.0+)
- **Model:** OpenAI GPT-5 (chat completions API)
- **Language:** JavaScript (ES modules)
- **Key Dependencies:**
  - `openai` - Official OpenAI API client
  - `dotenv` - Environment variable management

---

## Notes

- **Chunking Strategy:** Start with header-based chunking (split at `# `, `## `, etc.) to maintain semantic boundaries. If chunks are too large, combine with paragraph-based splitting.
- **Rate Limits:** GPT-5 has rate limits; implement delays between requests if needed (e.g., 1 second between chunks).
- **Cost Estimation:** Calculate approximate cost based on token count before running full translation.
- **Resume Capability:** Cache system allows resuming interrupted translations without re-translating completed chunks.

---

## Input File

**Current book:** `It's_On_Me_ Accept_Hard_Truths-Sara Kuburic.md` (~390KB)

---

## Success Criteria

✅ Complete Japanese translation preserves markdown structure
✅ Bilingual output clearly separates EN/JP sections
✅ Script handles errors gracefully and can resume
✅ Progress tracking provides clear visibility
✅ Output files are properly formatted and readable
