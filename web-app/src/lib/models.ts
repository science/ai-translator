/**
 * Centralized model configuration for the book-translate web app.
 *
 * To add or update models:
 * 1. Add/modify entries in the MODELS array
 * 2. Update DEFAULT_MODEL if needed
 * 3. Run tests: npm run test:unit -- --run tests/unit/models.test.ts
 *
 * Model properties:
 * - id: The model identifier used in API calls
 * - label: Display label for UI dropdowns
 * - series: Model series number (4 or 5)
 * - defaultReasoningEffort: Default reasoning effort for GPT-5 models (null for GPT-4)
 * - supportedReasoningEfforts: Array of valid reasoning effort values (null for GPT-4)
 */

export interface Model {
	id: string;
	label: string;
	series: number;
	defaultReasoningEffort: string | null;
	supportedReasoningEfforts: string[] | null;
}

export interface ReasoningEffortOption {
	value: string;
	label: string;
}

export const MODELS: Model[] = [
	{
		id: 'gpt-5.2',
		label: 'gpt-5.2',
		series: 5,
		defaultReasoningEffort: 'none',
		supportedReasoningEfforts: ['none', 'low', 'medium', 'high']
	},
	{
		id: 'gpt-5-mini',
		label: 'gpt-5-mini',
		series: 5,
		defaultReasoningEffort: 'medium',
		supportedReasoningEfforts: ['minimal', 'low', 'medium', 'high']
	},
	{
		id: 'gpt-4.1',
		label: 'gpt-4.1',
		series: 4,
		defaultReasoningEffort: null,
		supportedReasoningEfforts: null
	},
	{
		id: 'gpt-4.1-mini',
		label: 'gpt-4.1-mini',
		series: 4,
		defaultReasoningEffort: null,
		supportedReasoningEfforts: null
	}
];

/**
 * Default model used when none is specified.
 */
export const DEFAULT_MODEL = 'gpt-5-mini';

/**
 * Check if a model is part of the GPT-5 series.
 */
export function is5SeriesModel(modelId: string): boolean {
	return modelId.startsWith('gpt-5');
}

/**
 * Check if a model is specifically GPT-5.2 family.
 * GPT-5.2 uses 'none' as lowest reasoning effort instead of 'minimal'.
 */
export function isGpt52Model(modelId: string): boolean {
	return /gpt-5\.2/.test(modelId);
}

/**
 * Get a model by its ID.
 */
export function getModelById(modelId: string): Model | undefined {
	return MODELS.find((m) => m.id === modelId);
}

/**
 * Get reasoning effort options for a model (for UI dropdowns).
 */
export function getReasoningEffortOptions(modelId: string): ReasoningEffortOption[] | null {
	const model = getModelById(modelId);

	if (!model || !model.supportedReasoningEfforts) {
		return null;
	}

	return model.supportedReasoningEfforts.map((value) => ({
		value,
		label: value.charAt(0).toUpperCase() + value.slice(1)
	}));
}

/**
 * Get valid reasoning effort for a model, converting between formats if needed.
 * GPT-5.2: supports none, low, medium, high (default: none)
 * GPT-5/5-mini/5-nano: supports minimal, low, medium, high (default: medium)
 * GPT-4.x: no reasoning effort support
 */
export function getValidReasoningEffort(
	modelId: string,
	requestedEffort: string | undefined
): string | null {
	if (!is5SeriesModel(modelId)) {
		return null;
	}

	const isGpt52 = isGpt52Model(modelId);

	if (isGpt52) {
		// GPT-5.2 defaults to "none" and doesn't support "minimal"
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
