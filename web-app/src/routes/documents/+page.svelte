<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { marked } from 'marked';
	import {
		type StoredDocument,
		type DocumentPhase,
		type TranslationVariant,
		getAllDocuments,
		getDocument,
		deleteDocument as deleteDocFromDB
	} from '$lib/storage';

	// Display-friendly version of StoredDocument (content not needed for list)
	interface DocumentListItem {
		id: string;
		name: string;
		type: 'pdf' | 'markdown' | 'text';
		size: number;
		uploadedAt: string;
		phase: DocumentPhase;
		variant?: TranslationVariant;
	}

	type FilterPhase = 'all' | DocumentPhase;

	const PHASE_FILTERS: { key: FilterPhase; label: string }[] = [
		{ key: 'all', label: 'All' },
		{ key: 'uploaded', label: 'Uploaded' },
		{ key: 'converted', label: 'Converted' },
		{ key: 'cleaned', label: 'Cleaned' },
		{ key: 'translated', label: 'Translated' }
	];

	let documents = $state<DocumentListItem[]>([]);
	let activeFilter = $state<FilterPhase>('all');
	let searchQuery = $state('');
	let previewMenuDocId = $state<string | null>(null);

	// Computed filtered documents
	let filteredDocuments = $derived.by(() => {
		let result = documents;

		// Filter by phase
		if (activeFilter !== 'all') {
			result = result.filter((doc) => doc.phase === activeFilter);
		}

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter((doc) => doc.name.toLowerCase().includes(query));
		}

		return result;
	});

	onMount(async () => {
		if (browser) {
			await loadDocuments();
		}
	});

	async function loadDocuments() {
		if (browser) {
			const docs = await getAllDocuments();
			// Map to display-friendly format (exclude content for performance)
			documents = docs.map((doc) => ({
				id: doc.id,
				name: doc.name,
				type: doc.type,
				size: doc.size,
				uploadedAt: doc.uploadedAt,
				phase: doc.phase || 'uploaded', // Default for legacy docs without phase
				variant: doc.variant
			}));
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(isoString: string): string {
		const date = new Date(isoString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays === 0) return 'today';
		if (diffDays === 1) return 'yesterday';

		return date.toLocaleDateString();
	}

	function formatTypeLabel(type: 'pdf' | 'markdown' | 'text'): string {
		switch (type) {
			case 'pdf':
				return 'PDF';
			case 'markdown':
				return 'Markdown';
			case 'text':
				return 'Text';
			default:
				return type;
		}
	}

	function formatPhaseLabel(phase: DocumentPhase): string {
		return phase.charAt(0).toUpperCase() + phase.slice(1);
	}

	function getPhaseColor(phase: DocumentPhase): string {
		switch (phase) {
			case 'uploaded':
				return 'bg-gray-100 text-gray-700';
			case 'converted':
				return 'bg-blue-100 text-blue-700';
			case 'cleaned':
				return 'bg-green-100 text-green-700';
			case 'translated':
				return 'bg-purple-100 text-purple-700';
			default:
				return 'bg-gray-100 text-gray-700';
		}
	}

	function formatVariantLabel(variant?: TranslationVariant): string | null {
		if (!variant) return null;
		switch (variant) {
			case 'japanese-only':
				return 'Japanese';
			case 'bilingual':
				return 'Bilingual';
			default:
				return null;
		}
	}

	function getVariantColor(variant: TranslationVariant): string {
		switch (variant) {
			case 'japanese-only':
				return 'bg-pink-100 text-pink-700';
			case 'bilingual':
				return 'bg-indigo-100 text-indigo-700';
			default:
				return 'bg-gray-100 text-gray-700';
		}
	}

	function getDocIcon(type: 'pdf' | 'markdown' | 'text'): string {
		switch (type) {
			case 'pdf':
				return 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z';
			case 'markdown':
				return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
			default:
				return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
		}
	}

	async function deleteDocument(id: string) {
		await deleteDocFromDB(id);
		documents = documents.filter((doc) => doc.id !== id);
	}

	function setFilter(filter: FilterPhase) {
		activeFilter = filter;
	}

	function handleSearch(event: Event) {
		const input = event.target as HTMLInputElement;
		searchQuery = input.value;
	}

	async function downloadDocument(id: string) {
		const doc = await getDocument(id);
		if (!doc) return;

		let blob: Blob;
		if (doc.type === 'pdf') {
			blob = doc.content as Blob;
		} else {
			blob = new Blob([doc.content as string], { type: 'text/plain' });
		}

		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = doc.name;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	async function previewDocument(id: string, docType: 'pdf' | 'markdown' | 'text') {
		if (docType === 'pdf') {
			// For PDFs, open directly in new tab
			const doc = await getDocument(id);
			if (!doc) return;

			const blob = doc.content as Blob;
			const url = URL.createObjectURL(blob);
			window.open(url, '_blank');
		} else {
			// For markdown/text, show menu
			previewMenuDocId = id;
		}
	}

	async function previewRaw(id: string) {
		const doc = await getDocument(id);
		if (!doc) return;

		const content = doc.content as string;
		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		window.open(url, '_blank');
		previewMenuDocId = null;
	}

	async function previewRendered(id: string) {
		const doc = await getDocument(id);
		if (!doc) return;

		const content = doc.content as string;
		const html = await marked(content);
		const fullHtml = `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>${doc.name}</title>
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
		pre { background: #f4f4f4; padding: 1em; overflow-x: auto; }
		code { background: #f4f4f4; padding: 0.2em 0.4em; }
		blockquote { border-left: 4px solid #ddd; margin-left: 0; padding-left: 1em; color: #666; }
	</style>
</head>
<body>${html}</body>
</html>`;

		const blob = new Blob([fullHtml], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		window.open(url, '_blank');
		previewMenuDocId = null;
	}

	function closePreviewMenu() {
		previewMenuDocId = null;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-testid="preview-menu"]') && !target.closest('[data-testid="preview-document"]')) {
			closePreviewMenu();
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="max-w-4xl" onclick={handleClickOutside}>
	<h1 class="text-2xl font-bold text-gray-900 mb-6">My Documents</h1>

	<div class="bg-white rounded-lg border border-gray-200 p-6">
		<!-- Phase Filter Tabs -->
		<div data-testid="phase-filters" class="flex flex-wrap items-center gap-2 mb-4">
			<span class="text-sm font-medium text-gray-700">Filter:</span>
			{#each PHASE_FILTERS as filter}
				<button
					data-testid="filter-{filter.key}"
					onclick={() => setFilter(filter.key)}
					class="px-3 py-1 text-sm rounded-full transition-colors {activeFilter === filter.key
						? 'bg-blue-100 text-blue-700'
						: 'text-gray-600 hover:bg-gray-100'}"
				>
					{filter.label}
				</button>
			{/each}
		</div>

		<!-- Search Input -->
		<input
			data-testid="document-search"
			type="search"
			placeholder="Search documents..."
			value={searchQuery}
			oninput={handleSearch}
			class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
		/>

		<!-- Documents List -->
		{#if filteredDocuments.length > 0}
			<div class="space-y-3">
				{#each filteredDocuments as doc (doc.id)}
					<div
						data-testid="document-row"
						class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
					>
						<div class="flex items-center gap-4">
							<svg class="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getDocIcon(doc.type)} />
							</svg>
							<div>
								<p class="font-medium text-gray-900">{doc.name}</p>
								<div class="flex items-center gap-3 mt-1 text-sm text-gray-500">
									<span>{formatTypeLabel(doc.type)}</span>
									<span>|</span>
									<span>{formatFileSize(doc.size)}</span>
									<span>|</span>
									<span>{formatDate(doc.uploadedAt)}</span>
								</div>
							</div>
						</div>
						<div class="flex items-center gap-3">
							<!-- Phase Badge -->
							<span class="px-2 py-1 text-xs font-medium rounded-full {getPhaseColor(doc.phase)}">
								{formatPhaseLabel(doc.phase)}
							</span>
							<!-- Variant Badge (for translated documents) -->
							{#if doc.variant}
								<span class="px-2 py-1 text-xs font-medium rounded-full {getVariantColor(doc.variant)}">
									{formatVariantLabel(doc.variant)}
								</span>
							{/if}
							<!-- Actions -->
							<div class="relative">
								<button
									data-testid="preview-document"
									onclick={() => previewDocument(doc.id, doc.type)}
									class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
									title="Preview document"
								>
									<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
										/>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
										/>
									</svg>
								</button>
								{#if previewMenuDocId === doc.id && doc.type !== 'pdf'}
									<div
										data-testid="preview-menu"
										class="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px]"
									>
										<button
											onclick={() => previewRaw(doc.id)}
											class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
										>
											View Raw
										</button>
										<button
											onclick={() => previewRendered(doc.id)}
											class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
										>
											View Rendered
										</button>
									</div>
								{/if}
							</div>
							<button
								data-testid="download-document"
								onclick={() => downloadDocument(doc.id)}
								class="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
								title="Download document"
							>
								<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
									/>
								</svg>
							</button>
							<button
								data-testid="delete-document"
								onclick={() => deleteDocument(doc.id)}
								class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
								title="Delete document"
							>
								<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{:else if documents.length > 0 && filteredDocuments.length === 0}
			<!-- No matches for current filter/search -->
			<div class="text-center py-12 text-gray-500">
				<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
				<p class="mt-4">No documents match your search</p>
				<p class="text-sm">Try a different search term or filter</p>
			</div>
		{:else}
			<!-- Empty state - no documents -->
			<div class="text-center py-12 text-gray-500">
				<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
					/>
				</svg>
				<p class="mt-4">No documents yet</p>
				<p class="text-sm">Upload a file to get started</p>
			</div>
		{/if}
	</div>
</div>
