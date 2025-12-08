// Browser-compatible translator service
// Ported from CLI's src/translator.js

import { createOpenAIClient } from './openai';

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
}

export interface Translator {
	translateChunk: (
		chunk: string,
		context?: TranslationContext,
		targetLanguage?: string
	) => Promise<string>;
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

	// Helper to check if model is GPT-5.1 family (supports "none", not "minimal")
	function isGpt51Model(modelName: string): boolean {
		return /gpt-5\.1/.test(modelName);
	}

	// Helper to get valid reasoning_effort for the model
	// GPT-5.1: supports none, low, medium, high (default: none)
	// GPT-5/5-mini/5-nano: supports minimal, low, medium, high (default: medium)
	function getValidReasoningEffort(modelName: string, requestedEffort?: string): string {
		const isGpt51 = isGpt51Model(modelName);

		if (isGpt51) {
			// GPT-5.1 defaults to "none" and doesn't support "minimal"
			if (!requestedEffort) return 'none';
			if (requestedEffort === 'minimal') return 'none';
			return requestedEffort;
		} else {
			// GPT-5/5-mini/5-nano default to "medium" and don't support "none"
			if (!requestedEffort) return 'medium';
			if (requestedEffort === 'none') return 'minimal';
			return requestedEffort;
		}
	}

	const reasoningEffort = getValidReasoningEffort(model, options.reasoningEffort);

	async function translateChunk(
		chunk: string,
		context: TranslationContext = {},
		targetLanguage?: string
	): Promise<string> {
		const language = targetLanguage || defaultTargetLanguage;
		const systemPrompt = contextAware
			? getContextAwareSystemPrompt(language)
			: getLegacySystemPrompt(language);

		const userContent = contextAware ? buildContextMessage(chunk, context) : chunk;

		const requestOptions: Parameters<typeof client.createChatCompletion>[0] = {
			model,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userContent }
			]
		};

		if (contextAware) {
			requestOptions.response_format = RESPONSE_FORMAT_SCHEMA;
		}

		if (model.startsWith('gpt-5')) {
			requestOptions.verbosity = verbosity;
			requestOptions.reasoning_effort = reasoningEffort;
		}

		const response = await client.createChatCompletion(requestOptions);

		if (!response.choices || response.choices.length === 0) {
			throw new Error('Invalid response from OpenAI API');
		}

		const rawContent = response.choices[0].message.content;

		if (contextAware) {
			return parseTranslationResponse(rawContent);
		}

		return rawContent;
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
	const parsed = JSON.parse(responseText.trim());
	if (!parsed.translation) {
		throw new Error('Missing translation field in response');
	}
	return parsed.translation;
}
