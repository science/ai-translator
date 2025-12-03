<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	// API Key state
	let apiKey = $state('');
	let showApiKey = $state(false);
	let apiKeyStatus = $state<'not-configured' | 'saved' | 'error'>('not-configured');
	let saveMessage = $state('');

	// Default settings state
	let defaultModel = $state('gpt-5-mini');
	let defaultChunkSize = $state('4000');
	let defaultReasoningEffort = $state('medium');

	// Check if the selected model is a 5-series model (supports reasoning effort)
	let is5SeriesModel = $derived(defaultModel.startsWith('gpt-5'));

	onMount(() => {
		// Load API key from localStorage
		const storedApiKey = localStorage.getItem('openai_api_key');
		if (storedApiKey) {
			apiKey = storedApiKey;
			apiKeyStatus = 'saved';
		}

		// Load default settings from localStorage
		const storedModel = localStorage.getItem('default_model');
		if (storedModel) defaultModel = storedModel;

		const storedChunkSize = localStorage.getItem('default_chunk_size');
		if (storedChunkSize) defaultChunkSize = storedChunkSize;

		const storedReasoningEffort = localStorage.getItem('default_reasoning_effort');
		if (storedReasoningEffort) defaultReasoningEffort = storedReasoningEffort;
	});

	function saveApiKey() {
		if (browser) {
			localStorage.setItem('openai_api_key', apiKey);
			apiKeyStatus = 'saved';
			saveMessage = 'API key saved successfully';
			setTimeout(() => {
				saveMessage = '';
			}, 3000);
		}
	}

	function toggleShowApiKey() {
		showApiKey = !showApiKey;
	}

	function saveDefaults() {
		if (browser) {
			localStorage.setItem('default_model', defaultModel);
			localStorage.setItem('default_chunk_size', defaultChunkSize);
			localStorage.setItem('default_reasoning_effort', defaultReasoningEffort);
		}
	}

	function clearAllDocuments() {
		if (browser && confirm('Are you sure you want to delete all documents? This cannot be undone.')) {
			localStorage.removeItem('documents');
		}
	}
</script>

<div class="max-w-4xl">
	<h1 class="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

	<div class="space-y-6">
		<!-- API Key Section -->
		<div class="bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">OpenAI API Configuration</h2>

			<div class="space-y-4">
				<div>
					<label for="api-key" class="block text-sm font-medium text-gray-700 mb-2">API Key:</label>
					<input
						id="api-key"
						type={showApiKey ? 'text' : 'password'}
						placeholder="sk-..."
						bind:value={apiKey}
						class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						data-testid="toggle-api-key"
						onclick={() => showApiKey = !showApiKey}
						class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
					>
						{showApiKey ? 'Hide' : 'Show'}
					</button>
					<button
						type="button"
						class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
					>
						Test Connection
					</button>
					<button
						type="button"
						data-testid="save-api-key"
						onclick={saveApiKey}
						class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
					>
						Save
					</button>
				</div>

				{#if saveMessage}
					<div class="flex items-center gap-2 p-3 bg-green-50 text-green-800 rounded-lg text-sm">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<p>{saveMessage}</p>
					</div>
				{/if}

				<div class="flex items-center gap-2 text-sm">
					<span class="font-medium text-gray-700">Status:</span>
					{#if apiKeyStatus === 'saved'}
						<span class="flex items-center gap-1 text-green-600">
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
							Configured
						</span>
					{:else}
						<span class="text-amber-600">Not configured</span>
					{/if}
				</div>

				<div class="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
					<svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<p>Your API key is stored locally in your browser. Never share this with others.</p>
				</div>
			</div>
		</div>

		<!-- Default Settings Section -->
		<div class="bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Default Settings</h2>

			<div class="space-y-4">
				<div>
					<label for="default-model" class="block text-sm font-medium text-gray-700 mb-2">Default Model:</label>
					<select
						id="default-model"
						bind:value={defaultModel}
						class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option value="gpt-5.1">gpt-5.1</option>
						<option value="gpt-5-mini">gpt-5-mini</option>
						<option value="gpt-4.1">gpt-4.1</option>
						<option value="gpt-4.1-mini">gpt-4.1-mini</option>
					</select>
				</div>

				<div>
					<label for="default-chunk-size" class="block text-sm font-medium text-gray-700 mb-2">Default Chunk Size:</label>
					<input
						id="default-chunk-size"
						type="number"
						bind:value={defaultChunkSize}
						class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
				</div>

				{#if is5SeriesModel}
					<div>
						<label for="default-reasoning-effort" class="block text-sm font-medium text-gray-700 mb-2">Default Reasoning Effort:</label>
						<select
							id="default-reasoning-effort"
							bind:value={defaultReasoningEffort}
							class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
						</select>
					</div>
				{/if}

				<button
					type="button"
					data-testid="save-defaults"
					onclick={saveDefaults}
					class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
				>
					Save Defaults
				</button>
			</div>
		</div>

		<!-- Storage Management Section -->
		<div class="bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Storage Management</h2>

			<p class="text-sm text-gray-600 mb-4">Total storage used: 0 KB</p>

			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={clearAllDocuments}
					class="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
				>
					Clear All Documents
				</button>
				<button type="button" class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
					Export Data
				</button>
				<button type="button" class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
					Import Data
				</button>
			</div>
		</div>
	</div>
</div>
