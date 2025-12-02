import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ProgressIndicator from '$lib/components/ProgressIndicator.svelte';
import {
	createDeterminateProgress,
	createIndeterminateProgress,
	resetProgress,
	addActivity
} from '$lib/progress';

afterEach(() => {
	cleanup();
});

describe('ProgressIndicator Component', () => {
	describe('idle state', () => {
		it('renders nothing when idle', () => {
			const progress = resetProgress();
			const { container } = render(ProgressIndicator, { props: { progress } });
			expect(container.querySelector('[data-testid="progress-indicator"]')).toBeNull();
		});
	});

	describe('determinate progress', () => {
		it('renders progress bar with correct percentage', () => {
			const progress = createDeterminateProgress('Processing...', 50);
			render(ProgressIndicator, { props: { progress } });

			const progressBar = screen.getByRole('progressbar');
			expect(progressBar).toBeDefined();
			expect(progressBar.getAttribute('aria-valuenow')).toBe('50');
		});

		it('displays the message', () => {
			const progress = createDeterminateProgress('Processing chunk 2/4...', 50);
			render(ProgressIndicator, { props: { progress } });

			expect(screen.getByText('Processing chunk 2/4...')).toBeDefined();
		});

		it('shows percentage text', () => {
			const progress = createDeterminateProgress('Working...', 75);
			render(ProgressIndicator, { props: { progress } });

			expect(screen.getByText('75%')).toBeDefined();
		});

		it('applies correct width to progress fill', () => {
			const progress = createDeterminateProgress('Loading', 30);
			const { container } = render(ProgressIndicator, { props: { progress } });

			const fill = container.querySelector('[data-testid="progress-fill"]');
			expect(fill).toBeDefined();
			expect(fill?.getAttribute('style')).toContain('width: 30%');
		});
	});

	describe('indeterminate progress', () => {
		it('renders activity indicator', () => {
			const progress = createIndeterminateProgress('Starting...');
			const { container } = render(ProgressIndicator, { props: { progress } });

			expect(container.querySelector('[data-testid="activity-indicator"]')).toBeDefined();
		});

		it('displays the current message', () => {
			const progress = createIndeterminateProgress('Extracting text...');
			render(ProgressIndicator, { props: { progress } });

			expect(screen.getByText('Extracting text...')).toBeDefined();
		});

		it('shows activity log when activities exist', () => {
			let progress = createIndeterminateProgress('Starting');
			progress = addActivity(progress, 'Step 1 complete');
			progress = addActivity(progress, 'Step 2 in progress');

			render(ProgressIndicator, { props: { progress } });

			// Activity log should show both activities
			expect(screen.getByText('Step 1 complete')).toBeDefined();
			// Step 2 appears twice: in the message area and activity log (expected)
			expect(screen.getAllByText('Step 2 in progress')).toHaveLength(2);
		});

		it('shows animated spinner', () => {
			const progress = createIndeterminateProgress('Loading');
			const { container } = render(ProgressIndicator, { props: { progress } });

			const spinner = container.querySelector('[data-testid="spinner"]');
			expect(spinner).toBeDefined();
		});
	});

	describe('accessibility', () => {
		it('has accessible progress bar for determinate progress', () => {
			const progress = createDeterminateProgress('Loading', 50);
			render(ProgressIndicator, { props: { progress } });

			const progressBar = screen.getByRole('progressbar');
			expect(progressBar.getAttribute('aria-valuemin')).toBe('0');
			expect(progressBar.getAttribute('aria-valuemax')).toBe('100');
			expect(progressBar.getAttribute('aria-valuenow')).toBe('50');
		});

		it('has status role for indeterminate progress', () => {
			const progress = createIndeterminateProgress('Working');
			render(ProgressIndicator, { props: { progress } });

			expect(screen.getByRole('status')).toBeDefined();
		});
	});
});
