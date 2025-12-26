import { describe, it, expect, beforeEach } from 'vitest';
import {
	createWorkflowState,
	createWorkflowPhases,
	updatePhaseStatus,
	getCurrentPhase,
	advancePhase,
	startWorkflow,
	resetWorkflow,
	isWorkflowComplete,
	hasWorkflowError,
	getElapsedTime,
	formatElapsedTime,
	DEFAULT_PHASES,
	DEFAULT_CLEANUP_SETTINGS,
	DEFAULT_TRANSLATION_SETTINGS,
	type WorkflowState
} from '$lib/workflow';

describe('Workflow Utilities', () => {
	describe('createWorkflowState', () => {
		it('creates initial workflow state with default phases', () => {
			const state = createWorkflowState();

			expect(state.phases).toHaveLength(3);
			expect(state.phases[0].id).toBe('convert');
			expect(state.phases[1].id).toBe('cleanup');
			expect(state.phases[2].id).toBe('translate');
		});

		it('creates state with all phases in pending status', () => {
			const state = createWorkflowState();

			state.phases.forEach((phase) => {
				expect(phase.status).toBe('pending');
			});
		});

		it('creates state with correct default settings', () => {
			const state = createWorkflowState();

			expect(state.cleanupSettings).toEqual(DEFAULT_CLEANUP_SETTINGS);
			expect(state.translationSettings).toEqual(DEFAULT_TRANSLATION_SETTINGS);
		});

		it('creates state not running with no source file', () => {
			const state = createWorkflowState();

			expect(state.isRunning).toBe(false);
			expect(state.sourceFile).toBeNull();
			expect(state.currentPhaseIndex).toBe(-1);
		});

		it('creates deep copy of default phases', () => {
			const state1 = createWorkflowState();
			const state2 = createWorkflowState();

			state1.phases[0].status = 'in_progress';

			expect(state2.phases[0].status).toBe('pending');
		});
	});

	describe('updatePhaseStatus', () => {
		let state: WorkflowState;

		beforeEach(() => {
			state = createWorkflowState();
		});

		it('updates phase status by id', () => {
			const updated = updatePhaseStatus(state, 'convert', 'in_progress');

			expect(updated.phases[0].status).toBe('in_progress');
			expect(updated.phases[1].status).toBe('pending');
			expect(updated.phases[2].status).toBe('pending');
		});

		it('updates phase with additional properties', () => {
			const updated = updatePhaseStatus(state, 'convert', 'completed', {
				result: '# Markdown content',
				documentId: 'doc-123'
			});

			expect(updated.phases[0].status).toBe('completed');
			expect(updated.phases[0].result).toBe('# Markdown content');
			expect(updated.phases[0].documentId).toBe('doc-123');
		});

		it('updates phase with error', () => {
			const updated = updatePhaseStatus(state, 'cleanup', 'error', {
				error: 'API rate limit exceeded'
			});

			expect(updated.phases[1].status).toBe('error');
			expect(updated.phases[1].error).toBe('API rate limit exceeded');
		});

		it('does not mutate original state', () => {
			updatePhaseStatus(state, 'convert', 'completed');

			expect(state.phases[0].status).toBe('pending');
		});
	});

	describe('getCurrentPhase', () => {
		it('returns null when no phase is active', () => {
			const state = createWorkflowState();

			expect(getCurrentPhase(state)).toBeNull();
		});

		it('returns first phase when workflow starts', () => {
			const state = startWorkflow(createWorkflowState());
			const current = getCurrentPhase(state);

			expect(current?.id).toBe('convert');
			expect(current?.status).toBe('in_progress');
		});

		it('returns correct phase after advance', () => {
			let state = startWorkflow(createWorkflowState());
			state = updatePhaseStatus(state, 'convert', 'completed');
			state = advancePhase(state);
			const current = getCurrentPhase(state);

			expect(current?.id).toBe('cleanup');
		});
	});

	describe('advancePhase', () => {
		it('moves to next phase', () => {
			let state = startWorkflow(createWorkflowState());
			state = advancePhase(state);

			expect(state.currentPhaseIndex).toBe(1);
			expect(state.phases[1].status).toBe('in_progress');
		});

		it('stops workflow when all phases complete', () => {
			let state = startWorkflow(createWorkflowState());
			state = advancePhase(state); // cleanup
			state = advancePhase(state); // translate
			state = advancePhase(state); // past end

			expect(state.isRunning).toBe(false);
			expect(state.endTime).toBeDefined();
		});
	});

	describe('startWorkflow', () => {
		it('sets workflow to running', () => {
			const state = startWorkflow(createWorkflowState());

			expect(state.isRunning).toBe(true);
			expect(state.startTime).toBeDefined();
		});

		it('sets first phase to in_progress', () => {
			const state = startWorkflow(createWorkflowState());

			expect(state.currentPhaseIndex).toBe(0);
			expect(state.phases[0].status).toBe('in_progress');
		});

		it('clears any previous results', () => {
			let state = createWorkflowState();
			state = updatePhaseStatus(state, 'convert', 'completed', { result: 'old result' });
			state = startWorkflow(state);

			expect(state.phases[0].result).toBeUndefined();
			expect(state.outputs).toEqual({});
		});
	});

	describe('resetWorkflow', () => {
		it('resets all phases to pending', () => {
			let state = startWorkflow(createWorkflowState());
			state = updatePhaseStatus(state, 'convert', 'completed');
			state = resetWorkflow(state);

			state.phases.forEach((phase) => {
				expect(phase.status).toBe('pending');
			});
		});

		it('clears running state and times', () => {
			let state = startWorkflow(createWorkflowState());
			state = resetWorkflow(state);

			expect(state.isRunning).toBe(false);
			expect(state.currentPhaseIndex).toBe(-1);
			expect(state.startTime).toBeUndefined();
			expect(state.endTime).toBeUndefined();
		});

		it('preserves settings', () => {
			let state = createWorkflowState();
			state.cleanupSettings.model = 'gpt-4o';
			state = resetWorkflow(state);

			expect(state.cleanupSettings.model).toBe('gpt-4o');
		});
	});

	describe('isWorkflowComplete', () => {
		it('returns false when phases are pending', () => {
			const state = createWorkflowState();

			expect(isWorkflowComplete(state)).toBe(false);
		});

		it('returns false when some phases are incomplete', () => {
			let state = createWorkflowState();
			state = updatePhaseStatus(state, 'convert', 'completed');
			state = updatePhaseStatus(state, 'cleanup', 'in_progress');

			expect(isWorkflowComplete(state)).toBe(false);
		});

		it('returns true when all phases are completed', () => {
			let state = createWorkflowState();
			state = updatePhaseStatus(state, 'convert', 'completed');
			state = updatePhaseStatus(state, 'cleanup', 'completed');
			state = updatePhaseStatus(state, 'translate', 'completed');

			expect(isWorkflowComplete(state)).toBe(true);
		});
	});

	describe('hasWorkflowError', () => {
		it('returns false when no errors', () => {
			const state = createWorkflowState();

			expect(hasWorkflowError(state)).toBe(false);
		});

		it('returns true when any phase has error', () => {
			let state = createWorkflowState();
			state = updatePhaseStatus(state, 'cleanup', 'error', { error: 'Failed' });

			expect(hasWorkflowError(state)).toBe(true);
		});
	});

	describe('getElapsedTime', () => {
		it('returns 0 when workflow has not started', () => {
			const state = createWorkflowState();

			expect(getElapsedTime(state)).toBe(0);
		});

		it('calculates elapsed time from start', () => {
			const state = createWorkflowState();
			state.startTime = Date.now() - 5000;

			const elapsed = getElapsedTime(state);

			expect(elapsed).toBeGreaterThanOrEqual(5000);
			expect(elapsed).toBeLessThan(6000);
		});

		it('uses endTime when workflow is complete', () => {
			const state = createWorkflowState();
			state.startTime = 1000;
			state.endTime = 6000;

			expect(getElapsedTime(state)).toBe(5000);
		});
	});

	describe('formatElapsedTime', () => {
		it('formats seconds only', () => {
			expect(formatElapsedTime(5000)).toBe('5 seconds');
		});

		it('formats single second', () => {
			expect(formatElapsedTime(1000)).toBe('1 second');
		});

		it('formats minutes and seconds', () => {
			expect(formatElapsedTime(125000)).toBe('2 minutes 5 seconds');
		});

		it('formats single minute', () => {
			expect(formatElapsedTime(61000)).toBe('1 minute 1 second');
		});
	});

	describe('createWorkflowPhases', () => {
		it('returns 3 phases when skipConvert is false', () => {
			const phases = createWorkflowPhases(false);

			expect(phases).toHaveLength(3);
			expect(phases[0].id).toBe('convert');
			expect(phases[1].id).toBe('cleanup');
			expect(phases[2].id).toBe('translate');
		});

		it('returns 2 phases when skipConvert is true', () => {
			const phases = createWorkflowPhases(true);

			expect(phases).toHaveLength(2);
			expect(phases[0].id).toBe('cleanup');
			expect(phases[1].id).toBe('translate');
		});

		it('returns phases with correct labels when skipping convert', () => {
			const phases = createWorkflowPhases(true);

			expect(phases[0].label).toBe('Cleanup');
			expect(phases[1].label).toBe('Translate');
		});

		it('returns phases with pending status', () => {
			const phases = createWorkflowPhases(true);

			phases.forEach((phase) => {
				expect(phase.status).toBe('pending');
			});
		});

		it('returns default 3-phase array when called with no argument', () => {
			const phases = createWorkflowPhases();

			expect(phases).toHaveLength(3);
			expect(phases[0].id).toBe('convert');
		});
	});

	describe('DEFAULT constants', () => {
		it('has three default phases in order', () => {
			expect(DEFAULT_PHASES).toHaveLength(3);
			expect(DEFAULT_PHASES[0].id).toBe('convert');
			expect(DEFAULT_PHASES[1].id).toBe('cleanup');
			expect(DEFAULT_PHASES[2].id).toBe('translate');
		});

		it('has correct default cleanup settings', () => {
			expect(DEFAULT_CLEANUP_SETTINGS.model).toBe('gpt-5-mini');
			expect(DEFAULT_CLEANUP_SETTINGS.chunkSize).toBe(4000);
			expect(DEFAULT_CLEANUP_SETTINGS.reasoningEffort).toBe('medium');
		});

		it('has correct default translation settings', () => {
			expect(DEFAULT_TRANSLATION_SETTINGS.model).toBe('gpt-5-mini');
			expect(DEFAULT_TRANSLATION_SETTINGS.chunkSize).toBe(4000);
			expect(DEFAULT_TRANSLATION_SETTINGS.reasoningEffort).toBe('medium');
			expect(DEFAULT_TRANSLATION_SETTINGS.contextAware).toBe(true);
		});
	});
});
