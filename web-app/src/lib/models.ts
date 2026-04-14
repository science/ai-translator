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
		id: 'gpt-5.4',
		label: 'gpt-5.4',
		series: 5,
		defaultReasoningEffort: 'none',
		supportedReasoningEfforts: ['none', 'low', 'medium', 'high']
	},
	{
		id: 'gpt-5.4-mini',
		label: 'gpt-5.4-mini',
		series: 5,
		defaultReasoningEffort: 'medium',
		supportedReasoningEfforts: ['none', 'low', 'medium', 'high']
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
export const DEFAULT_MODEL = 'gpt-5.4-mini';

/**
 * Check if a model is part of the GPT-5 series.
 */
export function is5SeriesModel(modelId: string): boolean {
	return modelId.startsWith('gpt-5');
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
 * All GPT-5.4 models support: none, low, medium, high
 * GPT-5.4 defaults to "none", GPT-5.4-mini defaults to "medium"
 * GPT-4.x: no reasoning effort support
 */
export function getValidReasoningEffort(
	modelId: string,
	requestedEffort: string | undefined
): string | null {
	if (!is5SeriesModel(modelId)) {
		return null;
	}

	if (!requestedEffort) {
		const model = getModelById(modelId);
		return model?.defaultReasoningEffort || 'none';
	}

	return requestedEffort;
}
