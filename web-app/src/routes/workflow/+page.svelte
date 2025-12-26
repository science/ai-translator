<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import {
		type StoredDocument,
		saveDocument,
		generateDocumentId,
		getAllDocuments,
		getDocument
	} from '$lib/storage';
	import {
		type ProgressState,
		type CostData,
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
	import { runWorkflow, type WorkflowResult, type UsageByPhase } from '$lib/services/workflowEngine';
	import { exportMarkdownAsDocx } from '$lib/services/docxExporter';
	import { getLanguageHistory, addLanguageToHistory } from '$lib/languageHistory';
	import { getLanguageCode } from '$lib/languageCode';
	import {
		MODELS,
		DEFAULT_MODEL,
		is5SeriesModel as checkIs5Series,
		getReasoningEffortOptions
	} from '$lib/models';
	import { calculateCost, estimateWorkflowCost, getReasoningMultiplier, DEFAULT_REASONING_MULTIPLIERS, type TokenUsage, type WorkflowCostEstimate, type ReasoningMultipliers } from '$lib/services/costCalculator';

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

	// Document selection state
	interface DocumentListItem {
		id: string;
		name: string;
		type: 'pdf' | 'markdown' | 'text';
		size: number;
		uploadedAt: string;
	}
	let documents = $state<DocumentListItem[]>([]);
	let selectedDocId = $state('');
	let selectedDocContent = $state<string | null>(null);

	// Cost estimation state
	let costEstimate = $state<WorkflowCostEstimate | null>(null);
	let isConverting = $state(false);
	let reasoningMultipliers = $state<ReasoningMultipliers>({ ...DEFAULT_REASONING_MULTIPLIERS });

	// Derived state - now requires target language and either file or selected document
	let hasDocumentInput = $derived(selectedFile !== null || selectedDocId !== '');
	let canStartWorkflow = $derived(hasDocumentInput && !workflowState.isRunning && !!targetLanguage.trim());
	let showProgress = $derived(workflowState.isRunning || isWorkflowComplete(workflowState));
	let showResults = $derived(isWorkflowComplete(workflowState) && workflowResult !== null);

	// Document type detection for selected document
	let selectedDocInfo = $derived(documents.find(d => d.id === selectedDocId));
	let selectedDocType = $derived<UploadedFileType | null>(
		selectedFile ? getFileType(selectedFile) :
		selectedDocInfo ? (selectedDocInfo.type === 'pdf' ? 'pdf' : 'markdown') :
		null
	);
	let needsConversion = $derived(selectedDocType === 'pdf');
	let canShowEstimate = $derived(
		hasDocumentInput &&
		!!targetLanguage.trim() &&
		(selectedDocType === 'markdown' || selectedDocContent !== null)
	);
	let showConvertButton = $derived(
		needsConversion &&
		!costEstimate &&
		!isConverting &&
		selectedDocId !== '' // Only for selected documents, not file uploads
	);

	// Filter documents to show PDF and markdown only
	let selectableDocuments = $derived(documents.filter(d => d.type === 'pdf' || d.type === 'markdown'));

	// Check if the selected model is a 5-series model (supports reasoning effort)
	let isCleanup5Series = $derived(checkIs5Series(cleanupModel));
	let isTranslation5Series = $derived(checkIs5Series(translationModel));

	// Get reasoning effort options based on model type (from centralized config)
	let cleanupReasoningOptions = $derived(getReasoningEffortOptions(cleanupModel) || []);
	let translationReasoningOptions = $derived(getReasoningEffortOptions(translationModel) || []);

	// Compute active reasoning multipliers for display
	let cleanupReasoningMultiplier = $derived(
		isCleanup5Series ? getReasoningMultiplier(cleanupReasoningEffort, reasoningMultipliers) : 1.0
	);
	let translationReasoningMultiplier = $derived(
		isTranslation5Series ? getReasoningMultiplier(translationReasoningEffort, reasoningMultipliers) : 1.0
	);
	let showCleanupReasoningIndicator = $derived(cleanupReasoningMultiplier > 1.0);
	let showTranslationReasoningIndicator = $derived(translationReasoningMultiplier > 1.0);

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

	async function handleDocumentSelect(event: Event) {
		const select = event.target as HTMLSelectElement;
		const docId = select.value;

		// Clear file selection when document is selected
		if (docId) {
			selectedFile = null;
			selectedFileType = null;
		}

		selectedDocId = docId;
		selectedDocContent = null;
		costEstimate = null;

		if (!docId) return;

		// Load document content
		const doc = await getDocument(docId);
		if (!doc) return;

		// For markdown, we can calculate estimate immediately
		if (doc.type === 'markdown') {
			let content: string;
			if (typeof doc.content === 'string') {
				content = doc.content;
			} else {
				content = await doc.content.text();
			}
			selectedDocContent = content;
			selectedFileType = 'markdown';
			updateCostEstimate(content);
		} else {
			selectedFileType = 'pdf';
			// For PDF, user needs to click "Convert & Estimate" button
		}
	}

	function updateCostEstimate(content: string) {
		if (!content) {
			costEstimate = null;
			return;
		}
		costEstimate = estimateWorkflowCost(
			content,
			cleanupModel,
			translationModel,
			Math.min(cleanupChunkSize, translationChunkSize),
			cleanupReasoningEffort,
			translationReasoningEffort,
			reasoningMultipliers
		);
	}

	// Re-estimate cost when models, chunk sizes, or reasoning efforts change
	$effect(() => {
		// Only recalculate if we have content loaded
		if (browser && selectedDocContent) {
			// Directly use reactive variables so they're tracked
			costEstimate = estimateWorkflowCost(
				selectedDocContent,
				cleanupModel,
				translationModel,
				Math.min(cleanupChunkSize, translationChunkSize),
				cleanupReasoningEffort,
				translationReasoningEffort,
				reasoningMultipliers
			);
		}
	});

	onMount(async () => {
		if (browser) {
			// Load documents from IndexedDB
			await loadDocuments();

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
				// Clear document selection when file is uploaded
				selectedDocId = '';
				selectedDocContent = null;
				costEstimate = null;
				error = '';
				// For markdown files, calculate estimate immediately
				if (selectedFileType === 'markdown') {
					file.text().then(content => {
						selectedDocContent = content;
						updateCostEstimate(content);
					});
				}
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
				// Clear document selection when file is uploaded
				selectedDocId = '';
				selectedDocContent = null;
				costEstimate = null;
				error = '';
				// For markdown files, calculate estimate immediately
				if (selectedFileType === 'markdown') {
					file.text().then(content => {
						selectedDocContent = content;
						updateCostEstimate(content);
					});
				}
			} else {
				error = 'Please select a PDF or Markdown file';
			}
		}
	}

	async function handleStartWorkflow() {
		// Need either a file or a selected document
		if (!selectedFile && !selectedDocId) return;

		// Get API key
		const apiKey = localStorage.getItem('openai_api_key');
		if (!apiKey) {
			error = 'OpenAI API key not found. Please set it in Settings.';
			return;
		}

		// Determine the document type
		const isMarkdownInput = selectedDocType === 'markdown';

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
			// Read content based on source (file or selected document)
			let workflowOptions: Parameters<typeof runWorkflow>[0];

			if (selectedDocContent && isMarkdownInput) {
				// Use already-loaded markdown content from selected document
				workflowOptions = {
					markdownContent: selectedDocContent,
					apiKey,
					cleanupSettings,
					translationSettings,
					callbacks: {}
				};
			} else if (selectedFile && isMarkdownInput) {
				// Read markdown file as text
				const markdownContent = await selectedFile.text();
				workflowOptions = {
					markdownContent,
					apiKey,
					cleanupSettings,
					translationSettings,
					callbacks: {}
				};
			} else if (selectedFile) {
				// Read PDF file as ArrayBuffer
				const pdfBuffer = await selectedFile.arrayBuffer();
				workflowOptions = {
					pdfBuffer: new Uint8Array(pdfBuffer),
					apiKey,
					cleanupSettings,
					translationSettings,
					callbacks: {}
				};
			} else if (selectedDocId) {
				// Load PDF from selected document
				const doc = await getDocument(selectedDocId);
				if (!doc) {
					error = 'Document not found';
					return;
				}
				let pdfBuffer: ArrayBuffer;
				if (doc.content instanceof Blob) {
					pdfBuffer = await doc.content.arrayBuffer();
				} else {
					// String content - shouldn't happen for PDF but handle gracefully
					error = 'Invalid document format';
					return;
				}
				workflowOptions = {
					pdfBuffer: new Uint8Array(pdfBuffer),
					apiKey,
					cleanupSettings,
					translationSettings,
					callbacks: {}
				};
			} else {
				error = 'No document selected';
				return;
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
						if (currentProgress.type === 'determinate' && 'tokensUsed' in progress) {
							// Calculate cost based on phase model
							const phaseModel = phaseId === 'cleanup' ? cleanupModel : translationModel;
							const actualCostSoFar = calculateCost(progress.tokensUsed, phaseModel);
							const progressCostData: CostData = {
								tokensUsed: progress.tokensUsed,
								estimatedCost: 0, // We don't have pre-estimates for workflow yet
								actualCostSoFar
							};
							currentProgress = updateProgress(currentProgress, {
								percentage: progress.percentComplete,
								message: `Processing chunk ${progress.current}/${progress.total}...`,
								costData: progressCostData
							});
						} else if (currentProgress.type === 'determinate') {
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

			<!-- Document Selection Dropdown -->
			<div class="mt-4 pt-4 border-t border-gray-200">
				<p class="text-sm text-gray-500 text-center mb-2">Or select from existing documents:</p>
				<select
					data-testid="document-select"
					bind:value={selectedDocId}
					onchange={handleDocumentSelect}
					disabled={workflowState.isRunning || selectableDocuments.length === 0}
					class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 text-sm"
				>
					{#if selectableDocuments.length === 0}
						<option value="">No documents available</option>
					{:else}
						<option value="">Choose a document...</option>
						{#each selectableDocuments as doc (doc.id)}
							<option value={doc.id}>{doc.name} ({doc.type.toUpperCase()})</option>
						{/each}
					{/if}
				</select>
			</div>

			<!-- Cost Estimate Display -->
			{#if costEstimate}
				<div data-testid="cost-estimate" class="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
					<h3 class="text-sm font-semibold text-blue-800 mb-2">Estimated Cost</h3>
					<div class="grid grid-cols-2 gap-2 text-sm">
						<div>
							<span class="text-gray-600">Cleanup:</span>
							<span class="font-medium text-gray-900">${costEstimate.cleanup.estimatedCostUsd.toFixed(2)}</span>
							{#if showCleanupReasoningIndicator}
								<span data-testid="cleanup-reasoning-indicator" class="text-xs text-blue-600 ml-1">(×{cleanupReasoningMultiplier} reasoning)</span>
							{/if}
						</div>
						<div>
							<span class="text-gray-600">Translation:</span>
							<span class="font-medium text-gray-900">${costEstimate.translate.estimatedCostUsd.toFixed(2)}</span>
							{#if showTranslationReasoningIndicator}
								<span data-testid="translation-reasoning-indicator" class="text-xs text-blue-600 ml-1">(×{translationReasoningMultiplier} reasoning)</span>
							{/if}
						</div>
						<div class="col-span-2 pt-2 border-t border-blue-200">
							<span class="text-gray-700 font-medium">Combined:</span>
							<span class="font-bold text-blue-800">${costEstimate.totalCostUsd.toFixed(2)}</span>
							<span class="text-gray-500 ml-2">({costEstimate.totalTokens.toLocaleString()} tokens)</span>
						</div>
					</div>
				</div>
			{/if}

			<!-- Convert & Estimate Button for PDF -->
			{#if showConvertButton}
				<div class="mt-4">
					<button
						data-testid="convert-estimate-button"
						onclick={async () => {
							// TODO: Implement PDF conversion for cost estimation
							isConverting = true;
							error = '';
							try {
								const doc = await getDocument(selectedDocId);
								if (!doc) {
									error = 'Document not found';
									return;
								}
								// For now, we'll need to implement PDF conversion here
								// This is a placeholder - the actual conversion will be implemented
								error = 'PDF conversion for cost estimation is not yet implemented';
							} finally {
								isConverting = false;
							}
						}}
						disabled={isConverting || workflowState.isRunning}
						class="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
					>
						{#if isConverting}
							Converting PDF...
						{:else}
							Convert & Estimate Cost
						{/if}
					</button>
					<p class="text-xs text-gray-500 mt-1 text-center">
						Converts PDF to markdown to calculate cost estimate
					</p>
				</div>
			{/if}
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
							data-testid="cleanup-reasoning-select"
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

			{#if workflowResult.totalUsage}
				{@const cleanupCost = calculateCost(workflowResult.usageByPhase.cleanup, cleanupModel)}
				{@const translateCost = calculateCost(workflowResult.usageByPhase.translate, translationModel)}
				{@const totalCost = cleanupCost + translateCost}
				<div data-testid="final-cost" class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
					<h3 class="text-sm font-medium text-green-800 mb-2">Workflow Complete</h3>
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
						<div>
							<span class="text-green-600">Total tokens:</span>
							<span class="font-medium text-green-800 ml-1">{workflowResult.totalUsage.totalTokens.toLocaleString()}</span>
						</div>
						<div>
							<span class="text-green-600">Cleanup cost:</span>
							<span class="font-medium text-green-800 ml-1">${cleanupCost.toFixed(2)}</span>
						</div>
						<div>
							<span class="text-green-600">Translation cost:</span>
							<span class="font-medium text-green-800 ml-1">${translateCost.toFixed(2)}</span>
						</div>
						<div>
							<span class="text-green-600">Total cost:</span>
							<span class="font-bold text-green-800 ml-1">${totalCost.toFixed(2)}</span>
						</div>
					</div>
				</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
				{#each [
					// Skip "Original/Converted Markdown" for markdown input since user already has the source
					...(isMarkdownInput ? [] : [{ label: 'Converted Markdown', key: 'markdown' as const, filename: `${baseName}-converted.md` }]),
					{ label: 'Cleaned Markdown', key: 'cleaned' as const, filename: `${baseName}-cleaned.md` },
					{ label: 'Target Language Only', key: 'japaneseOnly' as const, filename: `${baseName}-${langCode}.md` },
					{ label: 'Bilingual', key: 'bilingual' as const, filename: `${baseName}-bilingual.md` }
				] as output}
					<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
						<span class="text-sm font-medium text-gray-700">{output.label}</span>
						<div class="flex gap-2">
							<button
								data-testid="download-md-{output.key}"
								onclick={() => workflowResult && downloadResult(workflowResult[output.key], output.filename)}
								class="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
								title="Download as Markdown"
							>
								MD
							</button>
							<button
								data-testid="download-docx-{output.key}"
								onclick={() => workflowResult && downloadAsDocx(workflowResult[output.key], output.filename)}
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
