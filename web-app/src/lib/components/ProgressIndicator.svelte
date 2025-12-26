<script lang="ts">
	import type { ProgressState, DeterminateProgress, IndeterminateProgress } from '$lib/progress';

	interface Props {
		progress: ProgressState;
	}

	let { progress }: Props = $props();

	function formatCost(value: number): string {
		return `$${value.toFixed(2)}`;
	}
</script>

{#if progress.type !== 'idle' && progress.isActive}
	<div data-testid="progress-indicator" class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
		{#if progress.type === 'determinate'}
			{@const determinateProgress = progress as DeterminateProgress}
			<div class="flex items-center justify-between mb-2">
				<span class="text-sm text-blue-700">{determinateProgress.message}</span>
				<span class="text-sm font-medium text-blue-700">{determinateProgress.percentage}%</span>
			</div>
			<div
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={determinateProgress.percentage}
				class="w-full bg-blue-200 rounded-full h-2.5"
			>
				<div
					data-testid="progress-fill"
					class="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
					style="width: {determinateProgress.percentage}%"
				></div>
			</div>
			{#if determinateProgress.costData}
				<div data-testid="cost-display" class="mt-2 flex items-center justify-between text-xs text-blue-600">
					<span>
						Cost: <span class="font-medium">{formatCost(determinateProgress.costData.actualCostSoFar)}</span>
						of ~<span class="font-medium">{formatCost(determinateProgress.costData.estimatedCost)}</span> estimated
					</span>
					<span class="text-blue-500">
						{determinateProgress.costData.tokensUsed.totalTokens.toLocaleString()} tokens
					</span>
				</div>
			{/if}
		{:else if progress.type === 'indeterminate'}
			{@const indeterminateProgress = progress as IndeterminateProgress}
			<div role="status" data-testid="activity-indicator">
				<div class="flex items-center mb-2">
					<div data-testid="spinner" class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
					<span class="text-sm text-blue-700">{indeterminateProgress.message}</span>
				</div>
				{#if indeterminateProgress.activities.length > 0}
					<div class="mt-3 pl-8 space-y-1 text-xs text-blue-600 max-h-24 overflow-y-auto">
						{#each indeterminateProgress.activities as activity}
							<div class="flex items-center">
								<span class="mr-2 text-blue-400">-</span>
								<span>{activity}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
