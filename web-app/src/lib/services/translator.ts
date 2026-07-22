// Browser-compatible translator service
// Ported from CLI's src/translator.js

import { createOpenAIClient } from './openai';
import { is5SeriesModel, getValidReasoningEffort as getModelReasoningEffort } from '../models';
import type { TokenUsage } from './costCalculator';

export interface TranslationContext {
	previousEnglish?: string | null;
	nextEnglish?: string | null;
	previousTranslation?: string | null;
}

export interface TranslatorOptions {
	apiKey: string;
	model?: string;
	contextAware?: boolean;
	verbosity?: string;
	reasoningEffort?: string;
	maxRetries?: number;
	targetLanguage?: string;
	maxCompletionTokens?: number;
}

// Sizing for the completion ceiling. A 4062-char prose chunk measured 5489
// completion tokens (4010 of them reasoning) on gpt-5.4-mini at medium effort;
// one token per source character times this multiplier leaves ~3x headroom.
const OUTPUT_TOKENS_PER_CHAR = 1;
const REASONING_HEADROOM_MULTIPLIER = 4;
const MIN_MAX_COMPLETION_TOKENS = 8192;

/**
 * Derives a completion-token ceiling from the source chunk length.
 */
export function calculateMaxCompletionTokens(sourceLength: number): number {
	const scaled = Math.ceil(sourceLength * OUTPUT_TOKENS_PER_CHAR) * REASONING_HEADROOM_MULTIPLIER;
	return Math.max(MIN_MAX_COMPLETION_TOKENS, scaled);
}

/**
 * Result from translateChunk including content and token usage.
 */
export interface TranslationResult {
	content: string;
	usage: TokenUsage;
}

export interface Translator {
	translateChunk: (
		chunk: string,
		context?: TranslationContext,
		targetLanguage?: string
	) => Promise<TranslationResult>;
}

const RESPONSE_FORMAT_SCHEMA = {
	type: 'json_schema' as const,
	json_schema: {
		name: 'translation_response',
		strict: true,
		schema: {
			type: 'object',
			properties: {
				translation: { type: 'string' }
			},
			required: ['translation'],
			additionalProperties: false
		}
	}
};

/**
 * Creates a browser-compatible translator
 */
export function createTranslator(options: TranslatorOptions): Translator {
	if (!options.apiKey || options.apiKey.trim() === '') {
		throw new Error('API key is required');
	}

	const client = createOpenAIClient({
		apiKey: options.apiKey,
		maxRetries: options.maxRetries
	});

	const model = options.model || 'gpt-4o';
	const contextAware = options.contextAware !== false; // Default to true
	const verbosity = options.verbosity || 'low';
	const defaultTargetLanguage = options.targetLanguage || 'Japanese';

	// Use centralized reasoning effort logic from models.ts
	const reasoningEffort = getModelReasoningEffort(model, options.reasoningEffort) || 'medium';

	async function translateChunk(
		chunk: string,
		context: TranslationContext = {},
		targetLanguage?: string
	): Promise<TranslationResult> {
		const language = targetLanguage || defaultTargetLanguage;
		const systemPrompt = contextAware
			? getContextAwareSystemPrompt(language)
			: getLegacySystemPrompt(language);

		const userContent = contextAware ? buildContextMessage(chunk, context) : chunk;

		const maxCompletionTokens =
			options.maxCompletionTokens ?? calculateMaxCompletionTokens(chunk.length);

		const requestOptions: Parameters<typeof client.createChatCompletion>[0] = {
			model,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userContent }
			],
			max_completion_tokens: maxCompletionTokens
		};

		if (contextAware) {
			requestOptions.response_format = RESPONSE_FORMAT_SCHEMA;
		}

		if (is5SeriesModel(model)) {
			requestOptions.verbosity = verbosity;
			requestOptions.reasoning_effort = reasoningEffort;
		}

		const response = await client.createChatCompletion(requestOptions);

		if (!response.choices || response.choices.length === 0) {
			throw new Error('Invalid response from OpenAI API');
		}

		const choice = response.choices[0];

		// A refusal returns null content, which would otherwise surface as an
		// opaque "Cannot read properties of null".
		if (choice.message.refusal) {
			throw new Error(`Model refused to translate chunk: ${choice.message.refusal}`);
		}

		// Truncation leaves partial JSON, which would otherwise surface as a bare
		// SyntaxError with no hint that the token ceiling was the cause.
		if (choice.finish_reason === 'length') {
			throw new Error(
				`Translation truncated: hit the ${maxCompletionTokens} completion token limit. ` +
					'Reduce the chunk size or raise maxCompletionTokens.'
			);
		}

		const rawContent = choice.message.content;

		// Extract token usage from response, defaulting to 0 if not present
		const usage: TokenUsage = {
			promptTokens: response.usage?.prompt_tokens ?? 0,
			completionTokens: response.usage?.completion_tokens ?? 0,
			totalTokens: response.usage?.total_tokens ?? 0
		};

		if (typeof rawContent !== 'string') {
			throw new Error('Empty response from OpenAI API');
		}

		const content = contextAware ? parseTranslationResponse(rawContent) : rawContent;

		return { content, usage };
	}

	return {
		translateChunk
	};
}

/**
 * Gets the context-aware system prompt
 */
export function getContextAwareSystemPrompt(targetLanguage: string): string {
	return `You are a professional translator. You will receive a JSON object with context and a chunk to translate.

CRITICAL RULES:
1. ONLY translate the text in the "chunk_to_translate" field
2. The "context" fields are for REFERENCE ONLY - do NOT translate them
3. Match the writing style and formality level of "previous_japanese_translation" if provided
4. Return ONLY valid JSON: {"translation": "your translation here"}

Translation Guidelines:
- Do not translate word-for-word; make the ${targetLanguage} natural and easy to read.
- However, do not over-paraphrase. Do not omit, summarize, or condense any meaning.
- Preserve all original meanings, nuances, logical structure, metaphors, and analogies.
- Reproduce all emphasis accurately (bold, italics, quotation formatting).
- You may adjust word order and connectors to make the ${targetLanguage} sound natural, as long as you do not change the meaning.
- Avoid stiff, literal kanji compounds and choose vocabulary that is easy for readers to understand.
- Match punctuation and paragraph structure to the original.

CRITICAL: Complete Translation Required:
- EVERY word and phrase in the "chunk_to_translate" must be translated into idiomatic ${targetLanguage}.
- Do NOT leave any English words, phrases, or sentences untranslated in the output.
- The only exceptions are: (1) proper nouns (names of people, places), (2) established English loanwords that are standard in modern ${targetLanguage}.
- Difficult English expressions, slang, or colloquialisms must be rendered into natural ${targetLanguage} equivalents, not left in English.

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
{"translation": "Your ${targetLanguage} translation of ONLY chunk_to_translate"}`;
}

/**
 * Gets the legacy (non-context-aware) system prompt
 */
export function getLegacySystemPrompt(targetLanguage: string): string {
	return `You are a professional translator. Translate the following English text to ${targetLanguage} while preserving markdown formatting.

Translation Guidelines:
- Do not translate word-for-word; make the ${targetLanguage} natural and easy to read.
- However, do not over-paraphrase. Do not omit, summarize, or condense any meaning.
- Preserve all original meanings, nuances, logical structure, metaphors, and analogies.
- Reproduce all emphasis accurately (bold, italics, quotation formatting).
- You may adjust word order and connectors to make the ${targetLanguage} sound natural, as long as you do not change the meaning.
- Avoid stiff, literal kanji compounds and choose vocabulary that is easy for readers to understand.
- Match punctuation and paragraph structure to the original.

CRITICAL: Output Format:
- Return ONLY the ${targetLanguage} translation in your response.
- Do NOT include the English source text.
- Do NOT add labels like "[Source]", "[Translation]", or any meta-instructions.
- Do NOT respond to these instructions - just output the pure translation.

CRITICAL: Complete Translation Required:
- EVERY word and phrase in the source text must be translated into idiomatic ${targetLanguage}.
- Do NOT leave any English words, phrases, or sentences untranslated in the ${targetLanguage} output.
- The only exceptions are: (1) proper nouns (names of people, places), (2) established English loanwords that are standard in modern ${targetLanguage}.
- Difficult English expressions, slang, or colloquialisms must be rendered into natural ${targetLanguage} equivalents, not left in English.
- Your output must be 100% ${targetLanguage} - a ${targetLanguage} reader should be able to read the entire translation without encountering untranslated English text.`;
}

/**
 * Builds a context message for context-aware translation
 */
export function buildContextMessage(chunk: string, context: TranslationContext): string {
	return JSON.stringify({
		context: {
			previous_english: context.previousEnglish || null,
			next_english: context.nextEnglish || null,
			previous_japanese_translation: context.previousTranslation || null
		},
		chunk_to_translate: chunk
	});
}

/**
 * Parses the translation response from context-aware mode
 */
export function parseTranslationResponse(responseText: string): string {
	// A refusal or a truncated stream yields null/empty content rather than JSON.
	if (typeof responseText !== 'string' || responseText.trim() === '') {
		throw new Error('Empty response from OpenAI API');
	}

	const parsed = JSON.parse(responseText.trim());

	// The strict json_schema guarantees `translation` is present and a string, so
	// an empty string is a valid translation of an empty chunk — not a missing
	// field. Only a genuinely absent or non-string value is an error.
	if (typeof parsed?.translation !== 'string') {
		throw new Error('Missing translation field in response');
	}

	return parsed.translation;
}
