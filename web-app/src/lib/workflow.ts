// Workflow types for the Complete Conversion feature
import type { ProgressState } from './progress.js';

// Phase identifiers
export type WorkflowPhaseId = 'convert' | 'cleanup' | 'translate';

// Phase status
export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'error';

// Individual phase state
export interface WorkflowPhase {
	id: WorkflowPhaseId;
	label: string;
	status: PhaseStatus;
	progress?: ProgressState;
	result?: string;
	documentId?: string;
	error?: string;
}

// Settings for cleanup phase
export interface CleanupSettings {
	model: string;
	chunkSize: number;
	reasoningEffort: string;
}

// Settings for translation phase
export interface TranslationSettings {
	model: string;
	chunkSize: number;
	reasoningEffort: string;
	contextAware: boolean;
	targetLanguage: string;
}

// Output documents from workflow
export interface WorkflowOutputs {
	markdown?: string;
	cleaned?: string;
	japaneseOnly?: string;
	bilingual?: string;
}

// Complete workflow state
export interface WorkflowState {
	phases: WorkflowPhase[];
	currentPhaseIndex: number;
	isRunning: boolean;
	sourceFile: File | null;
	cleanupSettings: CleanupSettings;
	translationSettings: TranslationSettings;
	outputs: WorkflowOutputs;
	startTime?: number;
	endTime?: number;
}

// Default phase configurations
export const DEFAULT_PHASES: WorkflowPhase[] = [
	{ id: 'convert', label: 'Convert PDF', status: 'pending' },
	{ id: 'cleanup', label: 'Cleanup', status: 'pending' },
	{ id: 'translate', label: 'Translate', status: 'pending' }
];

// Default settings
export const DEFAULT_CLEANUP_SETTINGS: CleanupSettings = {
	model: 'gpt-5-mini',
	chunkSize: 4000,
	reasoningEffort: 'medium'
};

export const DEFAULT_TRANSLATION_SETTINGS: TranslationSettings = {
	model: 'gpt-5-mini',
	chunkSize: 4000,
	reasoningEffort: 'medium',
	contextAware: true,
	targetLanguage: ''
};

// Factory function to create initial workflow state
export function createWorkflowState(): WorkflowState {
	return {
		phases: DEFAULT_PHASES.map((phase) => ({ ...phase })),
		currentPhaseIndex: -1,
		isRunning: false,
		sourceFile: null,
		cleanupSettings: { ...DEFAULT_CLEANUP_SETTINGS },
		translationSettings: { ...DEFAULT_TRANSLATION_SETTINGS },
		outputs: {}
	};
}

// Update phase status
export function updatePhaseStatus(
	state: WorkflowState,
	phaseId: WorkflowPhaseId,
	status: PhaseStatus,
	updates?: Partial<Pick<WorkflowPhase, 'progress' | 'result' | 'documentId' | 'error'>>
): WorkflowState {
	return {
		...state,
		phases: state.phases.map((phase) =>
			phase.id === phaseId ? { ...phase, status, ...updates } : phase
		)
	};
}

// Get current phase
export function getCurrentPhase(state: WorkflowState): WorkflowPhase | null {
	if (state.currentPhaseIndex < 0 || state.currentPhaseIndex >= state.phases.length) {
		return null;
	}
	return state.phases[state.currentPhaseIndex];
}

// Advance to next phase
export function advancePhase(state: WorkflowState): WorkflowState {
	const nextIndex = state.currentPhaseIndex + 1;
	if (nextIndex >= state.phases.length) {
		return {
			...state,
			isRunning: false,
			endTime: Date.now()
		};
	}
	return {
		...state,
		currentPhaseIndex: nextIndex,
		phases: state.phases.map((phase, index) =>
			index === nextIndex ? { ...phase, status: 'in_progress' } : phase
		)
	};
}

// Start workflow
export function startWorkflow(state: WorkflowState): WorkflowState {
	return {
		...state,
		isRunning: true,
		currentPhaseIndex: 0,
		startTime: Date.now(),
		endTime: undefined,
		phases: state.phases.map((phase, index) => ({
			...phase,
			status: index === 0 ? 'in_progress' : 'pending',
			progress: undefined,
			result: undefined,
			documentId: undefined,
			error: undefined
		})),
		outputs: {}
	};
}

// Reset workflow
export function resetWorkflow(state: WorkflowState): WorkflowState {
	return {
		...state,
		phases: DEFAULT_PHASES.map((phase) => ({ ...phase })),
		currentPhaseIndex: -1,
		isRunning: false,
		startTime: undefined,
		endTime: undefined,
		outputs: {}
	};
}

// Check if workflow is complete
export function isWorkflowComplete(state: WorkflowState): boolean {
	return state.phases.every((phase) => phase.status === 'completed');
}

// Check if workflow has error
export function hasWorkflowError(state: WorkflowState): boolean {
	return state.phases.some((phase) => phase.status === 'error');
}

// Calculate elapsed time in milliseconds
export function getElapsedTime(state: WorkflowState): number {
	if (!state.startTime) return 0;
	const end = state.endTime || Date.now();
	return end - state.startTime;
}

// Format elapsed time as human-readable string
export function formatElapsedTime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;

	if (minutes === 0) {
		return `${seconds} second${seconds !== 1 ? 's' : ''}`;
	}
	return `${minutes} minute${minutes !== 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
}
