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
		createDeterminateProgress,
		updateProgress,
		completeProgress,
		resetProgress
	} from '$lib/progress';
	import ProgressIndicator from '$lib/components/ProgressIndicator.svelte';

	// Browser services for direct OpenAI calls
	import { chunkBySize } from '$lib/services/chunker';
	import { createTranslator } from '$lib/services/translator';
	import { translateDocument } from '$lib/services/translationEngine';

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
	let model = $state('gpt-5-mini');
	let chunkSize = $state(4000);
	let reasoningEffort = $state('medium');
	let contextAware = $state(true);
	let isTranslating = $state(false);
	let japaneseOnlyMarkdown = $state('');
	let bilingualMarkdown = $state('');
	let activeTab = $state<'japanese-only' | 'bilingual'>('japanese-only');
	let error = $state('');
	let progress = $state<ProgressState>(resetProgress());

	onMount(async () => {
		if (browser) {
			await loadDocuments();
			// Load context-aware setting from localStorage
			const storedContextAware = localStorage.getItem('context_aware_enabled');
			if (storedContextAware !== null) {
				contextAware = storedContextAware === 'true';
			}
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
	let is5SeriesModel = $derived(model.startsWith('gpt-5'));

	// Check if the model is GPT-5.1 family (supports "none", not "minimal")
	let isGpt51Model = $derived(/gpt-5\.1/.test(model));

	// Get reasoning effort options based on model type
	// GPT-5.1: None, Low, Medium, High
	// GPT-5/5-mini/5-nano: Minimal, Low, Medium, High
	let reasoningEffortOptions = $derived(
		isGpt51Model
			? [
					{ value: 'none', label: 'None' },
					{ value: 'low', label: 'Low' },
					{ value: 'medium', label: 'Medium' },
					{ value: 'high', label: 'High' }
				]
			: [
					{ value: 'minimal', label: 'Minimal' },
					{ value: 'low', label: 'Low' },
					{ value: 'medium', label: 'Medium' },
					{ value: 'high', label: 'High' }
				]
	);

	// Get the selected document info (not full document with content)
	let selectedDocInfo = $derived(documents.find((doc) => doc.id === selectedDocId));

	/**
	 * Assembles Japanese-only markdown from translated chunks
	 */
	function assembleJapaneseOnly(
		chunks: Array<{ translatedContent: string }>
	): string {
		return chunks.map((chunk) => chunk.translatedContent).join('\n\n');
	}

	/**
	 * Assembles bilingual markdown from translated chunks
	 */
	function assembleBilingual(
		chunks: Array<{ originalContent: string; translatedContent: string }>
	): string {
		if (chunks.length === 0) return '';

		return chunks
			.map((chunk) => `${chunk.originalContent}\n\n---\n\n${chunk.translatedContent}`)
			.join('\n\n---\n\n');
	}

	async function handleTranslate() {
		if (!selectedDocInfo) return;

		isTranslating = true;
		error = '';
		japaneseOnlyMarkdown = '';
		bilingualMarkdown = '';
		progress = createDeterminateProgress('Starting translation...');

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

			// Step 2: Create translator with browser service
			const translator = createTranslator({
				apiKey,
				model,
				contextAware,
				reasoningEffort: is5SeriesModel ? reasoningEffort : undefined
			});

			// Step 3: Translate document with progress callback
			const { translatedChunks } = await translateDocument(chunks, translator.translateChunk, {
				onProgress: (prog) => {
					// Map progress to 10-95% (reserving 0-10 for chunking, 95-100 for assembly)
					const mappedPercentage = 10 + Math.round(prog.percentComplete * 0.85);
					progress = updateProgress(progress as ReturnType<typeof createDeterminateProgress>, {
						percentage: mappedPercentage,
						message: `Translating chunk ${prog.current}/${prog.total}...`
					});
				}
			});

			// Step 4: Assemble outputs
			progress = updateProgress(progress as ReturnType<typeof createDeterminateProgress>, {
				percentage: 95,
				message: 'Assembling results...'
			});

			japaneseOnlyMarkdown = assembleJapaneseOnly(translatedChunks);
			bilingualMarkdown = assembleBilingual(translatedChunks);

			progress = completeProgress(
				progress as ReturnType<typeof createDeterminateProgress>,
				'Translation complete!'
			);

			// Store both translated documents in IndexedDB
			const baseName = selectedDoc.name.replace(/\.md$/i, '');

			// Save Japanese-only version
			const japaneseDoc: StoredDocument = {
				id: generateDocumentId(),
				name: `${baseName}-ja.md`,
				type: 'markdown',
				content: japaneseOnlyMarkdown,
				size: new Blob([japaneseOnlyMarkdown]).size,
				uploadedAt: new Date().toISOString(),
				phase: 'translated',
				variant: 'japanese-only',
				sourceDocumentId: selectedDoc.id
			};
			await saveDocument(japaneseDoc);

			// Save bilingual version
			const bilingualDoc: StoredDocument = {
				id: generateDocumentId(),
				name: `${baseName}-bilingual.md`,
				type: 'markdown',
				content: bilingualMarkdown,
				size: new Blob([bilingualMarkdown]).size,
				uploadedAt: new Date().toISOString(),
				phase: 'translated',
				variant: 'bilingual',
				sourceDocumentId: selectedDoc.id
			};
			await saveDocument(bilingualDoc);

			// Update local display list
			documents = [
				...documents,
				{
					id: japaneseDoc.id,
					name: japaneseDoc.name,
					type: japaneseDoc.type,
					size: japaneseDoc.size,
					uploadedAt: japaneseDoc.uploadedAt
				},
				{
					id: bilingualDoc.id,
					name: bilingualDoc.name,
					type: bilingualDoc.type,
					size: bilingualDoc.size,
					uploadedAt: bilingualDoc.uploadedAt
				}
			];
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			progress = resetProgress();
		} finally {
			isTranslating = false;
		}
	}
</script>

<div class="max-w-4xl">
	<h1 class="text-2xl font-bold text-gray-900 mb-6">Translate Document</h1>

	<div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
		<div>
			<label class="block text-sm font-medium text-gray-700 mb-2">
				Select document to translate:
			</label>
			<select
				bind:value={selectedDocId}
				disabled={isTranslating}
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
					data-testid="model-select"
					bind:value={model}
					disabled={isTranslating}
					class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
				>
					<option value="gpt-5.1">gpt-5.1</option>
					<option value="gpt-5-mini">gpt-5-mini</option>
					<option value="gpt-4.1">gpt-4.1</option>
					<option value="gpt-4.1-mini">gpt-4.1-mini</option>
				</select>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-2">Chunk Size:</label>
				<input
					type="number"
					bind:value={chunkSize}
					disabled={isTranslating}
					class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
				/>
			</div>
		</div>

		{#if is5SeriesModel}
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-2">Reasoning Effort:</label>
				<select
					bind:value={reasoningEffort}
					disabled={isTranslating}
					class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
				>
					{#each reasoningEffortOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
				</select>
			</div>
		{/if}

		<button
			onclick={handleTranslate}
			class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			disabled={!selectedDocId || isTranslating}
		>
			{#if isTranslating}
				Translating...
			{:else}
				Start Translation
			{/if}
		</button>

		<ProgressIndicator {progress} />
	</div>

	{#if error}
		<div class="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-700">{error}</p>
		</div>
	{/if}

	{#if japaneseOnlyMarkdown || bilingualMarkdown}
		<div class="mt-6 bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Translation Results</h2>

			<!-- Tabs -->
			<div class="flex border-b border-gray-200 mb-4" role="tablist">
				<button
					role="tab"
					aria-selected={activeTab === 'japanese-only'}
					onclick={() => (activeTab = 'japanese-only')}
					class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'japanese-only'
						? 'border-blue-600 text-blue-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Japanese Only
				</button>
				<button
					role="tab"
					aria-selected={activeTab === 'bilingual'}
					onclick={() => (activeTab = 'bilingual')}
					class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'bilingual'
						? 'border-blue-600 text-blue-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Bilingual
				</button>
			</div>

			<!-- Tab Content -->
			<div class="prose prose-sm max-w-none bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
				{#if activeTab === 'japanese-only'}
					<pre class="whitespace-pre-wrap text-sm text-gray-800">{japaneseOnlyMarkdown}</pre>
				{:else}
					<pre class="whitespace-pre-wrap text-sm text-gray-800">{bilingualMarkdown}</pre>
				{/if}
			</div>
		</div>
	{/if}
</div>
