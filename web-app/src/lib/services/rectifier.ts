// Browser-compatible rectifier service
// Ported from CLI's src/rectifier.js

import { createOpenAIClient } from './openai';
import { is5SeriesModel, getValidReasoningEffort as getModelReasoningEffort } from '../models';

export interface RectifierOptions {
	apiKey: string;
	model?: string;
	verbosity?: string;
	reasoningEffort?: string;
	maxRetries?: number;
}

export interface Rectifier {
	rectifyChunk: (chunk: string) => Promise<string>;
}

/**
 * Gets the system prompt for rectification
 */
export function getSystemPrompt(): string {
	return `You are a professional text rectifier specializing in fixing OCR and PDF-to-markdown conversion errors.

Your task is to correct English text that has been poorly converted from PDF to markdown format, while preserving the original meaning and markdown structure.

Rectification Guidelines:
1. Fix OCR errors:
   - Correct missing or wrong first letters (e.g., "ontents" → "Contents", "tae" → "The", "Joreface" → "Preface")
   - Fix broken spacing (e.g., "Ww hile" → "While")
   - Correct obvious typos and character recognition errors

2. Remove PDF artifacts and gibberish:
   - Delete page numbers that appear mid-text
   - Remove footer markers (e.g., "Preface xxi") that break paragraph flow
   - Delete random character strings that are clearly OCR noise (e.g., "26 Gimam & eo. @ 7 Wat")
   - Remove code block markers (\`\`\`) that are OCR artifacts, not actual code

3. Restore paragraph flow:
   - Remove page breaks and footer markers that split paragraphs
   - Rejoin text that should be continuous
   - Maintain proper paragraph separation where intended

4. Preserve markdown structure:
   - Keep all legitimate headers (# ## ###)
   - Preserve emphasis (bold, italics)
   - Maintain lists and formatting
   - Keep actual code blocks that are part of the content

5. Preserve legitimate content:
   - Do NOT remove, summarize, or condense actual content
   - Keep all proper nouns, citations, and references
   - Maintain the original meaning exactly
   - Preserve all chapter numbers, section markers, and page references that are part of the content structure

CRITICAL: Output Format:
- Return ONLY the corrected English text in your response
- Do NOT add labels like "[Original]", "[Corrected]", or any meta-commentary
- Do NOT explain what you fixed
- Output must be pure, clean markdown text
- Match the paragraph structure and formatting of the intended document

CRITICAL: Complete Rectification:
- Every visible error must be corrected
- No OCR artifacts should remain in the output
- The text should read naturally and correctly
- A reader should not be able to tell the text was ever corrupted`;
}

/**
 * Creates a browser-compatible rectifier
 */
export function createRectifier(options: RectifierOptions): Rectifier {
	if (!options.apiKey || options.apiKey.trim() === '') {
		throw new Error('API key is required');
	}

	const client = createOpenAIClient({
		apiKey: options.apiKey,
		maxRetries: options.maxRetries
	});

	const model = options.model || 'gpt-4o';
	const verbosity = options.verbosity || 'low';

	// Use centralized reasoning effort logic from models.ts
	const reasoningEffort = getModelReasoningEffort(model, options.reasoningEffort) || 'medium';

	async function rectifyChunk(chunk: string): Promise<string> {
		const systemPrompt = getSystemPrompt();

		const requestOptions: Parameters<typeof client.createChatCompletion>[0] = {
			model,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: chunk }
			]
		};

		if (is5SeriesModel(model)) {
			requestOptions.verbosity = verbosity;
			requestOptions.reasoning_effort = reasoningEffort;
		}

		const response = await client.createChatCompletion(requestOptions);

		if (!response.choices || response.choices.length === 0) {
			throw new Error('Invalid response from OpenAI API');
		}

		return response.choices[0].message.content;
	}

	return {
		rectifyChunk
	};
}
