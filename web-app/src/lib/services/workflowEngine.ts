// Workflow engine for orchestrating the complete PDF-to-translation pipeline
// Chains: PDF Conversion → Cleanup → Translation

import { createPdfConverter } from './pdfConverter';
import { chunkBySize } from './chunker';
import { createRectifier } from './rectifier';
import { rectifyDocument, type RectificationProgress } from './rectificationEngine';
import { createTranslator } from './translator';
import { translateDocument, type TranslationProgress } from './translationEngine';
import type { CleanupSettings, TranslationSettings, WorkflowPhaseId } from '$lib/workflow';

// Progress type that can be from either engine
export type PhaseProgress = RectificationProgress | TranslationProgress;

// Callbacks for workflow orchestration
export interface PhaseCallbacks {
	onPhaseStart?: (phaseId: WorkflowPhaseId) => void;
	onPhaseProgress?: (phaseId: WorkflowPhaseId, progress: PhaseProgress) => void;
	onPhaseComplete?: (phaseId: WorkflowPhaseId, result: string | TranslationOutputs) => void;
	onPhaseError?: (phaseId: WorkflowPhaseId, error: Error) => void;
}

// Options for running the complete workflow
// Either pdfBuffer OR markdownContent must be provided, not both
export interface WorkflowOptions {
	pdfBuffer?: Uint8Array | ArrayBuffer;
	markdownContent?: string;
	apiKey: string;
	cleanupSettings: CleanupSettings;
	translationSettings: TranslationSettings;
	callbacks: PhaseCallbacks;
}

// Translation output structure
export interface TranslationOutputs {
	japaneseOnly: string;
	bilingual: string;
}

// Result of the complete workflow
export interface WorkflowResult {
	markdown: string;
	cleaned: string;
	japaneseOnly: string;
	bilingual: string;
}

/**
 * Assembles Japanese-only markdown from translated chunks
 */
function assembleJapaneseOnly(
	chunks: Array<{ translatedContent: string }>
): string {
	return chunks.map((chunk) => chunk.translatedContent).join('\n\n');
}

/**
 * Assembles bilingual markdown from translated chunks
 */
function assembleBilingual(
	chunks: Array<{ originalContent: string; translatedContent: string }>
): string {
	if (chunks.length === 0) return '';

	return chunks
		.map((chunk) => `${chunk.originalContent}\n\n---\n\n${chunk.translatedContent}`)
		.join('\n\n---\n\n');
}

/**
 * Assembles rectified markdown from cleaned chunks
 */
function assembleRectified(
	chunks: Array<{ rectifiedContent: string }>
): string {
	return chunks.map((chunk) => chunk.rectifiedContent).join('\n\n');
}

/**
 * Runs the complete workflow: PDF → Markdown → Cleanup → Translation
 * For markdown input, skips the convert phase and starts with cleanup.
 */
export async function runWorkflow(options: WorkflowOptions): Promise<WorkflowResult> {
	const {
		pdfBuffer,
		markdownContent,
		apiKey,
		cleanupSettings,
		translationSettings,
		callbacks
	} = options;

	// Validate input: must provide exactly one of pdfBuffer or markdownContent
	if (!pdfBuffer && !markdownContent) {
		throw new Error('Either pdfBuffer or markdownContent must be provided');
	}
	if (pdfBuffer && markdownContent) {
		throw new Error('Cannot provide both pdfBuffer and markdownContent');
	}

	const {
		onPhaseStart,
		onPhaseProgress,
		onPhaseComplete,
		onPhaseError
	} = callbacks;

	let markdown = '';
	let cleaned = '';
	let japaneseOnly = '';
	let bilingual = '';

	// Determine if we're starting from markdown (skip convert phase)
	const isMarkdownInput = !!markdownContent;

	// ============================================
	// Phase 1: Convert PDF to Markdown (skip if markdown input)
	// ============================================
	if (!isMarkdownInput) {
		try {
			onPhaseStart?.('convert');

			const converter = await createPdfConverter();
			markdown = await converter.convertToMarkdown(pdfBuffer!);

			onPhaseComplete?.('convert', markdown);
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			onPhaseError?.('convert', err);
			throw err;
		}
	} else {
		// Use provided markdown content directly
		markdown = markdownContent!;
	}

	// ============================================
	// Phase 2: Cleanup (Rectification)
	// ============================================
	try {
		onPhaseStart?.('cleanup');

		// Chunk the markdown for cleanup
		const cleanupChunks = chunkBySize(markdown, cleanupSettings.chunkSize);

		// Create rectifier with settings
		const rectifier = createRectifier({
			apiKey,
			model: cleanupSettings.model,
			reasoningEffort: cleanupSettings.reasoningEffort
		});

		// Run rectification with progress tracking
		const { rectifiedChunks } = await rectifyDocument(
			cleanupChunks,
			rectifier.rectifyChunk,
			{
				onProgress: (progress) => {
					onPhaseProgress?.('cleanup', progress);
				}
			}
		);

		// Assemble cleaned document
		cleaned = assembleRectified(rectifiedChunks);

		onPhaseComplete?.('cleanup', cleaned);
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		onPhaseError?.('cleanup', err);
		throw err;
	}

	// ============================================
	// Phase 3: Translation
	// ============================================
	try {
		onPhaseStart?.('translate');

		// Chunk the cleaned markdown for translation
		const translateChunks = chunkBySize(cleaned, translationSettings.chunkSize);

		// Create translator with settings
		const translator = createTranslator({
			apiKey,
			model: translationSettings.model,
			contextAware: translationSettings.contextAware,
			reasoningEffort: translationSettings.reasoningEffort,
			targetLanguage: translationSettings.targetLanguage
		});

		// Run translation with progress tracking
		const { translatedChunks } = await translateDocument(
			translateChunks,
			translator.translateChunk,
			{
				onProgress: (progress) => {
					onPhaseProgress?.('translate', progress);
				}
			}
		);

		// Assemble both output versions
		japaneseOnly = assembleJapaneseOnly(translatedChunks);
		bilingual = assembleBilingual(translatedChunks);

		onPhaseComplete?.('translate', { japaneseOnly, bilingual });
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		onPhaseError?.('translate', err);
		throw err;
	}

	return {
		markdown,
		cleaned,
		japaneseOnly,
		bilingual
	};
}
