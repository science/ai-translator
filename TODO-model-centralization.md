# TODO: Centralize Model Configuration and Update to gpt-5.2

## Overview
This plan centralizes the model list across both the CLI tool and web-app, then updates gpt-5.1 to gpt-5.2. Currently models are hardcoded in 8+ files with identical dropdown options duplicated across 4 Svelte pages.

## Current State Analysis

### Models Currently Defined
- `gpt-5.1` - The premium GPT-5 model (to be replaced with gpt-5.2)
- `gpt-5-mini` - Smaller/faster GPT-5 model (keeping as is)
- `gpt-4.1` - GPT-4 series
- `gpt-4.1-mini` - Smaller GPT-4 model

### Files with Hardcoded Models

**CLI Tool (root project):**
- `src/cli.js:7` - Default model: `gpt-5-mini`
- `src/translator.js:33` - Fallback model: `gpt-4o`
- `src/translator.js:40` - GPT-5.1 detection: `/gpt-5\.1/.test()`
- `src/translator.js:230` - GPT-5 detection: `model.startsWith('gpt-5')`
- `src/rectifier.js:33` - Fallback model: `gpt-4o`
- `src/rectifier.js:38` - GPT-5.1 detection: `/gpt-5\.1/.test()`
- `src/rectifier.js:153` - GPT-5 detection

**Web-App:**
- `src/routes/settings/+page.svelte:14,24,27,232-235` - Default, detection, dropdown
- `src/routes/translate/+page.svelte:42,101,104,389-392` - Default, detection, dropdown
- `src/routes/cleanup/+page.svelte:36,78,227-230` - Default, detection, dropdown
- `src/routes/workflow/+page.svelte:48,51,68-73,426-429,521-524` - Defaults, detection, dropdowns (x2)
- `src/lib/workflow.ts:67,73` - Default settings

**Test Files:**
- Multiple test files in `test/` and `web-app/tests/` reference specific models

---

## Implementation Plan

### Phase 1: Create Centralized Model Configuration (CLI)

#### Step 1.1: Write failing tests for models.js
Create `test/models.test.js` with tests for:
- [ ] Exports a list of available models
- [ ] Each model has required properties: `id`, `label`, `series` (4, 5)
- [ ] Exports `DEFAULT_MODEL` constant (`gpt-5-mini`)
- [ ] Exports `is5SeriesModel(modelId)` helper function
- [ ] Exports `isGpt52Model(modelId)` helper function (for gpt-5.2 specific logic)
- [ ] Model list includes gpt-5.2, gpt-5-mini, gpt-4.1, gpt-4.1-mini (not gpt-5.1)

#### Step 1.2: Implement src/models.js
- [ ] Create model list with metadata
- [ ] Implement helper functions
- [ ] Export constants

#### Step 1.3: Update CLI modules to use centralized config
- [ ] Update `src/cli.js` to import DEFAULT_MODEL
- [ ] Update `src/translator.js` to import helpers
- [ ] Update `src/rectifier.js` to import helpers
- [ ] Verify existing tests still pass

### Phase 2: Create Centralized Model Configuration (Web-App)

#### Step 2.1: Write failing tests for lib/models.ts
Create `web-app/src/lib/models.ts` tests:
- [ ] Same structure as CLI models.js
- [ ] TypeScript types for model metadata
- [ ] Exports work correctly in Svelte context

#### Step 2.2: Implement web-app/src/lib/models.ts
- [ ] Create TypeScript model configuration
- [ ] Export model list, helpers, and defaults

#### Step 2.3: Update Svelte pages to use centralized config
- [ ] Update `settings/+page.svelte`
- [ ] Update `translate/+page.svelte`
- [ ] Update `cleanup/+page.svelte`
- [ ] Update `workflow/+page.svelte`
- [ ] Update `lib/workflow.ts`

### Phase 3: Update Model from gpt-5.1 to gpt-5.2

#### Step 3.1: Update model detection logic
- [ ] Change regex from `/gpt-5\.1/` to `/gpt-5\.2/`
- [ ] Update reasoning effort handling (gpt-5.2 may have different defaults than gpt-5.1)
- [ ] Update CLI tests
- [ ] Update web-app tests

#### Step 3.2: Update all test fixtures and assertions
- [ ] Update CLI test files referencing gpt-5.1
- [ ] Update web-app test files referencing gpt-5.1
- [ ] Run full test suites to verify

### Phase 4: Final Verification

- [ ] Run CLI tests: `npm test`
- [ ] Run web-app unit tests: `cd web-app && npm run test:unit`
- [ ] Run web-app e2e tests: `cd web-app && npm run test:e2e`
- [ ] Update documentation (CLAUDE.md, README.md)

---

## Model Metadata Structure

```javascript
// src/models.js
export const MODELS = [
  {
    id: 'gpt-5.2',
    label: 'gpt-5.2',
    series: 5,
    isLatestPremium: true,
    defaultReasoningEffort: 'none',  // gpt-5.2 defaults like gpt-5.1 did
    supportedReasoningEfforts: ['none', 'low', 'medium', 'high']
  },
  {
    id: 'gpt-5-mini',
    label: 'gpt-5-mini',
    series: 5,
    isLatestPremium: false,
    defaultReasoningEffort: 'medium',
    supportedReasoningEfforts: ['minimal', 'low', 'medium', 'high']
  },
  {
    id: 'gpt-4.1',
    label: 'gpt-4.1',
    series: 4,
    isLatestPremium: false,
    defaultReasoningEffort: null,  // No reasoning effort for GPT-4
    supportedReasoningEfforts: null
  },
  {
    id: 'gpt-4.1-mini',
    label: 'gpt-4.1-mini',
    series: 4,
    isLatestPremium: false,
    defaultReasoningEffort: null,
    supportedReasoningEfforts: null
  }
];

export const DEFAULT_MODEL = 'gpt-5-mini';

export function is5SeriesModel(modelId) {
  return modelId.startsWith('gpt-5');
}

export function isGpt52Model(modelId) {
  return /gpt-5\.2/.test(modelId);
}

export function getModelById(modelId) {
  return MODELS.find(m => m.id === modelId);
}
```

---

## Key Considerations

### GPT-5.2 vs GPT-5.1 Reasoning Effort
- GPT-5.1 used: `none`, `low`, `medium`, `high` (default: `none`)
- GPT-5.2 should use the same pattern (assumed same API behavior)
- GPT-5-mini uses: `minimal`, `low`, `medium`, `high` (default: `medium`)
- GPT-4.x models don't use reasoning effort

### Breaking Change Mitigation
- Keep `is5SeriesModel()` working for all gpt-5.* models
- Add specific `isGpt52Model()` for 5.2-specific logic
- Model detection logic should still work for any future gpt-5.x models

### TDD Approach
Each step will follow red/green methodology:
1. Write failing test for specific behavior
2. Run test to prove it fails (RED)
3. Implement minimal code to pass (GREEN)
4. Refactor if needed
5. Move to next test
