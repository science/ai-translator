<script lang="ts">
	import type { WorkflowPhase, PhaseStatus } from '$lib/workflow';

	interface Props {
		phases: WorkflowPhase[];
	}

	let { phases }: Props = $props();

	function getStatusColor(status: PhaseStatus): string {
		switch (status) {
			case 'completed':
				return 'text-green-600';
			case 'in_progress':
				return 'text-blue-600';
			case 'error':
				return 'text-red-600';
			default:
				return 'text-gray-400';
		}
	}

	function getConnectorStyle(fromStatus: PhaseStatus, toStatus: PhaseStatus): string {
		if (fromStatus === 'completed' && toStatus !== 'pending') {
			return 'bg-green-400';
		}
		if (fromStatus === 'completed' && toStatus === 'pending') {
			return 'bg-green-400';
		}
		if (fromStatus === 'in_progress') {
			return 'border-dashed border-t-2 border-blue-400 bg-transparent';
		}
		if (fromStatus === 'error') {
			return 'bg-red-300';
		}
		return 'bg-gray-300';
	}
</script>

<nav
	data-testid="phase-indicator"
	aria-label="Workflow progress"
	class="flex items-center justify-center space-x-2"
>
	{#each phases as phase, index}
		{@const isActive = phase.status === 'in_progress'}
		<div
			data-testid="phase-{phase.id}"
			class="flex items-center {getStatusColor(phase.status)}"
			aria-current={isActive ? 'step' : undefined}
		>
			<!-- Status indicator -->
			<div class="flex flex-col items-center">
				<div class="flex items-center justify-center w-8 h-8 rounded-full border-2 {
					phase.status === 'completed' ? 'border-green-500 bg-green-50' :
					phase.status === 'in_progress' ? 'border-blue-500 bg-blue-50' :
					phase.status === 'error' ? 'border-red-500 bg-red-50' :
					'border-gray-300 bg-gray-50'
				}">
					{#if phase.status === 'pending'}
						<span data-testid="status-pending" class="w-3 h-3 rounded-full bg-gray-300"></span>
					{:else if phase.status === 'in_progress'}
						<span data-testid="status-in_progress" class="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
					{:else if phase.status === 'completed'}
						<svg data-testid="status-completed" class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
					{:else if phase.status === 'error'}
						<svg data-testid="status-error" class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					{/if}
				</div>
				<span class="mt-1 text-xs font-medium">{phase.label}</span>
			</div>
		</div>

		<!-- Connector line (except after last phase) -->
		{#if index < phases.length - 1}
			<div
				data-testid="phase-connector"
				class="w-12 h-0.5 {getConnectorStyle(phase.status, phases[index + 1].status)}"
			></div>
		{/if}
	{/each}
</nav>
