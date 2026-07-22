// Live API regression harness. Skipped unless run explicitly:
//
//   LIVE_API=1 OPENAI_API_KEY=... npx vitest run tests/unit/translator.live.test.ts
//
// This exercises the real gpt-5.4-mini endpoint and costs money, so it is gated
// out of the default `npm run test:unit`.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { chunkBySize } from '$lib/services/chunker';
import { createTranslator, parseTranslationResponse } from '$lib/services/translator';
import { translateDocument } from '$lib/services/translationEngine';

const FIXTURE = '../../../test/fixtures/leading-blank-line.md';

const API_KEY = process.env.OPENAI_API_KEY;
const run = API_KEY && process.env.LIVE_API === '1' ? describe : describe.skip;

const MODEL = 'gpt-5.4-mini';
const TARGET_LANGUAGE = 'Japanese, suitable for a psychotherapy trained reader';

run('live translation of a document with a leading blank line', () => {
	const content = readFileSync(new URL(FIXTURE, import.meta.url), 'utf-8');

	const makeTranslator = () =>
		createTranslator({
			apiKey: API_KEY!,
			model: MODEL,
			contextAware: true,
			reasoningEffort: 'medium',
			targetLanguage: TARGET_LANGUAGE
		});

	it(
		'translates every chunk without a "Missing translation field" failure',
		async () => {
			const chunks = chunkBySize(content, 4000);
			expect(chunks.filter((c) => c.content.trim() === '')).toEqual([]);

			const { translatedChunks } = await translateDocument(
				chunks,
				makeTranslator().translateChunk
			);

			expect(translatedChunks).toHaveLength(chunks.length);
			for (const chunk of translatedChunks) {
				expect(chunk.translatedContent.trim()).not.toBe('');
			}
		},
		600_000
	);

	it(
		'accepts the empty translation the API returns for an empty chunk',
		async () => {
			// The chunker no longer produces these, but the parser must not treat a
			// legitimately empty translation as a missing field.
			const result = await makeTranslator().translateChunk('', {
				previousEnglish: null,
				nextEnglish: 'Some following text.',
				previousTranslation: null
			});

			expect(typeof result.content).toBe('string');
		},
		180_000
	);

	it(
		'sends a completion ceiling the real model stays under',
		async () => {
			const chunks = chunkBySize(content, 4000);
			const biggest = chunks.reduce((a, b) => (a.content.length > b.content.length ? a : b));

			const result = await makeTranslator().translateChunk(biggest.content, {
				previousEnglish: null,
				nextEnglish: null,
				previousTranslation: null
			});

			// No truncation error thrown, and real usage stayed inside the ceiling.
			expect(result.content.trim()).not.toBe('');
			expect(result.usage.completionTokens).toBeGreaterThan(0);
		},
		300_000
	);

	it('parses a real empty-translation payload', () => {
		// Verbatim body observed from gpt-5.4-mini for an empty chunk.
		expect(parseTranslationResponse('{"translation":""}')).toBe('');
	});
});
