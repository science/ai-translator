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
		resetProgress,
		parseProgressEvent
	} from '$lib/progress';
	import ProgressIndicator from '$lib/components/ProgressIndicator.svelte';

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
	let isCleaning = $state(false);
	let cleanedMarkdown = $state('');
	let error = $state('');
	let progress = $state<ProgressState>(resetProgress());

	onMount(async () => {
		if (browser) {
			await loadDocuments();
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

	// Get the selected document info (not full document with content)
	let selectedDocInfo = $derived(documents.find((doc) => doc.id === selectedDocId));

	async function handleCleanup() {
		if (!selectedDocInfo) return;

		isCleaning = true;
		error = '';
		cleanedMarkdown = '';
		progress = createDeterminateProgress('Starting cleanup...');

		try {
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

			const response = await fetch('/api/cleanup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					content,
					filename: selectedDoc.name,
					model,
					chunkSize,
					stream: true
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Cleanup failed');
			}

			// Process SSE stream
			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('No response body');
			}

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6);
						const event = parseProgressEvent(data);

						if (event) {
							if (event.type === 'progress' && event.percentage !== undefined && event.message) {
								progress = updateProgress(progress as ReturnType<typeof createDeterminateProgress>, {
									percentage: event.percentage,
									message: event.message
								});
							} else if (event.type === 'complete' && event.markdown) {
								cleanedMarkdown = event.markdown;
								progress = completeProgress(progress as ReturnType<typeof createDeterminateProgress>, 'Cleanup complete!');
							} else if (event.type === 'error' && event.error) {
								throw new Error(event.error);
							}
						}
					}
				}
			}

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
					<option value="gpt-5-mini">gpt-5-mini</option>
					<option value="gpt-4o">gpt-4o</option>
					<option value="gpt-5">gpt-5</option>
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
			<div class="prose prose-sm max-w-none bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
				<pre class="whitespace-pre-wrap text-sm text-gray-800">{cleanedMarkdown}</pre>
			</div>
		</div>
	{/if}
</div>
