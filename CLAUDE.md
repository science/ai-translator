# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js tool for translating markdown books to Japanese using the OpenAI GPT API. The project splits markdown files into chunks (preserving document structure), translates them via OpenAI, and outputs both Japanese-only and bilingual (alternating EN/JP) versions.

## Commands

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
- `src/fileReader.js`: Reads markdown files, handles file errors
- `src/chunker.js`: Splits markdown into chunks by headers/paragraphs
  - `chunkMarkdown()`: Splits at header boundaries (H1-H6)
  - `chunkBySize()`: Further splits large header chunks by paragraphs if they exceed maxChunkSize
  - Returns chunks with metadata: `{index, type, headerLevel, content}`

### Chunking Strategy

The chunker preserves document hierarchy:
1. Primary splitting at header boundaries (H1-H6 via regex `/^(#{1,6})\s+(.+)$/`)
2. Headers are **included** in chunk content
3. Large chunks are sub-divided by paragraph breaks (`\n\n+`)
4. Each chunk tracks: type (`'header-section'`, `'paragraph-section'`, `'preamble'`), headerLevel, index

### Testing Approach

- **Framework**: Jest with `--experimental-vm-modules` flag
- **Location**: `test/` directory
- **Fixtures**: Test markdown files in `test/fixtures/`
- **Expected outputs**: Golden files like `simple-chunks.json` in fixtures directory
- Tests use `fileURLToPath` and `dirname` for ES module path resolution

## Environment

- **API Key**: Set `OPENAI_API_KEY` in `.env` file (see `.env.example`)
- **Output**: Translated files written to `output/` directory
- **Dependencies**: `openai` for API client, `dotenv` for env vars

## Project Status

See TODO.md for implementation roadmap. Currently completed:
- Phase 1: Project setup
- Phase 2: File reader and chunker utilities (with tests)

Next phases include OpenAI integration, translation engine, and document assembly.
