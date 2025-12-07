import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import PhaseIndicator from '$lib/components/PhaseIndicator.svelte';
import type { WorkflowPhase } from '$lib/workflow';

afterEach(() => {
	cleanup();
});

function createPhases(statuses: Array<'pending' | 'in_progress' | 'completed' | 'error'>): WorkflowPhase[] {
	const labels = ['Convert PDF', 'Cleanup', 'Translate'];
	const ids: Array<'convert' | 'cleanup' | 'translate'> = ['convert', 'cleanup', 'translate'];
	return statuses.map((status, index) => ({
		id: ids[index],
		label: labels[index],
		status
	}));
}

describe('PhaseIndicator Component', () => {
	describe('rendering phases', () => {
		it('renders all three phases', () => {
			const phases = createPhases(['pending', 'pending', 'pending']);
			render(PhaseIndicator, { props: { phases } });

			expect(screen.getByText('Convert PDF')).toBeDefined();
			expect(screen.getByText('Cleanup')).toBeDefined();
			expect(screen.getByText('Translate')).toBeDefined();
		});

		it('renders connector lines between phases', () => {
			const phases = createPhases(['pending', 'pending', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			// Should have 2 connectors between 3 phases
			const connectors = container.querySelectorAll('[data-testid="phase-connector"]');
			expect(connectors).toHaveLength(2);
		});
	});

	describe('phase status indicators', () => {
		it('shows pending indicator for pending phases', () => {
			const phases = createPhases(['pending', 'pending', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			const pendingIndicators = container.querySelectorAll('[data-testid="status-pending"]');
			expect(pendingIndicators).toHaveLength(3);
		});

		it('shows in-progress indicator for active phase', () => {
			const phases = createPhases(['completed', 'in_progress', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			const inProgressIndicator = container.querySelector('[data-testid="status-in_progress"]');
			expect(inProgressIndicator).toBeDefined();
		});

		it('shows checkmark for completed phases', () => {
			const phases = createPhases(['completed', 'completed', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			const completedIndicators = container.querySelectorAll('[data-testid="status-completed"]');
			expect(completedIndicators).toHaveLength(2);
		});

		it('shows error indicator for failed phases', () => {
			const phases = createPhases(['completed', 'error', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			const errorIndicator = container.querySelector('[data-testid="status-error"]');
			expect(errorIndicator).toBeDefined();
		});
	});

	describe('visual styling', () => {
		it('highlights active phase with blue styling', () => {
			const phases = createPhases(['completed', 'in_progress', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			const activePhase = container.querySelector('[data-testid="phase-cleanup"]');
			expect(activePhase?.className).toContain('text-blue');
		});

		it('shows completed phases with green styling', () => {
			const phases = createPhases(['completed', 'in_progress', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			const completedPhase = container.querySelector('[data-testid="phase-convert"]');
			expect(completedPhase?.className).toContain('text-green');
		});

		it('shows pending phases with gray styling', () => {
			const phases = createPhases(['completed', 'in_progress', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			const pendingPhase = container.querySelector('[data-testid="phase-translate"]');
			expect(pendingPhase?.className).toContain('text-gray');
		});

		it('shows error phases with red styling', () => {
			const phases = createPhases(['completed', 'error', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			const errorPhase = container.querySelector('[data-testid="phase-cleanup"]');
			expect(errorPhase?.className).toContain('text-red');
		});
	});

	describe('connector line styling', () => {
		it('shows solid green connector after completed phase', () => {
			const phases = createPhases(['completed', 'in_progress', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			const connectors = container.querySelectorAll('[data-testid="phase-connector"]');
			expect(connectors[0]?.className).toContain('bg-green');
		});

		it('shows dashed blue connector from active phase', () => {
			const phases = createPhases(['completed', 'in_progress', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			const connectors = container.querySelectorAll('[data-testid="phase-connector"]');
			expect(connectors[1]?.className).toContain('border-dashed');
		});

		it('shows gray connector between pending phases', () => {
			const phases = createPhases(['pending', 'pending', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			const connectors = container.querySelectorAll('[data-testid="phase-connector"]');
			expect(connectors[0]?.className).toContain('bg-gray');
		});
	});

	describe('accessibility', () => {
		it('has appropriate ARIA attributes', () => {
			const phases = createPhases(['completed', 'in_progress', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			const indicator = container.querySelector('[data-testid="phase-indicator"]');
			// nav element has implicit navigation role, so we check the aria-label
			expect(indicator?.tagName.toLowerCase()).toBe('nav');
			expect(indicator?.getAttribute('aria-label')).toBe('Workflow progress');
		});

		it('marks current step with aria-current', () => {
			const phases = createPhases(['completed', 'in_progress', 'pending']);
			const { container } = render(PhaseIndicator, { props: { phases } });

			const activePhase = container.querySelector('[aria-current="step"]');
			expect(activePhase).toBeDefined();
		});
	});
});
