import { describe, it, expect } from 'vitest';
import {
	createDeterminateProgress,
	createIndeterminateProgress,
	updateProgress,
	addActivity,
	completeProgress,
	resetProgress,
	parseProgressEvent,
	type ProgressState,
	type DeterminateProgress,
	type IndeterminateProgress
} from '$lib/progress';

describe('Progress Utilities', () => {
	describe('createDeterminateProgress', () => {
		it('creates a determinate progress state with 0%', () => {
			const state = createDeterminateProgress('Starting...');
			expect(state.type).toBe('determinate');
			expect(state.percentage).toBe(0);
			expect(state.message).toBe('Starting...');
			expect(state.isActive).toBe(true);
		});

		it('creates with optional initial percentage', () => {
			const state = createDeterminateProgress('Processing', 25);
			expect(state.percentage).toBe(25);
			expect(state.message).toBe('Processing');
		});
	});

	describe('createIndeterminateProgress', () => {
		it('creates an indeterminate progress state', () => {
			const state = createIndeterminateProgress('Loading...');
			expect(state.type).toBe('indeterminate');
			expect(state.message).toBe('Loading...');
			expect(state.activities).toEqual([]);
			expect(state.isActive).toBe(true);
		});
	});

	describe('updateProgress', () => {
		it('updates percentage and message for determinate progress', () => {
			const initial = createDeterminateProgress('Starting');
			const updated = updateProgress(initial, { percentage: 50, message: 'Halfway' });

			expect(updated.percentage).toBe(50);
			expect(updated.message).toBe('Halfway');
			expect(updated.isActive).toBe(true);
		});

		it('clamps percentage to 0-100 range', () => {
			const initial = createDeterminateProgress('Test');

			const overMax = updateProgress(initial, { percentage: 150 });
			expect(overMax.percentage).toBe(100);

			const underMin = updateProgress(initial, { percentage: -10 });
			expect(underMin.percentage).toBe(0);
		});

		it('only updates provided fields', () => {
			const initial = createDeterminateProgress('Original', 25);
			const updated = updateProgress(initial, { percentage: 50 });

			expect(updated.percentage).toBe(50);
			expect(updated.message).toBe('Original');
		});
	});

	describe('addActivity', () => {
		it('adds activity to indeterminate progress', () => {
			const initial = createIndeterminateProgress('Processing');
			const updated = addActivity(initial, 'Extracting text...');

			expect(updated.activities).toHaveLength(1);
			expect(updated.activities[0]).toBe('Extracting text...');
			expect(updated.message).toBe('Extracting text...');
		});

		it('keeps last N activities (max 5)', () => {
			let state = createIndeterminateProgress('Start');
			for (let i = 1; i <= 7; i++) {
				state = addActivity(state, `Activity ${i}`);
			}

			expect(state.activities).toHaveLength(5);
			expect(state.activities[0]).toBe('Activity 3');
			expect(state.activities[4]).toBe('Activity 7');
		});
	});

	describe('completeProgress', () => {
		it('marks determinate progress as complete at 100%', () => {
			const initial = createDeterminateProgress('Processing', 75);
			const completed = completeProgress(initial, 'Done!');

			expect(completed.percentage).toBe(100);
			expect(completed.message).toBe('Done!');
			expect(completed.isActive).toBe(false);
		});

		it('marks indeterminate progress as inactive', () => {
			const initial = createIndeterminateProgress('Loading');
			const completed = completeProgress(initial, 'Complete');

			expect(completed.isActive).toBe(false);
			expect(completed.message).toBe('Complete');
		});
	});

	describe('resetProgress', () => {
		it('creates an idle progress state', () => {
			const state = resetProgress();

			expect(state.type).toBe('idle');
			expect(state.isActive).toBe(false);
			expect(state.message).toBe('');
		});
	});

	describe('cost data', () => {
		it('creates determinate progress without cost data by default', () => {
			const state = createDeterminateProgress('Processing');
			expect(state.costData).toBeUndefined();
		});

		it('creates determinate progress with cost data when provided', () => {
			const costData = {
				tokensUsed: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
				estimatedCost: 0.50,
				actualCostSoFar: 0.25
			};
			const state = createDeterminateProgress('Processing', 50, costData);
			expect(state.costData).toEqual(costData);
		});

		it('updates cost data in determinate progress', () => {
			const initialCostData = {
				tokensUsed: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
				estimatedCost: 0.50,
				actualCostSoFar: 0.15
			};
			const initial = createDeterminateProgress('Processing', 50, initialCostData);

			const updatedCostData = {
				tokensUsed: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
				estimatedCost: 0.50,
				actualCostSoFar: 0.30
			};
			const updated = updateProgress(initial, { percentage: 75, costData: updatedCostData });

			expect(updated.costData).toEqual(updatedCostData);
		});

		it('preserves cost data when updating only percentage', () => {
			const costData = {
				tokensUsed: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
				estimatedCost: 0.50,
				actualCostSoFar: 0.25
			};
			const initial = createDeterminateProgress('Processing', 50, costData);
			const updated = updateProgress(initial, { percentage: 75 });

			expect(updated.costData).toEqual(costData);
		});
	});

	describe('parseProgressEvent', () => {
		it('parses progress event with percentage', () => {
			const data = '{"type":"progress","percentage":50,"message":"Processing chunk 2/4"}';
			const event = parseProgressEvent(data);

			expect(event?.type).toBe('progress');
			expect(event?.percentage).toBe(50);
			expect(event?.message).toBe('Processing chunk 2/4');
		});

		it('parses activity event without percentage', () => {
			const data = '{"type":"activity","message":"Extracting metadata..."}';
			const event = parseProgressEvent(data);

			expect(event?.type).toBe('activity');
			expect(event?.message).toBe('Extracting metadata...');
			expect(event?.percentage).toBeUndefined();
		});

		it('parses complete event with result', () => {
			const data = '{"type":"complete","markdown":"# Result"}';
			const event = parseProgressEvent(data);

			expect(event?.type).toBe('complete');
			expect(event?.markdown).toBe('# Result');
		});

		it('parses error event', () => {
			const data = '{"type":"error","error":"Something went wrong"}';
			const event = parseProgressEvent(data);

			expect(event?.type).toBe('error');
			expect(event?.error).toBe('Something went wrong');
		});

		it('returns null for invalid JSON', () => {
			const event = parseProgressEvent('not valid json');
			expect(event).toBeNull();
		});

		it('returns null for empty string', () => {
			const event = parseProgressEvent('');
			expect(event).toBeNull();
		});
	});
});
