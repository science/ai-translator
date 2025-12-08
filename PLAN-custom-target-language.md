# Custom Target Language Feature - Implementation Plan

## Overview

Add a configurable target language input that allows users to specify the translation language with optional style modifiers (e.g., "Japanese", "business casual German", "intimate, warm French"). This replaces the hardcoded Japanese-only translation.

## Current Architecture Analysis

### CLI Components
- `src/cli.js`: Parses CLI arguments, currently no language option
- `src/translator.js`: Already supports `targetLanguage` parameter (defaults to 'Japanese')
- `src/translationEngine.js`: Orchestrates translation, passes chunks to translator
- `src/index.js`: Entry point, currently hardcoded output filenames like `-japanese.md`
- `src/assembler.js`: Creates output files with hardcoded `-japanese` naming

### Web App Components
- `web-app/src/routes/translate/+page.svelte`: Translation UI, no language input
- `web-app/src/lib/services/translator.ts`: Already supports `targetLanguage` parameter (defaults to 'Japanese')
- `web-app/src/lib/services/translationEngine.ts`: Passes chunks to translator
- `web-app/src/lib/storage.ts`: IndexedDB storage for documents

### Key Observations
1. **The translator already supports custom target language** - both CLI and web app have the parameter plumbed through
2. **Output filenames are hardcoded** - `-japanese.md` needs to become dynamic
3. **No history mechanism exists** - need to create localStorage-based history
4. **Validation is needed** - the language input is required but needs helpful prompting

---

## Feature Requirements

### 1. Required Language Input
- Text input field for specifying target language/style
- Field is required - cannot start translation without it
- Validation message explains what to enter (e.g., "Enter a language like 'Japanese' or a style like 'formal German'")

### 2. History Dropdown
- Store history of previous language entries (max 10 items)
- Show as dropdown/autocomplete above the input
- Most recent entries first
- Persist across sessions (localStorage for web, config file for CLI)

### 3. Dynamic Output Naming
- Output files named based on language code or short name
- Examples: `book-de.md` for German, `book-fr.md` for French
- For complex styles: extract language code or use first word

### 4. AI-Verified Testing
- Use gpt-5-nano to verify output is in expected language
- Tests for at least 3 languages: German, French, Spanish

---

## Interface Designs

### CLI Interface

```bash
# New required flag: --target-language or --to
node src/index.js book.md --to "Japanese"
node src/index.js book.md --to "business casual German"
node src/index.js book.md --to "intimate, warm French"

# Short form
node src/index.js book.md -t "Spanish"

# Error when missing
$ node src/index.js book.md
Error: Target language is required. Use --to <language> to specify.
Examples:
  --to "Japanese"
  --to "formal German"
  --to "conversational Spanish"
```

### Web App Interface

```
┌─────────────────────────────────────────────────────────┐
│ Translate Document                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Select document to translate:                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ test-book.md                              ▼         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Target Language: *                                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Japanese                                      ▼     │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Recent:                                             │ │
│ │ • Japanese                                          │ │
│ │ • business casual German                            │ │
│ │ • formal French                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Enter a language name (e.g., "Japanese") or style      │
│ (e.g., "business casual German")                       │
│                                                         │
│ [Model: gpt-5-mini ▼]  [Chunk Size: 4000]             │
│                                                         │
│ [ Start Translation ]                                   │
└─────────────────────────────────────────────────────────┘
```

**Validation State (when empty):**
```
Target Language: *
┌─────────────────────────────────────────────────────────┐
│                                              (empty)    │
└─────────────────────────────────────────────────────────┘
⚠️ Required: Enter a target language (e.g., "Japanese",
   "formal German", or "conversational Spanish")
```

---

## Implementation Plan (TDD Approach)

### Phase 1: CLI - Target Language Parameter

#### Step 1.1: CLI Argument Parsing
**Test first:** `test/cli.test.js`
```javascript
test('should parse --to flag for target language', () => {
  const args = ['node', 'index.js', 'test.md', '--to', 'German'];
  const result = parseCliArgs(args);
  expect(result.targetLanguage).toBe('German');
});

test('should throw error when --to is missing', () => {
  const args = ['node', 'index.js', 'test.md'];
  expect(() => parseCliArgs(args)).toThrow(/target language is required/i);
});

test('should accept -t as short form', () => {
  const args = ['node', 'index.js', 'test.md', '-t', 'French'];
  const result = parseCliArgs(args);
  expect(result.targetLanguage).toBe('French');
});
```

**Implementation:** Update `src/cli.js` to:
- Add `--to` / `-t` flag parsing
- Make it required for translation mode (not rectify/pdf-to-md)
- Provide helpful error message

#### Step 1.2: Pass Language Through Pipeline
**Test first:** Integration test
```javascript
test('should pass target language to translator', () => {
  // Mock translator and verify targetLanguage is passed
});
```

**Implementation:** Update `src/index.js` to pass `options.targetLanguage` to translator

#### Step 1.3: Dynamic Output Naming
**Test first:** `test/assembler.test.js`
```javascript
test('should generate language code from target language', () => {
  expect(getLanguageCode('German')).toBe('de');
  expect(getLanguageCode('business casual German')).toBe('de');
  expect(getLanguageCode('French')).toBe('fr');
  expect(getLanguageCode('Unknown Language')).toBe('translated');
});

test('should name output file with language code', () => {
  // Test assembleTranslation with language parameter
});
```

**Implementation:**
- Add `getLanguageCode()` helper function
- Update assembler functions to accept language parameter
- Update `src/index.js` to use dynamic naming

### Phase 2: Web App - Target Language Input

#### Step 2.1: Language Input Component
**Test first:** `web-app/tests/unit/LanguageInput.test.ts`
```typescript
it('should render input field for target language');
it('should show validation error when empty');
it('should hide validation error when filled');
it('should show history dropdown when available');
```

#### Step 2.2: Language History Storage
**Test first:** `web-app/tests/unit/languageHistory.test.ts`
```typescript
it('should store language to history');
it('should limit history to 10 items');
it('should put most recent at top');
it('should persist to localStorage');
it('should load history from localStorage');
```

**Implementation:** Create `web-app/src/lib/languageHistory.ts`

#### Step 2.3: Translate Page Integration
**Test first:** `web-app/tests/e2e/translate.spec.ts`
```typescript
test('translate button is disabled when language is empty');
test('shows validation message when language is empty');
test('enables translate when language is filled');
test('stores language to history after successful translation');
test('shows language history dropdown');
```

**Implementation:** Update `web-app/src/routes/translate/+page.svelte`

#### Step 2.4: Dynamic Document Naming
**Test first:**
```typescript
test('names output document with language code');
test('stores translated document with correct name');
```

### Phase 3: AI Language Verification Tests

#### Step 3.1: Create Language Verification Helper
**File:** `test/helpers/languageVerifier.js`
```javascript
async function verifyLanguage(text, expectedLanguage) {
  // Use gpt-5-nano to verify
  const response = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [{
      role: 'user',
      content: `Is the following text written in ${expectedLanguage}? Answer only "yes" or "no".\n\n${text}`
    }]
  });
  return response.choices[0].message.content.toLowerCase().includes('yes');
}
```

#### Step 3.2: Multi-Language Integration Tests
**File:** `test/integration/multiLanguage.test.js`
```javascript
describe('Multi-language translation', () => {
  test('translates to German', async () => {
    const result = await translateChunk('Hello world', {}, 'German');
    const isGerman = await verifyLanguage(result, 'German');
    expect(isGerman).toBe(true);
  });

  test('translates to French', async () => {
    const result = await translateChunk('Hello world', {}, 'French');
    const isFrench = await verifyLanguage(result, 'French');
    expect(isFrench).toBe(true);
  });

  test('translates to Spanish', async () => {
    const result = await translateChunk('Hello world', {}, 'Spanish');
    const isSpanish = await verifyLanguage(result, 'Spanish');
    expect(isSpanish).toBe(true);
  });
});
```

---

## Language Code Mapping

Common language codes for output file naming:

| Language | Code |
|----------|------|
| Japanese | ja |
| German | de |
| French | fr |
| Spanish | es |
| Italian | it |
| Portuguese | pt |
| Chinese | zh |
| Korean | ko |
| Russian | ru |
| Arabic | ar |
| Dutch | nl |
| Swedish | sv |

For unrecognized languages or complex style descriptions, extract the first recognized language or use "translated" as fallback.

---

## File Changes Summary

### CLI (root project)

| File | Changes |
|------|---------|
| `src/cli.js` | Add `--to`/`-t` flag, make required for translation |
| `src/index.js` | Pass targetLanguage to translator, dynamic output naming |
| `src/assembler.js` | Add getLanguageCode(), update assembleJapaneseOnly to assembleTranslation |
| `test/cli.test.js` | Tests for --to flag |
| `test/assembler.test.js` | Tests for language code extraction |
| `test/integration/multiLanguage.test.js` | New: AI-verified language tests |
| `test/helpers/languageVerifier.js` | New: Helper for AI language verification |

### Web App

| File | Changes |
|------|---------|
| `web-app/src/lib/languageHistory.ts` | New: History management |
| `web-app/src/lib/components/LanguageInput.svelte` | New: Input with history dropdown |
| `web-app/src/routes/translate/+page.svelte` | Add language input, validation, history |
| `web-app/tests/unit/languageHistory.test.ts` | New: History tests |
| `web-app/tests/unit/LanguageInput.test.ts` | New: Component tests |
| `web-app/tests/e2e/translate.spec.ts` | Add language input tests |

---

## Execution Order

1. **Phase 1.1**: CLI argument parsing (RED → GREEN)
2. **Phase 1.2**: Pipeline integration (RED → GREEN)
3. **Phase 1.3**: Dynamic output naming (RED → GREEN)
4. **Phase 2.1**: Language history module (RED → GREEN)
5. **Phase 2.2**: LanguageInput component (RED → GREEN)
6. **Phase 2.3**: Translate page integration (RED → GREEN)
7. **Phase 2.4**: Web app document naming (RED → GREEN)
8. **Phase 3**: AI verification tests (RED → GREEN)

Each phase follows strict TDD:
1. Write failing test
2. Run test to confirm failure
3. Write minimal implementation
4. Run test to confirm pass
5. Refactor if needed
6. Move to next test

---

## Backwards Compatibility

- Existing translations will continue to work
- `--to "Japanese"` produces same output as before
- Web app will default to empty (no default language) to force explicit choice
- Existing documents in IndexedDB unchanged (variant field remains)
