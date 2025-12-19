<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import {
		type StoredDocument,
		saveDocument,
		generateDocumentId
	} from '$lib/storage';
	import {
		type ProgressState,
		createDeterminateProgress,
		createIndeterminateProgress,
		updateProgress,
		addActivity,
		completeProgress,
		resetProgress
	} from '$lib/progress';
	import ProgressIndicator from '$lib/components/ProgressIndicator.svelte';
	import PhaseIndicator from '$lib/components/PhaseIndicator.svelte';
	import {
		type WorkflowState,
		type WorkflowPhase,
		type CleanupSettings,
		type TranslationSettings,
		createWorkflowState,
		createWorkflowPhases,
		startWorkflow,
		updatePhaseStatus,
		isWorkflowComplete,
		hasWorkflowError,
		getElapsedTime,
		formatElapsedTime
	} from '$lib/workflow';
	import { runWorkflow, type WorkflowResult } from '$lib/services/workflowEngine';
	import { exportMarkdownAsDocx } from '$lib/services/docxExporter';
	import { getLanguageHistory, addLanguageToHistory } from '$lib/languageHistory';
	import { getLanguageCode } from '$lib/languageCode';
	import {
		MODELS,
		DEFAULT_MODEL,
		is5SeriesModel as checkIs5Series,
		getReasoningEffortOptions
	} from '$lib/models';

	// File type detection
	type UploadedFileType = 'pdf' | 'markdown';

	function getFileType(file: File): UploadedFileType {
		if (file.type === 'application/pdf') return 'pdf';
		const ext = file.name.split('.').pop()?.toLowerCase();
		if (ext === 'pdf') return 'pdf';
		return 'markdown'; // .md, .markdown, .txt all treated as markdown
	}

	function isAcceptedFile(file: File): boolean {
		const ext = file.name.split('.').pop()?.toLowerCase();
		return file.type === 'application/pdf' || ext === 'pdf' || ext === 'md' || ext === 'markdown';
	}

	// State
	let workflowState = $state<WorkflowState>(createWorkflowState());
	let selectedFile = $state<File | null>(null);
	let selectedFileType = $state<UploadedFileType | null>(null);
	let isDragging = $state(false);
	let error = $state('');
	let currentProgress = $state<ProgressState>(resetProgress());
	let workflowResult = $state<WorkflowResult | null>(null);
	let activeResultTab = $state<'translated-only' | 'bilingual'>('translated-only');

	// Settings state (bound to form inputs)
	let cleanupModel = $state(DEFAULT_MODEL);
	let cleanupChunkSize = $state(4000);
	let cleanupReasoningEffort = $state('medium');
	let translationModel = $state(DEFAULT_MODEL);
	let translationChunkSize = $state(4000);
	let translationReasoningEffort = $state('medium');
	let translationContextAware = $state(true);

	// Target language state
	let targetLanguage = $state('');
	let languageHistory = $state<string[]>([]);
	let languageTouched = $state(false);
	let showLanguageDropdown = $state(false);

	// Derived state - now requires target language
	let canStartWorkflow = $derived(selectedFile !== null && !workflowState.isRunning && !!targetLanguage.trim());
	let showProgress = $derived(workflowState.isRunning || isWorkflowComplete(workflowState));
	let showResults = $derived(isWorkflowComplete(workflowState) && workflowResult !== null);

	// Check if the selected model is a 5-series model (supports reasoning effort)
	let isCleanup5Series = $derived(checkIs5Series(cleanupModel));
	let isTranslation5Series = $derived(checkIs5Series(translationModel));

	// Get reasoning effort options based on model type (from centralized config)
	let cleanupReasoningOptions = $derived(getReasoningEffortOptions(cleanupModel) || []);
	let translationReasoningOptions = $derived(getReasoningEffortOptions(translationModel) || []);

	onMount(async () => {
		if (browser) {
			// Load saved settings from localStorage
			const savedCleanupModel = localStorage.getItem('default_model');
			const savedChunkSize = localStorage.getItem('default_chunk_size');
			const savedReasoningEffort = localStorage.getItem('default_reasoning_effort');
			const savedContextAware = localStorage.getItem('context_aware_enabled');

			if (savedCleanupModel) {
				cleanupModel = savedCleanupModel;
				translationModel = savedCleanupModel;
			}
			if (savedChunkSize) {
				const size = parseInt(savedChunkSize, 10);
				cleanupChunkSize = size;
				translationChunkSize = size;
			}
			if (savedReasoningEffort) {
				cleanupReasoningEffort = savedReasoningEffort;
				translationReasoningEffort = savedReasoningEffort;
			}
			if (savedContextAware !== null) {
				translationContextAware = savedContextAware === 'true';
			}

			// Load language history
			languageHistory = getLanguageHistory();
		}
	});

	function selectLanguageFromHistory(lang: string) {
		targetLanguage = lang;
		showLanguageDropdown = false;
		languageTouched = true;
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			const file = files[0];
			if (isAcceptedFile(file)) {
				selectedFile = file;
				selectedFileType = getFileType(file);
				error = '';
			} else {
				error = 'Please select a PDF or Markdown file';
			}
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			if (isAcceptedFile(file)) {
				selectedFile = file;
				selectedFileType = getFileType(file);
				error = '';
			} else {
				error = 'Please select a PDF or Markdown file';
			}
		}
	}

	async function handleStartWorkflow() {
		if (!selectedFile || !selectedFileType) return;

		// Get API key
		const apiKey = localStorage.getItem('openai_api_key');
		if (!apiKey) {
			error = 'OpenAI API key not found. Please set it in Settings.';
			return;
		}

		// Determine if we're skipping the convert phase
		const isMarkdownInput = selectedFileType === 'markdown';

		// Reset state with correct phases
		error = '';
		workflowResult = null;

		// Update workflow state with correct phases based on file type
		workflowState = {
			...createWorkflowState(),
			phases: createWorkflowPhases(isMarkdownInput)
		};
		workflowState = startWorkflow(workflowState);

		const cleanupSettings: CleanupSettings = {
			model: cleanupModel,
			chunkSize: cleanupChunkSize,
			reasoningEffort: cleanupReasoningEffort
		};

		const translationSettings: TranslationSettings = {
			model: translationModel,
			chunkSize: translationChunkSize,
			reasoningEffort: translationReasoningEffort,
			contextAware: translationContextAware,
			targetLanguage
		};

		try {
			// Read file based on type
			let workflowOptions: Parameters<typeof runWorkflow>[0];

			if (isMarkdownInput) {
				// Read markdown file as text
				const markdownContent = await selectedFile.text();
				workflowOptions = {
					markdownContent,
					apiKey,
					cleanupSettings,
					translationSettings,
					callbacks: {}
				};
			} else {
				// Read PDF file as ArrayBuffer
				const pdfBuffer = await selectedFile.arrayBuffer();
				workflowOptions = {
					pdfBuffer: new Uint8Array(pdfBuffer),
					apiKey,
					cleanupSettings,
					translationSettings,
					callbacks: {}
				};
			}

			// Run the workflow with appropriate callbacks
			const result = await runWorkflow({
				...workflowOptions,
				callbacks: {
					onPhaseStart: (phaseId) => {
						workflowState = updatePhaseStatus(workflowState, phaseId, 'in_progress');

						// Set up progress tracking for this phase
						if (phaseId === 'convert') {
							currentProgress = createIndeterminateProgress('Converting PDF to markdown...');
							currentProgress = addActivity(currentProgress as ReturnType<typeof createIndeterminateProgress>, 'Reading PDF file...');
						} else if (phaseId === 'cleanup') {
							currentProgress = createDeterminateProgress('Starting cleanup...', 0);
						} else if (phaseId === 'translate') {
							currentProgress = createDeterminateProgress('Starting translation...', 0);
						}
					},
					onPhaseProgress: (phaseId, progress) => {
						if (currentProgress.type === 'determinate') {
							currentProgress = updateProgress(currentProgress, {
								percentage: progress.percentComplete,
								message: `Processing chunk ${progress.current}/${progress.total}...`
							});
						}
					},
					onPhaseComplete: (phaseId, result) => {
						workflowState = updatePhaseStatus(workflowState, phaseId, 'completed', {
							result: typeof result === 'string' ? result : JSON.stringify(result)
						});

						// Move to next phase
						const phaseIndex = workflowState.phases.findIndex(p => p.id === phaseId);
						if (phaseIndex < workflowState.phases.length - 1) {
							workflowState.currentPhaseIndex = phaseIndex + 1;
						} else {
							workflowState.isRunning = false;
							workflowState.endTime = Date.now();
						}

						if (phaseId === 'convert') {
							currentProgress = completeProgress(
								currentProgress as ReturnType<typeof createIndeterminateProgress>,
								'PDF converted successfully!'
							);
						} else {
							currentProgress = completeProgress(
								currentProgress as ReturnType<typeof createDeterminateProgress>,
								`${phaseId === 'cleanup' ? 'Cleanup' : 'Translation'} complete!`
							);
						}
					},
					onPhaseError: (phaseId, err) => {
						workflowState = updatePhaseStatus(workflowState, phaseId, 'error', {
							error: err.message
						});
						workflowState.isRunning = false;
						currentProgress = resetProgress();
					}
				}
			});

			workflowResult = result;

			// Save language to history
			addLanguageToHistory(targetLanguage);
			languageHistory = getLanguageHistory();

			// Save all output documents
			const baseName = selectedFile.name.replace(/\.(pdf|md|markdown)$/i, '');
			const langCode = getLanguageCode(targetLanguage);

			let sourceDocId: string | undefined;

			// Only save converted markdown for PDF input (not for markdown input)
			if (!isMarkdownInput) {
				const convertedDoc: StoredDocument = {
					id: generateDocumentId(),
					name: `${baseName}-converted.md`,
					type: 'markdown',
					content: result.markdown,
					size: new Blob([result.markdown]).size,
					uploadedAt: new Date().toISOString(),
					phase: 'converted'
				};
				await saveDocument(convertedDoc);
				sourceDocId = convertedDoc.id;
			}

			// Save cleaned markdown
			const cleanedDoc: StoredDocument = {
				id: generateDocumentId(),
				name: `${baseName}-cleaned.md`,
				type: 'markdown',
				content: result.cleaned,
				size: new Blob([result.cleaned]).size,
				uploadedAt: new Date().toISOString(),
				phase: 'cleaned',
				...(sourceDocId ? { sourceDocumentId: sourceDocId } : {})
			};
			await saveDocument(cleanedDoc);

			// Save translated-only version
			const translatedDoc: StoredDocument = {
				id: generateDocumentId(),
				name: `${baseName}-${langCode}.md`,
				type: 'markdown',
				content: result.japaneseOnly,
				size: new Blob([result.japaneseOnly]).size,
				uploadedAt: new Date().toISOString(),
				phase: 'translated',
				variant: 'translated-only',
				sourceDocumentId: cleanedDoc.id
			};
			await saveDocument(translatedDoc);

			// Save bilingual translation
			const bilingualDoc: StoredDocument = {
				id: generateDocumentId(),
				name: `${baseName}-bilingual.md`,
				type: 'markdown',
				content: result.bilingual,
				size: new Blob([result.bilingual]).size,
				uploadedAt: new Date().toISOString(),
				phase: 'translated',
				variant: 'bilingual',
				sourceDocumentId: cleanedDoc.id
			};
			await saveDocument(bilingualDoc);

		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			workflowState.isRunning = false;
		}
	}

	function handleStartOver() {
		workflowState = createWorkflowState();
		selectedFile = null;
		selectedFileType = null;
		workflowResult = null;
		currentProgress = resetProgress();
		error = '';
	}

	function downloadResult(content: string, filename: string) {
		const blob = new Blob([content], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function downloadAsDocx(content: string, filename: string) {
		const docxFilename = filename.replace(/\.md$/i, '.docx');
		await exportMarkdownAsDocx(content, docxFilename);
	}
</script>

<div class="max-w-4xl">
	<h1 class="text-2xl font-bold text-gray-900 mb-2">One Step Translation</h1>
	<p class="text-gray-600 mb-6">Convert PDF to your target language in one automated process</p>

	{#if !showResults}
		<!-- Step 1: Upload Document -->
		<div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
				<span class="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">1</span>
				Upload Document
			</h2>

			<div
				role="button"
				tabindex="0"
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
				ondrop={handleDrop}
				onclick={() => document.getElementById('file-input')?.click()}
				onkeydown={(e) => e.key === 'Enter' && document.getElementById('file-input')?.click()}
				class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors {isDragging
					? 'border-blue-500 bg-blue-50'
					: selectedFile
						? 'border-green-500 bg-green-50'
						: 'border-gray-300 hover:border-gray-400'}"
			>
				<input
					type="file"
					id="file-input"
					accept=".pdf,.md,.markdown,application/pdf,text/markdown"
					onchange={handleFileSelect}
					class="hidden"
					disabled={workflowState.isRunning}
				/>
				{#if selectedFile}
					<svg class="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p class="mt-2 text-sm font-medium text-gray-900">{selectedFile.name}</p>
					<p class="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
				{:else}
					<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
					</svg>
					<p class="mt-2 text-sm text-gray-600">
						<span class="font-semibold text-blue-600">Click to upload</span> or drag and drop
					</p>
					<p class="text-xs text-gray-500">PDF or Markdown files</p>
				{/if}
			</div>
		</div>

		<!-- Step 2: Cleanup Settings -->
		<div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
				<span class="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">2</span>
				Cleanup Settings
			</h2>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Model</label>
					<select
						bind:value={cleanupModel}
						disabled={workflowState.isRunning}
						class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 text-sm"
					>
						{#each MODELS as m (m.id)}
							<option value={m.id}>{m.label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Chunk Size</label>
					<input
						type="number"
						bind:value={cleanupChunkSize}
						disabled={workflowState.isRunning}
						class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 text-sm"
					/>
				</div>
				{#if isCleanup5Series}
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Reasoning Effort</label>
						<select
							bind:value={cleanupReasoningEffort}
							disabled={workflowState.isRunning}
							class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 text-sm"
						>
							{#each cleanupReasoningOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>
		</div>

		<!-- Step 3: Target Language and Tone -->
		<div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
				<span class="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">3</span>
				Target language and tone
			</h2>

			<div class="relative">
				<label for="target-language" class="block text-sm font-medium text-gray-700 mb-1">
					Target language and tone <span class="text-red-500">*</span>
				</label>
				<input
					data-testid="target-language-input"
					id="target-language"
					type="text"
					bind:value={targetLanguage}
					placeholder='e.g., "Japanese", "formal German", "conversational Spanish"'
					disabled={workflowState.isRunning}
					class="block w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 border-gray-300"
					onfocus={() => { showLanguageDropdown = languageHistory.length > 0; }}
					onblur={() => { languageTouched = true; setTimeout(() => showLanguageDropdown = false, 200); }}
				/>

				{#if showLanguageDropdown && languageHistory.length > 0}
					<div
						data-testid="language-history-dropdown"
						class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"
					>
						<div class="px-3 py-2 text-xs font-medium text-gray-500 border-b">Recent</div>
						{#each languageHistory as historyItem}
							<button
								type="button"
								data-testid="language-history-item"
								class="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
								onmousedown={(e) => { e.preventDefault(); selectLanguageFromHistory(historyItem); }}
							>
								{historyItem}
							</button>
						{/each}
					</div>
				{/if}

				<p class="mt-1 text-xs text-gray-500">
					Enter a language name or style description for your translation
				</p>
			</div>
		</div>

		<!-- Step 4: Translation Settings -->
		<div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
				<span class="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">4</span>
				Translation Settings
			</h2>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Model</label>
					<select
						bind:value={translationModel}
						disabled={workflowState.isRunning}
						class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 text-sm"
					>
						{#each MODELS as m (m.id)}
							<option value={m.id}>{m.label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Chunk Size</label>
					<input
						type="number"
						bind:value={translationChunkSize}
						disabled={workflowState.isRunning}
						class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 text-sm"
					/>
				</div>
				{#if isTranslation5Series}
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Reasoning Effort</label>
						<select
							bind:value={translationReasoningEffort}
							disabled={workflowState.isRunning}
							class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 text-sm"
						>
							{#each translationReasoningOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>

			<label class="flex items-center gap-2 text-sm text-gray-700">
				<input
					type="checkbox"
					bind:checked={translationContextAware}
					disabled={workflowState.isRunning}
					class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
				/>
				<span class="flex items-center gap-1">
					Context-aware translation
					<span class="relative group">
						<svg class="w-4 h-4 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
							Provides the AI with surrounding context from previous chunks for better tone and terminology consistency
							<span class="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900"></span>
						</span>
					</span>
				</span>
			</label>
		</div>

		<!-- Start Button -->
		<button
			onclick={handleStartWorkflow}
			disabled={!canStartWorkflow}
			class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
		>
			{#if workflowState.isRunning}
				<svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				Processing...
			{:else}
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				Start One Step Translation
			{/if}
		</button>
	{/if}

	{#if error}
		<div class="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-700">{error}</p>
		</div>
	{/if}

	{#if showProgress}
		<!-- Progress Section -->
		<div class="mt-6 bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">
				{#if isWorkflowComplete(workflowState)}
					Workflow Complete
				{:else}
					Processing...
				{/if}
			</h2>

			<!-- Phase Indicator -->
			<div class="mb-6">
				<PhaseIndicator phases={workflowState.phases} />
			</div>

			{#if workflowState.isRunning}
				<!-- Current Phase Progress -->
				<div class="mt-4">
					<ProgressIndicator progress={currentProgress} />
				</div>
			{/if}

			{#if isWorkflowComplete(workflowState)}
				<div class="mt-4 text-center text-sm text-gray-600">
					Total time: {formatElapsedTime(getElapsedTime(workflowState))}
				</div>
			{/if}
		</div>
	{/if}

	{#if showResults && workflowResult}
		{@const langCode = getLanguageCode(targetLanguage)}
		{@const isMarkdownInput = selectedFileType === 'markdown'}
		{@const baseName = selectedFile?.name.replace(/\.(pdf|md|markdown)$/i, '')}
		<!-- Results Section -->
		<div class="mt-6 bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Output Documents</h2>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
				{#each [
					// Skip "Original/Converted Markdown" for markdown input since user already has the source
					...(isMarkdownInput ? [] : [{ label: 'Converted Markdown', key: 'markdown', filename: `${baseName}-converted.md` }]),
					{ label: 'Cleaned Markdown', key: 'cleaned', filename: `${baseName}-cleaned.md` },
					{ label: 'Target Language Only', key: 'japaneseOnly', filename: `${baseName}-${langCode}.md` },
					{ label: 'Bilingual', key: 'bilingual', filename: `${baseName}-bilingual.md` }
				] as output}
					<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
						<span class="text-sm font-medium text-gray-700">{output.label}</span>
						<div class="flex gap-2">
							<button
								data-testid="download-md-{output.key}"
								onclick={() => workflowResult && downloadResult(workflowResult[output.key as keyof WorkflowResult], output.filename)}
								class="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
								title="Download as Markdown"
							>
								MD
							</button>
							<button
								data-testid="download-docx-{output.key}"
								onclick={() => workflowResult && downloadAsDocx(workflowResult[output.key as keyof WorkflowResult], output.filename)}
								class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
								title="Download as Word document"
							>
								DOCX
							</button>
						</div>
					</div>
				{/each}
			</div>

			<!-- Preview Tabs -->
			<h3 class="text-sm font-semibold text-gray-900 mb-2">Preview Translation</h3>
			<div class="flex border-b border-gray-200 mb-4" role="tablist">
				<button
					role="tab"
					aria-selected={activeResultTab === 'translated-only'}
					onclick={() => (activeResultTab = 'translated-only')}
					class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeResultTab === 'translated-only'
						? 'border-blue-600 text-blue-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Target Language Only
				</button>
				<button
					role="tab"
					aria-selected={activeResultTab === 'bilingual'}
					onclick={() => (activeResultTab = 'bilingual')}
					class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeResultTab === 'bilingual'
						? 'border-blue-600 text-blue-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Bilingual
				</button>
			</div>

			<div class="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
				<pre class="whitespace-pre-wrap text-sm text-gray-800">{activeResultTab === 'translated-only' ? workflowResult.japaneseOnly : workflowResult.bilingual}</pre>
			</div>
		</div>

		<!-- Actions -->
		<div class="mt-6 flex gap-4">
			<button
				onclick={handleStartOver}
				class="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
			>
				Start New Workflow
			</button>
			<a
				href="/documents"
				class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-center"
			>
				View All Documents
			</a>
		</div>
	{/if}
</div>
