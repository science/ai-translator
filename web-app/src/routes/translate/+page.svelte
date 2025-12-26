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
		getLanguageHistory,
		addLanguageToHistory
	} from '$lib/languageHistory';
	import { getLanguageCode } from '$lib/languageCode';
	import {
		MODELS,
		DEFAULT_MODEL,
		is5SeriesModel as checkIs5Series,
		getReasoningEffortOptions
	} from '$lib/models';

	// Browser services for direct OpenAI calls
	import { chunkBySize } from '$lib/services/chunker';
	import { createTranslator } from '$lib/services/translator';
	import { translateDocument } from '$lib/services/translationEngine';
	import { exportMarkdownAsDocx } from '$lib/services/docxExporter';
	import { estimateJobCost, calculateCost, getReasoningMultiplier, DEFAULT_REASONING_MULTIPLIERS, type CostEstimate, type TokenUsage, type ReasoningMultipliers } from '$lib/services/costCalculator';

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
	let contextAware = $state(true);
	let isTranslating = $state(false);
	let translatedOnlyMarkdown = $state('');
	let bilingualMarkdown = $state('');
	let activeTab = $state<'translated-only' | 'bilingual'>('translated-only');
	let error = $state('');
	let progress = $state<ProgressState>(resetProgress());

	// Cost tracking state
	let costEstimate = $state<CostEstimate | null>(null);
	let finalCost = $state<{ usage: TokenUsage; cost: number } | null>(null);
	let reasoningMultipliers = $state<ReasoningMultipliers>({ ...DEFAULT_REASONING_MULTIPLIERS });

	// Target language state
	let targetLanguage = $state('');
	let languageHistory = $state<string[]>([]);
	let languageTouched = $state(false);
	let showLanguageDropdown = $state(false);

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

			const storedContextAware = localStorage.getItem('context_aware_enabled');
			if (storedContextAware !== null) {
				contextAware = storedContextAware === 'true';
			}

			// Load reasoning multipliers from localStorage
			const storedMultipliers = localStorage.getItem('reasoning_multipliers');
			if (storedMultipliers) {
				try {
					const parsed = JSON.parse(storedMultipliers);
					reasoningMultipliers = { ...DEFAULT_REASONING_MULTIPLIERS, ...parsed };
				} catch {
					// Invalid JSON, use defaults
				}
			}

			// Load language history
			languageHistory = getLanguageHistory();
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

	// Compute active reasoning multiplier for display
	let activeReasoningMultiplier = $derived(
		is5SeriesModel ? getReasoningMultiplier(reasoningEffort, reasoningMultipliers) : 1.0
	);
	let showReasoningIndicator = $derived(activeReasoningMultiplier > 1.0);

	// Validation: language is required
	let languageError = $derived(languageTouched && !targetLanguage.trim() ? 'Target language is required' : '');

	// Can translate when document selected AND language filled
	let canTranslate = $derived(!!selectedDocId && !!targetLanguage.trim());

	// Compute cost estimate when document and model are selected
	async function updateCostEstimate(
		docId: string,
		selectedModel: string,
		selectedChunkSize: number,
		selectedReasoningEffort: string,
		selectedMultipliers: ReasoningMultipliers
	) {
		if (!docId) {
			costEstimate = null;
			return;
		}

		try {
			const doc = await getDocument(docId);
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

			const chunks = chunkBySize(content, selectedChunkSize);
			const chunkContents = chunks.map(c => c.content);
			costEstimate = estimateJobCost(chunkContents, selectedModel, 'translate', selectedReasoningEffort, selectedMultipliers);
		} catch {
			costEstimate = null;
		}
	}

	// Re-estimate when relevant inputs change
	// Pass all reactive values as parameters so Svelte 5 tracks them as dependencies
	$effect(() => {
		if (browser && selectedDocId && model) {
			updateCostEstimate(selectedDocId, model, chunkSize, reasoningEffort, reasoningMultipliers);
		}
	});

	/**
	 * Assembles translated-only markdown from translated chunks
	 */
	function assembleTranslatedOnly(
		chunks: Array<{ translatedContent: string }>
	): string {
		return chunks.map((chunk) => chunk.translatedContent).join('\n\n');
	}

	/**
	 * Select a language from history
	 */
	function selectLanguageFromHistory(language: string) {
		targetLanguage = language;
		showLanguageDropdown = false;
		languageTouched = true;
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
		if (!selectedDocInfo || !targetLanguage.trim()) return;

		isTranslating = true;
		error = '';
		translatedOnlyMarkdown = '';
		bilingualMarkdown = '';
		finalCost = null;
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
				reasoningEffort: is5SeriesModel ? reasoningEffort : undefined,
				targetLanguage: targetLanguage.trim()
			});

			// Step 3: Translate document with progress callback
			const { translatedChunks, totalUsage } = await translateDocument(chunks, translator.translateChunk, {
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
						message: `Translating chunk ${prog.current}/${prog.total}...`,
						costData: progressCostData
					});
				}
			});

			// Step 4: Assemble outputs
			progress = updateProgress(progress as ReturnType<typeof createDeterminateProgress>, {
				percentage: 95,
				message: 'Assembling results...'
			});

			translatedOnlyMarkdown = assembleTranslatedOnly(translatedChunks);
			bilingualMarkdown = assembleBilingual(translatedChunks);

			// Calculate final cost
			const finalCostUsd = calculateCost(totalUsage, model);
			finalCost = { usage: totalUsage, cost: finalCostUsd };

			progress = completeProgress(
				progress as ReturnType<typeof createDeterminateProgress>,
				'Translation complete!'
			);

			// Add language to history
			addLanguageToHistory(targetLanguage.trim());
			languageHistory = getLanguageHistory();

			// Store both translated documents in IndexedDB
			const baseName = selectedDoc.name.replace(/\.md$/i, '');
			const langCode = getLanguageCode(targetLanguage);

			// Save translated-only version
			const translatedDoc: StoredDocument = {
				id: generateDocumentId(),
				name: `${baseName}-${langCode}.md`,
				type: 'markdown',
				content: translatedOnlyMarkdown,
				size: new Blob([translatedOnlyMarkdown]).size,
				uploadedAt: new Date().toISOString(),
				phase: 'translated',
				variant: 'translated-only',
				sourceDocumentId: selectedDoc.id
			};
			await saveDocument(translatedDoc);

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
					id: translatedDoc.id,
					name: translatedDoc.name,
					type: translatedDoc.type,
					size: translatedDoc.size,
					uploadedAt: translatedDoc.uploadedAt
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

	function downloadMarkdown(content: string, filename: string) {
		const blob = new Blob([content], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	async function downloadDocx(content: string, filename: string) {
		const docxFilename = filename.replace(/\.md$/i, '.docx');
		await exportMarkdownAsDocx(content, docxFilename);
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

		<div class="relative">
			<label class="block text-sm font-medium text-gray-700 mb-2">
				Target Language and Tone: <span class="text-red-500">*</span>
			</label>
			<input
				data-testid="target-language-input"
				type="text"
				bind:value={targetLanguage}
				disabled={isTranslating}
				placeholder='e.g., "Japanese", "formal German", "conversational Spanish"'
				onfocus={() => { showLanguageDropdown = languageHistory.length > 0; }}
				onblur={() => { languageTouched = true; setTimeout(() => showLanguageDropdown = false, 200); }}
				class="block w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 {languageError ? 'border-red-500' : 'border-gray-300'}"
			/>
			{#if languageError}
				<p class="mt-1 text-sm text-red-500">{languageError}</p>
			{/if}
			{#if showLanguageDropdown && languageHistory.length > 0}
				<div
					data-testid="language-history-dropdown"
					class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
				>
					<div class="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b">Recent:</div>
					{#each languageHistory as historyItem}
						<button
							type="button"
							data-testid="language-history-item"
							onmousedown={(e) => { e.preventDefault(); selectLanguageFromHistory(historyItem); }}
							class="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
						>
							{historyItem}
						</button>
					{/each}
				</div>
			{/if}
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

		{#if costEstimate && selectedDocId && !isTranslating}
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
						{#if showReasoningIndicator}
							<span data-testid="reasoning-multiplier-indicator" class="text-xs text-blue-600 ml-1">(×{activeReasoningMultiplier} reasoning)</span>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<button
			onclick={handleTranslate}
			class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			disabled={!canTranslate || isTranslating}
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

	{#if translatedOnlyMarkdown || bilingualMarkdown}
		<div class="mt-6 bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Translation Results</h2>

			{#if finalCost}
				<div data-testid="final-cost" class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
					<h3 class="text-sm font-medium text-green-800 mb-2">Translation Complete</h3>
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

			<!-- Tabs -->
			<div class="flex border-b border-gray-200 mb-4" role="tablist">
				<button
					role="tab"
					aria-selected={activeTab === 'translated-only'}
					onclick={() => (activeTab = 'translated-only')}
					class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'translated-only'
						? 'border-blue-600 text-blue-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Target Language Only
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

			<!-- Download Buttons -->
			<div class="flex gap-2 mb-4">
				{#if activeTab === 'translated-only' && translatedOnlyMarkdown}
					{@const baseName = selectedDocInfo?.name.replace(/\.md$/i, '') || 'translation'}
					{@const langCode = getLanguageCode(targetLanguage)}
					<button
						data-testid="download-md-translated"
						onclick={() => downloadMarkdown(translatedOnlyMarkdown, `${baseName}-${langCode}.md`)}
						class="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-1.5"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
						</svg>
						Download Markdown
					</button>
					<button
						data-testid="download-docx-translated"
						onclick={() => downloadDocx(translatedOnlyMarkdown, `${baseName}-${langCode}.md`)}
						class="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors flex items-center gap-1.5"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						Download DOCX
					</button>
				{:else if activeTab === 'bilingual' && bilingualMarkdown}
					{@const baseName = selectedDocInfo?.name.replace(/\.md$/i, '') || 'translation'}
					<button
						data-testid="download-md-bilingual"
						onclick={() => downloadMarkdown(bilingualMarkdown, `${baseName}-bilingual.md`)}
						class="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-1.5"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
						</svg>
						Download Markdown
					</button>
					<button
						data-testid="download-docx-bilingual"
						onclick={() => downloadDocx(bilingualMarkdown, `${baseName}-bilingual.md`)}
						class="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors flex items-center gap-1.5"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						Download DOCX
					</button>
				{/if}
			</div>

			<!-- Tab Content -->
			<div class="prose prose-sm max-w-none bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
				{#if activeTab === 'translated-only'}
					<pre class="whitespace-pre-wrap text-sm text-gray-800">{translatedOnlyMarkdown}</pre>
				{:else}
					<pre class="whitespace-pre-wrap text-sm text-gray-800">{bilingualMarkdown}</pre>
				{/if}
			</div>
		</div>
	{/if}
</div>
