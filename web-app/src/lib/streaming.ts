// SSE (Server-Sent Events) streaming utilities

/**
 * Format data as an SSE event
 */
export function formatSSEEvent(data: unknown): string {
	return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Create a progress event with percentage (for determinate progress)
 */
export function createProgressEvent(percentage: number, message: string): string {
	const clampedPercentage = Math.max(0, Math.min(100, percentage));
	return formatSSEEvent({
		type: 'progress',
		percentage: clampedPercentage,
		message
	});
}

/**
 * Create an activity event (for indeterminate progress)
 */
export function createActivityEvent(message: string): string {
	return formatSSEEvent({
		type: 'activity',
		message
	});
}

/**
 * Create a completion event with the result
 */
export function createCompleteEvent(markdown: string): string {
	return formatSSEEvent({
		type: 'complete',
		markdown
	});
}

/**
 * Create an error event
 */
export function createErrorEvent(error: string): string {
	return formatSSEEvent({
		type: 'error',
		error
	});
}

/**
 * Create SSE response headers
 */
export function createSSEHeaders(): Headers {
	return new Headers({
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
	});
}
