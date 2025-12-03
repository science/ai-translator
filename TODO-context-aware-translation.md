# Context-Aware Translation System - Implementation Plan

## Problem Statement

The current translation system processes each chunk in complete isolation. This leads to **tone inconsistency** across the translated document:

- Chunk 1 might be translated in casual Japanese (だ/である調)
- Chunk 2 might shift to formal business Japanese (です/ます調)
- Technical terminology may be translated differently across chunks
- Stylistic choices (sentence structure, vocabulary level) vary unpredictably

**Root Cause**: The AI has no visibility into:
1. What came before (English source context)
2. What comes after (English source context)
3. How previous chunks were translated (established Japanese tone/style)

## Proposed Solution: Structured Context Window

Provide the AI with a "context window" that includes:
1. **Previous English chunk** (for narrative/logical context)
2. **Current chunk to translate** (the actual work)
3. **Next English chunk** (for anticipating where the text is going)
4. **Previous Japanese translation** (for tone/style consistency)

### Key Design Decision: JSON Input/Output Format

Using JSON provides clear structural separation that helps the AI discriminate between "reference material" and "work to do":

```json
{
  "context": {
    "previous_english": "...",
    "next_english": "...",
    "previous_japanese_translation": "..."
  },
  "chunk_to_translate": "..."
}
```

Expected output:
```json
{
  "translation": "..."
}
```

**Why JSON over alternatives:**

| Approach | Pros | Cons |
|----------|------|------|
| JSON structured | Clear field separation, explicit labels, LLMs trained on JSON, easy to validate | Slightly more tokens |
| XML-like tags | Familiar to LLMs | Can be ambiguous, harder to parse |
| Markdown sections | Human readable | Too easy for AI to blur boundaries |
| System prompt only | Simple | AI may still translate context |

**Recommendation: JSON input/output** - Modern LLMs handle JSON extremely well and the structural clarity significantly reduces the risk of the AI translating context material.

### Key Design Decision: Use OpenAI Structured Outputs

OpenAI's API provides **Structured Outputs** which guarantees schema-compliant JSON responses. This is superior to basic "JSON mode" and eliminates the need for complex fallback parsing.

**How it works:**
- Set `response_format` with `type: "json_schema"` and a schema definition
- API guarantees output matches the schema (100% adherence on evals)
- GPT-5 models automatically retry up to 2x if schema validation fails
- Supported by all our target models: gpt-4o, gpt-5-mini, gpt-5

**Schema definition:**
```javascript
response_format: {
  type: "json_schema",
  json_schema: {
    name: "translation_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        translation: { type: "string" }
      },
      required: ["translation"],
      additionalProperties: false
    }
  }
}
```

**Benefits:**
- No need for fallback parsing logic (API guarantees valid schema)
- Cleaner code with single `JSON.parse()` call
- Built-in retry on GPT-5 for schema validation failures
- OpenAI explicitly recommends Structured Outputs over basic JSON mode

**Sources:**
- [Structured model outputs - OpenAI API](https://platform.openai.com/docs/guides/structured-outputs)
- [Introducing Structured Outputs in the API | OpenAI](https://openai.com/index/introducing-structured-outputs-in-the-api/)

---

## Implementation Plan

### Phase 1: Core Module Changes

#### 1.1 Update `translateChunk` signature (src/translator.js)

Current:
```javascript
async function translateChunk(chunk, targetLanguage = 'Japanese')
```

New:
```javascript
async function translateChunk(chunk, context = {}, targetLanguage = 'Japanese')
```

Where `context` is:
```javascript
{
  previousEnglish: string | null,      // Previous chunk's English content
  nextEnglish: string | null,          // Next chunk's English content
  previousTranslation: string | null,  // Previous chunk's Japanese output
  documentTitle: string | null,        // Optional: document title for additional context
  isFirstChunk: boolean,               // Is this the first chunk?
  isLastChunk: boolean                 // Is this the last chunk?
}
```

#### 1.2 Create new context-aware system prompt

The prompt must be extremely clear about:
1. **ONLY translate the `chunk_to_translate` field**
2. The context fields are **reference only** - do not translate them
3. Match the tone/style of `previous_japanese_translation` if provided
4. Output must be valid JSON with only a `translation` field

Draft prompt structure:
```
You are a professional translator. You will receive a JSON object with context and a chunk to translate.

CRITICAL RULES:
1. ONLY translate the text in the "chunk_to_translate" field
2. The "context" fields are for REFERENCE ONLY - do NOT translate them
3. Match the writing style and formality level of "previous_japanese_translation" if provided
4. Return ONLY valid JSON: {"translation": "your translation here"}

[... existing translation guidelines ...]

INPUT FORMAT:
{
  "context": {
    "previous_english": "English text that came before (for narrative context)",
    "next_english": "English text that comes after (for anticipating flow)",
    "previous_japanese_translation": "How the previous chunk was translated (match this style)"
  },
  "chunk_to_translate": "THE ONLY TEXT YOU SHOULD TRANSLATE"
}

OUTPUT FORMAT:
{"translation": "Your Japanese translation of ONLY chunk_to_translate"}
```

#### 1.3 Update `translateDocument` (src/translationEngine.js)

Current loop:
```javascript
for (let i = 0; i < chunks.length; i++) {
  const translatedContent = await translateChunkFn(chunk.content);
  ...
}
```

New loop must:
1. Build context object for each chunk
2. Pass context to translateChunk
3. Store translation for use as next chunk's `previousTranslation`

```javascript
let previousTranslation = null;

for (let i = 0; i < chunks.length; i++) {
  const context = {
    previousEnglish: i > 0 ? chunks[i - 1].content : null,
    nextEnglish: i < chunks.length - 1 ? chunks[i + 1].content : null,
    previousTranslation: previousTranslation,
    isFirstChunk: i === 0,
    isLastChunk: i === chunks.length - 1
  };

  const translatedContent = await translateChunkFn(chunk.content, context);
  previousTranslation = translatedContent;
  ...
}
```

### Phase 2: JSON Response Handling

#### 2.1 Add response parsing in translator.js

Since we're using OpenAI Structured Outputs, the API guarantees valid schema-compliant JSON. Parsing is straightforward:

```javascript
function parseTranslationResponse(responseText) {
  const parsed = JSON.parse(responseText);
  return parsed.translation;
}
```

**Note:** With Structured Outputs enabled (`response_format: { type: "json_schema", ... }`), the API guarantees the response matches our schema. If parsing fails, it indicates an API-level issue (not a formatting problem), so we let the error propagate rather than silently falling back.

#### 2.2 Add `response_format` to API request

In the `translateChunk` function, add to `requestParams`:

```javascript
const requestParams = {
  model: model,
  messages: [...],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "translation_response",
      strict: true,
      schema: {
        type: "object",
        properties: {
          translation: { type: "string" }
        },
        required: ["translation"],
        additionalProperties: false
      }
    }
  }
};
```

### Phase 3: Configuration Options

#### 3.1 Add new CLI options

```
--context-window          Enable context-aware translation (default: false for backwards compatibility)
--style-lock              Stronger style matching to first chunk (experimental)
```

#### 3.2 Add web app settings

In Settings page:
- Toggle: "Enable context-aware translation"

### Phase 4: Web App Integration

The web app already imports CLI modules directly:
```typescript
const { createTranslator } = await import('../../../../../src/translator.js');
const { translateDocument } = await import('../../../../../src/translationEngine.js');
```

Changes needed:
1. Pass new options through API endpoint
2. Update streaming progress messages
3. Add UI controls in translate page

### Phase 5: Integration Testing & Validation

**Note:** Unit tests are written during Phases 1-4 as part of TDD red/green cycles. This phase covers testing that requires multiple components to exist.

#### 5.1 Integration tests (test/integration/contextAware.test.js)

These tests exercise the full pipeline and can only be written after core components exist:

- Test full document with context-aware translation (end-to-end)
- Verify no context bleed (context text doesn't appear in output)
- Test CLI with `--context-window` flag
- Test web app API endpoint with context options

#### 5.2 Manual validation

- Translate a test document with clear tone shifts
- Compare output with and without context-aware mode
- Verify tone consistency improvement
- Document any edge cases discovered

---

### TDD Test Specifications (for reference during implementation)

The following unit tests should be written **before** their corresponding implementation code, following the red/green cycle:

**During Phase 1 (translator.js changes):**
- Test context object is properly passed to API
- Test backward compatibility (no context = old behavior)

**During Phase 2 (JSON response handling):**
- Test `response_format` with Structured Outputs schema is included in API request
- Test JSON response parsing extracts `translation` field
- Test parsing error propagates (no silent fallback)

**During Phase 1 (translationEngine.js changes):**
- Test context building across chunk sequence
- Test previousTranslation is properly chained
- Test first/last chunk flags

**During Phase 3 (CLI changes):**
- Test `--context-window` flag parsing
- Test `--style-lock` flag parsing

**During Phase 4 (Web app changes):**
- Test API endpoint accepts context options
- Test settings persistence

---

## Risk Mitigation

### Risk 1: AI translates context material

**Mitigation:**
- JSON structure with explicit field names
- Emphatic prompt instructions
- Post-processing validation (check for duplicated content)
- Integration tests specifically for this

### Risk 2: Increased token usage / cost

**Mitigation:**
- Make context-aware mode opt-in initially
- Document expected cost increase (~2-3x more input tokens per chunk)
- Note: Modern LLM context windows (128K+) easily accommodate full chunks; no truncation needed

### Risk 3: Slower translation

**Mitigation:**
- Context window is relatively small
- No additional API calls (same number of requests)
- Monitor timing in integration tests

### Risk 4: JSON parsing failures

**Mitigation:**
- Using OpenAI Structured Outputs guarantees schema-compliant JSON (100% adherence)
- GPT-5 automatically retries up to 2x on schema validation failure
- If parsing still fails, it's an API-level issue - let error propagate for visibility
- No silent fallbacks that could mask problems

### Risk 5: Breaking existing behavior

**Mitigation:**
- Context parameter is optional with default `{}`
- Existing code continues to work unchanged
- Feature flag for gradual rollout

---

## Alternative Approaches Considered

### Alternative A: Two-Phase Style Extraction

1. First pass: Analyze first 2-3 chunks, extract "style profile"
2. Second pass: Apply style profile as static context to all chunks

**Pros:** Consistent style reference, no growing context
**Cons:** Extra API calls, style may need to evolve within document
**Verdict:** Could be added later as `--style-lock` option

### Alternative B: Full Document Summary Context

Provide a summary of the entire document instead of adjacent chunks.

**Pros:** Global awareness
**Cons:** Loses local narrative context, summary generation is complex
**Verdict:** Not as effective for tone consistency

### Alternative C: Fine-tuned Model

Train a custom model on parallel corpus with consistent style.

**Pros:** Best possible consistency
**Cons:** Expensive, requires training data, maintenance burden
**Verdict:** Out of scope for this project

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/translator.js` | Modify | New signature, JSON prompt, response parsing |
| `src/translationEngine.js` | Modify | Context building, translation chaining |
| `src/cli.js` | Modify | New CLI options |
| `web-app/src/routes/api/translate/+server.ts` | Modify | Pass context options |
| `web-app/src/routes/translate/+page.svelte` | Modify | UI controls for context options |
| `web-app/src/routes/settings/+page.svelte` | Modify | Context settings |
| `test/translator.test.js` | Modify | New test cases |
| `test/translationEngine.test.js` | Modify | New test cases |
| `test/integration/contextAware.test.js` | New | Integration tests |

---

## Implementation Order

Each phase follows TDD: write failing test → implement → verify pass → refactor.

1. **Phase 1.1-1.2**: Update translator.js (prompt + signature + JSON input) ✅ DONE
2. **Phase 2**: JSON response parsing in translator.js ✅ DONE
3. **Phase 1.3**: Update translationEngine.js (context building + chaining) ✅ DONE
4. **Phase 3.1**: CLI `--no-context` option ✅ DONE
5. **Phase 4**: Web app API and UI integration ✅ DONE
6. **Phase 3.2**: Web app settings UI ✅ DONE
7. **Phase 5**: Integration tests and manual validation (full pipeline verification)

---

## Success Criteria

1. Translated documents show consistent tone throughout
2. No context material appears in translated output
3. Existing non-context-aware translation continues to work
4. Test suite passes with >95% coverage of new code
5. Web app and CLI both support the feature

---

## Nuanced Requirements

1. **Default behavior**: The web app and CLI should both use this context-aware strategy by default. There should be a flag to opt-out in CLI, and a Settings option to opt out in web app. This opt-out flag does not need to revert to the original translation behavior: it can simply suppress the context text json fields and the prompt instructions/schema information about them.


---

## Notes

- This plan follows TDD methodology per CLAUDE.md
- Each phase should have tests written BEFORE implementation
