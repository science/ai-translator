// Progress state types
export type ProgressType = 'idle' | 'determinate' | 'indeterminate';

export interface BaseProgress {
	type: ProgressType;
	message: string;
	isActive: boolean;
}

export interface IdleProgress extends BaseProgress {
	type: 'idle';
}

export interface DeterminateProgress extends BaseProgress {
	type: 'determinate';
	percentage: number;
}

export interface IndeterminateProgress extends BaseProgress {
	type: 'indeterminate';
	activities: string[];
}

export type ProgressState = IdleProgress | DeterminateProgress | IndeterminateProgress;

// Progress event types from SSE
export interface ProgressEvent {
	type: 'progress' | 'activity' | 'complete' | 'error';
	percentage?: number;
	message?: string;
	markdown?: string;
	error?: string;
}

// Factory functions
export function createDeterminateProgress(message: string, percentage = 0): DeterminateProgress {
	return {
		type: 'determinate',
		percentage: clampPercentage(percentage),
		message,
		isActive: true
	};
}

export function createIndeterminateProgress(message: string): IndeterminateProgress {
	return {
		type: 'indeterminate',
		message,
		activities: [],
		isActive: true
	};
}

export function resetProgress(): IdleProgress {
	return {
		type: 'idle',
		message: '',
		isActive: false
	};
}

// Update functions
export function updateProgress(
	state: DeterminateProgress,
	updates: { percentage?: number; message?: string }
): DeterminateProgress {
	return {
		...state,
		percentage: updates.percentage !== undefined ? clampPercentage(updates.percentage) : state.percentage,
		message: updates.message !== undefined ? updates.message : state.message
	};
}

const MAX_ACTIVITIES = 5;

export function addActivity(
	state: IndeterminateProgress,
	activity: string
): IndeterminateProgress {
	const newActivities = [...state.activities, activity];
	// Keep only the last MAX_ACTIVITIES entries
	const trimmedActivities = newActivities.slice(-MAX_ACTIVITIES);

	return {
		...state,
		activities: trimmedActivities,
		message: activity
	};
}

export function completeProgress<T extends DeterminateProgress | IndeterminateProgress>(
	state: T,
	message: string
): T {
	if (state.type === 'determinate') {
		return {
			...state,
			percentage: 100,
			message,
			isActive: false
		} as T;
	}
	return {
		...state,
		message,
		isActive: false
	} as T;
}

// SSE event parsing
export function parseProgressEvent(data: string): ProgressEvent | null {
	if (!data || data.trim() === '') {
		return null;
	}

	try {
		return JSON.parse(data) as ProgressEvent;
	} catch {
		return null;
	}
}

// Helper functions
function clampPercentage(value: number): number {
	return Math.max(0, Math.min(100, value));
}
