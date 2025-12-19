# Book Translate

A browser-based tool for translating PDF books and markdown documents to any language using OpenAI's GPT models. Upload a PDF, clean up OCR errors, and get professional translations—all from your browser.

## Overview

Book Translate handles the complete document translation pipeline:

1. **Convert** - Transform PDFs into editable markdown
2. **Clean Up** - Fix OCR errors and PDF conversion artifacts
3. **Translate** - Get natural, context-aware translations in any language

All processing happens client-side in your browser. Your documents and API key never leave your machine (except for API calls directly to OpenAI).

## Quick Start

### 1. Open the App

Visit **[science.github.io/ai-translator](https://science.github.io/ai-translator)** to launch the app in your browser.

### 2. Configure Your API Key

Navigate to **Settings** and enter your OpenAI API key. Need help? Click "How to get an API key" for step-by-step instructions including:

- Creating an OpenAI account
- Setting up billing (required for API access)
- Generating and saving your key

### 3. Translate Your First Document

**Option A: One-Step Translation** (Recommended)

1. Go to **One Step Translation** in the sidebar
2. Upload a PDF file
3. Enter your target language (e.g., "Japanese", "formal German")
4. Click Start and wait for processing
5. Download your translated document

**Option B: Step-by-Step**

1. Upload your document on the **Home** page
2. Convert it on the **Convert PDF** page
3. Clean it up on the **Cleanup** page
4. Translate it on the **Translate** page
5. Download from **My Documents**

## Features

### One Step Translation

The flagship feature—a unified pipeline that handles everything:

- Upload PDF → Automatic conversion, cleanup, and translation
- Configure cleanup and translation settings independently
- Track progress through each phase with visual indicators
- Download as Markdown or Word document

**Outputs:**
- Converted Markdown (raw PDF extraction)
- Cleaned Markdown (OCR errors fixed)
- Translated (target language only)
- Bilingual (alternating original/translated sections)

### PDF to Markdown Conversion

Extract text from PDF files while preserving structure:

- Headers, paragraphs, and formatting maintained
- Fast local processing (no API calls required)
- Works with text-based and scanned PDFs

### Document Cleanup (Rectification)

Fix common OCR and PDF conversion errors:

- Missing letters: `ontents` → `Contents`
- Broken words: `Ww hile` → `While`
- Page numbers and footer markers removed
- Paragraph flow restored across page breaks
- PDF gibberish text removed

### Translation

Natural, publication-quality translations:

- **Target language flexibility** - Specify language and tone (e.g., "formal Japanese", "conversational Spanish")
- **Language history** - Quick access to recently used languages
- **Context-aware translation** - Optional feature that provides surrounding text context for consistent tone
- **Dual output** - Get target-language-only and bilingual versions

### Document Management

Full document library with organization features:

- **Phase filtering** - View by stage: Uploaded, Converted, Cleaned, Translated
- **Search** - Find documents by name
- **Preview** - View raw markdown or rendered HTML
- **Export** - Download as original format or Word document
- **Storage tracking** - Monitor browser storage usage

### Settings

Configure defaults and manage your workspace:

- API key configuration with connection testing
- Default model, chunk size, and reasoning effort
- Context-aware translation toggle
- Storage management with one-click cleanup

## Supported Models

| Model | Speed | Quality | Best For |
|-------|-------|---------|----------|
| gpt-5.2 | Slower | Highest | Final translations |
| gpt-5-mini | Medium | High | General use (default) |
| gpt-4.1 | Fast | Good | Quick drafts |
| gpt-4.1-mini | Fastest | Good | Large documents |

GPT-5 models support configurable **reasoning effort** (Low/Medium/High) for balancing speed vs. quality.

## User Guide

### Choosing a Workflow

**Use One Step Translation when:**
- You have a PDF that needs translation
- You want the simplest experience
- You need all output formats

**Use individual pages when:**
- You only need PDF conversion (no translation)
- You want to review/edit between steps
- You're processing markdown files (not PDFs)
- You need more control over each phase

### Target Language Tips

The target language field accepts natural descriptions:

- `Japanese` - Standard translation
- `Formal Japanese` - Business/academic tone
- `Conversational Brazilian Portuguese` - Casual, regional style
- `Simplified Chinese for technical readers` - Domain-specific adaptation

Your recent languages are saved for quick reuse.

### Document Phases

Documents progress through phases, visible in My Documents:

| Phase | Description |
|-------|-------------|
| Uploaded | Original file, unprocessed |
| Converted | PDF extracted to markdown |
| Cleaned | OCR errors and artifacts fixed |
| Translated | Final translation (with variant tags) |

### Storage and Privacy

- **Local storage only** - Documents stored in your browser's IndexedDB
- **API key security** - Stored locally in localStorage, never transmitted except to OpenAI
- **No server** - All processing is client-side
- **Clear anytime** - Delete all documents from Settings

## CLI Tool

For automation or batch processing, a command-line interface is also available:

```bash
# Convert PDF to markdown
node src/index.js book.pdf --pdf-to-md --output-dir converted/

# Clean up OCR errors
node src/index.js converted/book.md --rectify --output-dir cleaned/

# Translate to Japanese
node src/index.js cleaned/book-rectified.md --output-dir translated/
```

See [CLI Documentation](#cli-reference) below for full options.

## Development

### Prerequisites

- Node.js 20 LTS or later
- OpenAI API key with billing enabled

### Running Your Own Copy

To host the web app locally or deploy your own instance:

```bash
cd web-app
npm install
npm run dev          # Start development server at http://localhost:5173
npm run build        # Build for production (outputs to build/)
npm run preview      # Preview production build locally
```

### Web App Development

```bash
cd web-app
npm run dev          # Start development server
npm run build        # Build for production
npm run check        # TypeScript type checking
npm run test:unit    # Run Vitest unit tests
npm run test:e2e     # Run Playwright browser tests
npm run test:e2e:ui  # Playwright with interactive UI
```

### CLI Development

```bash
npm install
npm test                              # Run all Jest tests
npm test -- --testPathPattern=chunker # Run specific test file
```

### Tech Stack

**Web App:**
- SvelteKit 2 / Svelte 5
- Tailwind CSS 4
- TypeScript
- IndexedDB (via idb)
- Vitest + Playwright

**CLI:**
- Node.js ES Modules
- OpenAI SDK
- Jest

### Project Structure

```
book-translate/
├── web-app/                    # Browser application
│   ├── src/
│   │   ├── routes/            # SvelteKit pages
│   │   │   ├── +page.svelte           # Home/Upload
│   │   │   ├── workflow/              # One Step Translation
│   │   │   ├── convert/               # PDF to Markdown
│   │   │   ├── cleanup/               # Document rectification
│   │   │   ├── translate/             # Translation
│   │   │   ├── documents/             # Document library
│   │   │   └── settings/              # Configuration
│   │   └── lib/
│   │       ├── stores/        # State management
│   │       ├── services/      # API clients, document operations
│   │       └── components/    # Reusable UI components
│   └── tests/                 # E2E tests
├── src/                       # CLI tool
│   ├── index.js              # CLI entry point
│   ├── chunker.js            # Document chunking
│   ├── translator.js         # OpenAI translation
│   ├── rectifier.js          # OCR error correction
│   └── pdfConverter.js       # PDF extraction
└── test/                      # CLI tests
```

## CLI Reference

```bash
node src/index.js <input-file> [options]
```

**Modes (mutually exclusive):**
- `--pdf-to-md` - Convert PDF to markdown
- `--rectify` - Clean up OCR errors (English to English)
- *(default)* - Translate to Japanese

**Options:**
- `--output-dir <path>` - Output directory (default: `output/`)
- `--chunk-size <n>` - Characters per chunk (default: `4000`)
- `--model <name>` - OpenAI model (default: `gpt-5-mini`)
- `--reasoning-effort <level>` - GPT-5 reasoning: `low`, `medium`, `high`

**Examples:**

```bash
# Full pipeline
node src/index.js book.pdf --pdf-to-md --output-dir step1/
node src/index.js step1/book.md --rectify --output-dir step2/
node src/index.js step2/book-rectified.md --output-dir final/

# Quick translation with faster model
node src/index.js clean-book.md --model gpt-4o --chunk-size 3000
```

## Environment Setup

Create `.env` from the template:

```bash
cp .env.example .env
```

Add your OpenAI API key:

```
OPENAI_API_KEY=sk-...
```

## Troubleshooting

**"Insufficient quota" error**
- Add credits to your OpenAI account at [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing)

**"Rate limit exceeded" error**
- The app automatically retries with backoff
- New accounts have lower limits that increase over time
- Try reducing chunk size or using a faster model

**API key not working**
- Ensure billing is set up (required even with free credits)
- Check the key hasn't been revoked
- Verify no extra spaces when pasting

**Poor PDF conversion quality**
- Scanned PDFs produce more OCR errors—always run Cleanup
- Some complex layouts may not convert perfectly

## Dependencies

**Runtime:**
- `openai` - OpenAI API client
- `@opendocsg/pdf2md` - PDF to markdown conversion
- `idb` - IndexedDB wrapper
- `marked` - Markdown rendering
- `@mohtasham/md-to-docx` - Word document export

**Development:**
- `jest` / `vitest` - Testing frameworks
- `playwright` - Browser testing
- `svelte` / `sveltekit` - Web framework
- `tailwindcss` - Styling
