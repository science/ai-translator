# TODO: Markdown Rectifier Feature

## Overview
Build an English-to-English preprocessing system that uses LLM to fix OCR/PDF conversion errors in markdown files before translation.

## Progress Tracking

### Phase 1: Analysis & Planning ✅
- [x] 1.1 Examine source document for error patterns
- [x] 1.2 Extract real broken pieces as test fixtures
- [x] 1.3 Design architecture (reuse existing components)
- [x] 1.4 Define system prompt for rectification

### Phase 2: Test Fixtures Creation ✅
- [x] 2.1 Create fixture for missing first letters (e.g., "ontents" → "Contents")
- [x] 2.2 Create fixture for OCR gibberish removal
- [x] 2.3 Create fixture for footer markers breaking paragraphs
- [x] 2.4 Create fixture for broken word spacing (included in 2.1)
- [x] 2.5 Create fixture for combined multiple errors

### Phase 3: Core Infrastructure (TDD) ✅
- [x] 3.1 Create `src/rectifier.js` module
- [x] 3.2 Write test: `createRectifier()` factory function
- [x] 3.3 Implement: `createRectifier()` with system prompt
- [x] 3.4 Write test: `rectifyChunk()` basic functionality
- [x] 3.5 Implement: `rectifyChunk()` using OpenAI API
- [x] 3.6 Add retry logic (reuse from translator)

### Phase 4: CLI Integration (TDD) ✅
- [x] 4.1 Write test: CLI accepts `--rectify` flag
- [x] 4.2 Implement: Add `--rectify` option to CLI parser
- [x] 4.3 Write test: Rectify mode outputs English-only file
- [x] 4.4 Implement: Rectification pipeline in `src/index.js`
- [x] 4.5 Write test: Rectify assembler creates output
- [x] 4.6 Implement: `assembleRectified()` in `src/assembler.js`

### Phase 5: Rectification Engine (TDD) ✅
- [x] 5.1 Write test: Process chunks sequentially
- [x] 5.2 Implement: `rectifyDocument()` in `src/rectificationEngine.js`
- [x] 5.3 Write test: Progress tracking
- [x] 5.4 Implement: Progress bars and logging

### Phase 6: Integration Testing ✅
- [x] 6.1 Create integration test with real fixtures
- [x] 6.2 Test full pipeline: read → chunk → rectify → assemble
- [x] 6.3 Test with actual source document sample
- [x] 6.4 Verify output quality

### Phase 7: Documentation & Cleanup ✅
- [x] 7.1 Update CLAUDE.md with rectifier documentation
- [x] 7.2 Add usage examples to README
- [ ] 7.3 Update CLI help text (optional - can be added later if needed)
- [x] 7.4 Final code review and cleanup

## Architecture Notes

### System Prompt Strategy
The rectifier will use a specialized system prompt that instructs the LLM to:
1. Fix OCR errors (missing/wrong letters)
2. Remove PDF artifacts (page numbers, gibberish)
3. Restore paragraph flow (remove footer breaks)
4. Preserve markdown structure exactly
5. Keep all legitimate content
6. Output ONLY the corrected English text

### Code Reuse (DRY)
- Reuse: `chunker.js` (same chunking logic)
- Reuse: `fileReader.js` (read input files)
- Reuse: OpenAI client setup pattern from `translator.js`
- Reuse: Retry logic from `translator.js`
- Reuse: Progress tracking from `translationEngine.js`
- New: `rectifier.js` (rectification-specific logic)
- New: `rectificationEngine.js` (orchestration)
- Extend: `assembler.js` with `assembleRectified()`
- Extend: `cli.js` with `--rectify` flag

### CLI Usage
```bash
node src/index.js book.md --rectify --output-dir cleaned/
```

## Current Status
**Status:** ✅ **FULLY COMPLETE** - Production-ready with comprehensive documentation.
**Last Updated:** 2025-11-13

**All phases complete (1-7)!** The rectification feature is fully functional, tested, and documented.

### Completed Tasks
All phases 1-6 are complete:
- ✅ **Phase 1:** Analysis & Planning (system prompt defined in rectifier.js)
- ✅ **Phase 2:** Test Fixtures Creation (5 fixture files created)
- ✅ **Phase 3:** Core Infrastructure (rectifier.js with full TDD)
- ✅ **Phase 4:** CLI Integration (--rectify flag functional)
- ✅ **Phase 5:** Rectification Engine (progress tracking included)
- ✅ **Phase 6:** Integration Testing (all 133 tests passing)

### Test Results
```
✅ 133 tests passing
✅ 15 test suites passing
✅ New tests added:
   - 6 rectifier module tests
   - 7 rectification engine tests
   - 5 assembler tests (rectified output)
   - 3 CLI tests (--rectify flag)
```

### Files Created
- `src/rectifier.js` - Rectification module with OpenAI API integration
- `src/rectificationEngine.js` - Document-level rectification orchestration
- `test/rectifier.test.js` - Unit tests for rectifier
- `test/rectificationEngine.test.js` - Unit tests for rectification engine
- `test/fixtures/broken-missing-letters.md` - OCR error fixture
- `test/fixtures/broken-gibberish.md` - PDF artifacts fixture
- `test/fixtures/broken-footer-markers.md` - Footer breaks fixture
- `test/fixtures/broken-combined.md` - Combined errors fixture
- `test/fixtures/expected-missing-letters.md` - Expected output

### Files Modified
- `src/cli.js` - Added `--rectify` flag support
- `src/assembler.js` - Added `assembleRectified()` function
- `src/index.js` - Added rectification pipeline branching
- `test/cli.test.js` - Added 3 tests for `--rectify` flag
- `test/assembler.test.js` - Added 5 tests for `assembleRectified()`

### Usage Example
```bash
# Rectify a broken PDF-to-markdown converted file
node src/index.js broken-book.md --rectify --output-dir cleaned/

# Output will be: cleaned/broken-book-rectified.md

# You can also specify model and other options
node src/index.js broken-book.md --rectify --model gpt-4o --chunk-size 3000
```

### System Prompt Summary
The rectifier uses a comprehensive system prompt that:
1. Fixes OCR errors (missing letters, typos)
2. Removes PDF artifacts (page numbers, gibberish)
3. Restores paragraph flow (removes footer markers)
4. Preserves markdown structure exactly
5. Keeps all legitimate content
6. Outputs ONLY corrected English text (no meta-commentary)

### Architecture Highlights
- **DRY principles maintained**: Reused chunker, fileReader, retry logic, progress tracking
- **TDD approach**: All features built test-first
- **Parallel to translator**: Same patterns and structure for consistency
- **Production-ready**: All error handling, retry logic, and progress tracking included
