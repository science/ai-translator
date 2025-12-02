import { describe, it, expect } from 'vitest';
import {
	formatSSEEvent,
	createProgressEvent,
	createActivityEvent,
	createCompleteEvent,
	createErrorEvent
} from '$lib/streaming';

describe('SSE Streaming Utilities', () => {
	describe('formatSSEEvent', () => {
		it('formats data as SSE event', () => {
			const data = { type: 'progress', percentage: 50 };
			const result = formatSSEEvent(data);
			expect(result).toBe('data: {"type":"progress","percentage":50}\n\n');
		});

		it('handles nested objects', () => {
			const data = { type: 'complete', result: { markdown: '# Test' } };
			const result = formatSSEEvent(data);
			expect(result).toBe('data: {"type":"complete","result":{"markdown":"# Test"}}\n\n');
		});
	});

	describe('createProgressEvent', () => {
		it('creates progress event with percentage and message', () => {
			const event = createProgressEvent(50, 'Processing chunk 2/4...');
			expect(event).toBe('data: {"type":"progress","percentage":50,"message":"Processing chunk 2/4..."}\n\n');
		});

		it('clamps percentage to 0-100', () => {
			const eventOver = createProgressEvent(150, 'Test');
			expect(eventOver).toContain('"percentage":100');

			const eventUnder = createProgressEvent(-10, 'Test');
			expect(eventUnder).toContain('"percentage":0');
		});
	});

	describe('createActivityEvent', () => {
		it('creates activity event with message', () => {
			const event = createActivityEvent('Extracting text from PDF...');
			expect(event).toBe('data: {"type":"activity","message":"Extracting text from PDF..."}\n\n');
		});
	});

	describe('createCompleteEvent', () => {
		it('creates complete event with markdown result', () => {
			const event = createCompleteEvent('# Converted Content');
			expect(event).toBe('data: {"type":"complete","markdown":"# Converted Content"}\n\n');
		});

		it('handles markdown with special characters', () => {
			const event = createCompleteEvent('Line1\nLine2\n\n**Bold**');
			const parsed = JSON.parse(event.replace('data: ', '').trim());
			expect(parsed.markdown).toBe('Line1\nLine2\n\n**Bold**');
		});
	});

	describe('createErrorEvent', () => {
		it('creates error event with message', () => {
			const event = createErrorEvent('Something went wrong');
			expect(event).toBe('data: {"type":"error","error":"Something went wrong"}\n\n');
		});
	});
});
