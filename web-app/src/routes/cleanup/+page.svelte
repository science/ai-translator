<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import {
		type StoredDocument,
		getAllDocuments,
		getDocument,
		saveDocument,
		generateDocumentId
	} from '$lib/storage';
	import {
		type ProgressState,
		type CostData,
		createDeterminateProgress,
		updateProgress,
		completeProgress,
		resetProgress
	} from '$lib/progress';
	import ProgressIndicator from '$lib/components/ProgressIndicator.svelte';
	import {
		MODELS,
		DEFAULT_MODEL,
		is5SeriesModel as checkIs5Series,
		getReasoningEffortOptions
	} from '$lib/models';

	// Browser services for direct OpenAI calls
	import { chunkBySize } from '$lib/services/chunker';
	import { createRectifier } from '$lib/services/rectifier';
	import { rectifyDocument } from '$lib/services/rectificationEngine';
	import { estimateJobCost, calculateCost, type CostEstimate, type TokenUsage } from '$lib/services/costCalculator';

	// Display-friendly version for the list
	interface DocumentListItem {
		id: string;
		name: string;
		type: 'pdf' | 'markdown' | 'text';
		size: number;
		uploadedAt: string;
	}

	let documents = $state<DocumentListItem[]>([]);
	let selectedDocId = $state('');
	let model = $state(DEFAULT_MODEL);
	let chunkSize = $state(4000);
	let reasoningEffort = $state('medium');
	let isCleaning = $state(false);
	let cleanedMarkdown = $state('');
	let error = $state('');
	let progress = $state<ProgressState>(resetProgress());

	// Cost tracking state
	let costEstimate = $state<CostEstimate | null>(null);
	let finalCost = $state<{ usage: TokenUsage; cost: number } | null>(null);

	onMount(async () => {
		if (browser) {
			await loadDocuments();

			// Load default settings from localStorage
			const storedModel = localStorage.getItem('default_model');
			if (storedModel) model = storedModel;

			const storedChunkSize = localStorage.getItem('default_chunk_size');
			if (storedChunkSize) {
				const size = parseInt(storedChunkSize, 10);
				if (!isNaN(size)) chunkSize = size;
			}

			const storedReasoningEffort = localStorage.getItem('default_reasoning_effort');
			if (storedReasoningEffort) reasoningEffort = storedReasoningEffort;
		}
	});

	async function loadDocuments() {
		const docs = await getAllDocuments();
		documents = docs.map((doc) => ({
			id: doc.id,
			name: doc.name,
			type: doc.type,
			size: doc.size,
			uploadedAt: doc.uploadedAt
		}));
	}

	// Filter to only show markdown documents
	let markdownDocuments = $derived(documents.filter((doc) => doc.type === 'markdown'));

	// Check if the selected model is a 5-series model (supports reasoning effort)
	let is5SeriesModel = $derived(checkIs5Series(model));

	// Get reasoning effort options based on model type (from centralized config)
	let reasoningEffortOptions = $derived(getReasoningEffortOptions(model) || []);

	// Get the selected document info (not full document with content)
	let selectedDocInfo = $derived(documents.find((doc) => doc.id === selectedDocId));

	// Compute cost estimate when document and model are selected
	async function updateCostEstimate() {
		if (!selectedDocId) {
			costEstimate = null;
			return;
		}

		try {
			const doc = await getDocument(selectedDocId);
			if (!doc) {
				costEstimate = null;
				return;
			}

			let content: string;
			if (typeof doc.content === 'string') {
				content = doc.content;
			} else {
				content = await doc.content.text();
			}

			const chunks = chunkBySize(content, chunkSize);
			const chunkContents = chunks.map(c => c.content);
			costEstimate = estimateJobCost(chunkContents, model, 'cleanup');
		} catch {
			costEstimate = null;
		}
	}

	// Re-estimate when relevant inputs change
	$effect(() => {
		if (browser && selectedDocId && model) {
			updateCostEstimate();
		}
	});

	/**
	 * Assembles rectified markdown from rectified chunks
	 */
	function assembleRectified(chunks: Array<{ rectifiedContent: string }>): string {
		return chunks.map((chunk) => chunk.rectifiedContent).join('\n\n');
	}

	async function handleCleanup() {
		if (!selectedDocInfo) return;

		isCleaning = true;
		error = '';
		cleanedMarkdown = '';
		finalCost = null;
		progress = createDeterminateProgress('Starting cleanup...');

		try {
			// Get API key from localStorage
			const apiKey = localStorage.getItem('openai_api_key');
			if (!apiKey) {
				throw new Error('OpenAI API key not found. Please set it in Settings.');
			}

			// Fetch the full document with content from IndexedDB
			const selectedDoc = await getDocument(selectedDocId);
			if (!selectedDoc) {
				throw new Error('Document not found');
			}

			// Get content as string
			let content: string;
			if (typeof selectedDoc.content === 'string') {
				content = selectedDoc.content;
			} else {
				// Convert Blob to string if needed
				content = await selectedDoc.content.text();
			}

			// Step 1: Chunk the content
			progress = updateProgress(progress as ReturnType<typeof createDeterminateProgress>, {
				percentage: 5,
				message: 'Chunking document...'
			});

			const chunks = chunkBySize(content, chunkSize);

			// Step 2: Create rectifier with browser service
			const rectifier = createRectifier({
				apiKey,
				model,
				reasoningEffort: is5SeriesModel ? reasoningEffort : undefined
			});

			// Step 3: Rectify document with progress callback
			const { rectifiedChunks, totalUsage } = await rectifyDocument(chunks, rectifier.rectifyChunk, {
				onProgress: (prog) => {
					// Map progress to 10-95% (reserving 0-10 for chunking, 95-100 for assembly)
					const mappedPercentage = 10 + Math.round(prog.percentComplete * 0.85);
					const actualCostSoFar = calculateCost(prog.tokensUsed, model);
					const progressCostData: CostData = {
						tokensUsed: prog.tokensUsed,
						estimatedCost: costEstimate?.estimatedCostUsd || 0,
						actualCostSoFar
					};
					progress = updateProgress(progress as ReturnType<typeof createDeterminateProgress>, {
						percentage: mappedPercentage,
						message: `Rectifying chunk ${prog.current}/${prog.total}...`,
						costData: progressCostData
					});
				}
			});

			// Step 4: Assemble output
			progress = updateProgress(progress as ReturnType<typeof createDeterminateProgress>, {
				percentage: 95,
				message: 'Assembling results...'
			});

			cleanedMarkdown = assembleRectified(rectifiedChunks);

			// Calculate final cost
			const finalCostUsd = calculateCost(totalUsage, model);
			finalCost = { usage: totalUsage, cost: finalCostUsd };

			progress = completeProgress(
				progress as ReturnType<typeof createDeterminateProgress>,
				'Cleanup complete!'
			);

			// Store the cleaned document in IndexedDB
			const baseName = selectedDoc.name.replace(/\.md$/i, '');
			const newDoc: StoredDocument = {
				id: generateDocumentId(),
				name: `${baseName}-rectified.md`,
				type: 'markdown',
				content: cleanedMarkdown,
				size: new Blob([cleanedMarkdown]).size,
				uploadedAt: new Date().toISOString(),
				phase: 'cleaned',
				sourceDocumentId: selectedDoc.id
			};

			await saveDocument(newDoc);

			// Update local display list
			documents = [
				...documents,
				{
					id: newDoc.id,
					name: newDoc.name,
					type: newDoc.type,
					size: newDoc.size,
					uploadedAt: newDoc.uploadedAt
				}
			];
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			progress = resetProgress();
		} finally {
			isCleaning = false;
		}
	}
</script>

<div class="max-w-4xl">
	<h1 class="text-2xl font-bold text-gray-900 mb-6">Cleanup Document</h1>

	<div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
		<div>
			<label class="block text-sm font-medium text-gray-700 mb-2">
				Select document to clean up:
			</label>
			<select
				bind:value={selectedDocId}
				disabled={isCleaning}
				class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
			>
				{#if markdownDocuments.length === 0}
					<option value="">No markdown documents available</option>
				{:else}
					<option value="">Select a document...</option>
					{#each markdownDocuments as doc (doc.id)}
						<option value={doc.id}>{doc.name}</option>
					{/each}
				{/if}
			</select>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-2">Model:</label>
				<select
					bind:value={model}
					disabled={isCleaning}
					class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
				>
					{#each MODELS as m (m.id)}
						<option value={m.id}>{m.label}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-2">Chunk Size:</label>
				<input
					type="number"
					bind:value={chunkSize}
					disabled={isCleaning}
					class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
				/>
			</div>
		</div>

		{#if is5SeriesModel}
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-2">Reasoning Effort:</label>
				<select
					bind:value={reasoningEffort}
					disabled={isCleaning}
					class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
				>
					{#each reasoningEffortOptions as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if costEstimate && selectedDocId && !isCleaning}
			<div data-testid="cost-estimate" class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
				<h3 class="text-sm font-medium text-blue-800 mb-2">Cost Estimate</h3>
				<div class="grid grid-cols-3 gap-4 text-sm">
					<div>
						<span class="text-blue-600">Model:</span>
						<span class="font-medium text-blue-800 ml-1">{model}</span>
					</div>
					<div>
						<span class="text-blue-600">Est. tokens:</span>
						<span class="font-medium text-blue-800 ml-1">~{(costEstimate.estimatedInputTokens + costEstimate.estimatedOutputTokens).toLocaleString()}</span>
					</div>
					<div>
						<span class="text-blue-600">Est. cost:</span>
						<span class="font-medium text-blue-800 ml-1">${costEstimate.estimatedCostUsd.toFixed(2)}</span>
					</div>
				</div>
			</div>
		{/if}

		<button
			onclick={handleCleanup}
			class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			disabled={!selectedDocId || isCleaning}
		>
			{#if isCleaning}
				Cleaning...
			{:else}
				Start Cleanup
			{/if}
		</button>

		<ProgressIndicator {progress} />
	</div>

	{#if error}
		<div class="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-700">{error}</p>
		</div>
	{/if}

	{#if cleanedMarkdown}
		<div class="mt-6 bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Cleaned Markdown</h2>

			{#if finalCost}
				<div data-testid="final-cost" class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
					<h3 class="text-sm font-medium text-green-800 mb-2">Cleanup Complete</h3>
					<div class="grid grid-cols-3 gap-4 text-sm">
						<div>
							<span class="text-green-600">Total tokens:</span>
							<span class="font-medium text-green-800 ml-1">{finalCost.usage.totalTokens.toLocaleString()}</span>
						</div>
						<div>
							<span class="text-green-600">Input:</span>
							<span class="font-medium text-green-800 ml-1">{finalCost.usage.promptTokens.toLocaleString()}</span>
						</div>
						<div>
							<span class="text-green-600">Final cost:</span>
							<span class="font-medium text-green-800 ml-1">${finalCost.cost.toFixed(2)}</span>
						</div>
					</div>
				</div>
			{/if}

			<div class="prose prose-sm max-w-none bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
				<pre class="whitespace-pre-wrap text-sm text-gray-800">{cleanedMarkdown}</pre>
			</div>
		</div>
	{/if}
</div>
