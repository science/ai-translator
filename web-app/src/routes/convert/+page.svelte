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
		createIndeterminateProgress,
		addActivity,
		completeProgress,
		resetProgress
	} from '$lib/progress';
	import ProgressIndicator from '$lib/components/ProgressIndicator.svelte';

	// Browser service for PDF conversion
	import { createPdfConverter } from '$lib/services/pdfConverter';

	// Display-friendly version for the list
	interface DocumentListItem {
		id: string;
		name: string;
		type: 'pdf' | 'markdown' | 'text';
		size: number;
		uploadedAt: string;
	}

	let documents = $state<DocumentListItem[]>([]);
	let selectedPdfId = $state('');
	let isConverting = $state(false);
	let convertedMarkdown = $state('');
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

	// Filter to only show PDF documents
	let pdfDocuments = $derived(documents.filter((doc) => doc.type === 'pdf'));

	// Get the selected PDF info (not full document with content)
	let selectedPdfInfo = $derived(documents.find((doc) => doc.id === selectedPdfId));

	async function handleConvert() {
		if (!selectedPdfInfo) return;

		isConverting = true;
		error = '';
		convertedMarkdown = '';
		progress = createIndeterminateProgress('Starting conversion...');

		try {
			// Fetch the full document with content from IndexedDB
			const selectedPdf = await getDocument(selectedPdfId);
			if (!selectedPdf) {
				throw new Error('Document not found');
			}

			progress = addActivity(
				progress as ReturnType<typeof createIndeterminateProgress>,
				'Loading PDF...'
			);

			// Get PDF buffer from stored content
			let pdfBuffer: Uint8Array;
			if (selectedPdf.content instanceof Blob) {
				const arrayBuffer = await selectedPdf.content.arrayBuffer();
				pdfBuffer = new Uint8Array(arrayBuffer);
			} else {
				// Fallback for base64 content (legacy migration)
				const binaryString = atob(selectedPdf.content);
				pdfBuffer = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					pdfBuffer[i] = binaryString.charCodeAt(i);
				}
			}

			progress = addActivity(
				progress as ReturnType<typeof createIndeterminateProgress>,
				'Creating PDF converter...'
			);

			// Create PDF converter
			const converter = await createPdfConverter();

			progress = addActivity(
				progress as ReturnType<typeof createIndeterminateProgress>,
				'Converting PDF to markdown...'
			);

			// Convert PDF to markdown
			convertedMarkdown = await converter.convertToMarkdown(pdfBuffer);

			progress = completeProgress(
				progress as ReturnType<typeof createIndeterminateProgress>,
				'Conversion complete!'
			);

			// Store the converted document in IndexedDB
			const baseName = selectedPdf.name.replace(/\.pdf$/i, '');
			const newDoc: StoredDocument = {
				id: generateDocumentId(),
				name: `${baseName}.md`,
				type: 'markdown',
				content: convertedMarkdown,
				size: new Blob([convertedMarkdown]).size,
				uploadedAt: new Date().toISOString(),
				phase: 'converted',
				sourceDocumentId: selectedPdf.id
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
			isConverting = false;
		}
	}
</script>

<div class="max-w-4xl">
	<h1 class="text-2xl font-bold text-gray-900 mb-6">Convert PDF to Markdown</h1>

	<div class="bg-white rounded-lg border border-gray-200 p-6">
		<label class="block text-sm font-medium text-gray-700 mb-2">
			Select PDF to convert:
		</label>
		<select
			bind:value={selectedPdfId}
			disabled={isConverting}
			class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
		>
			{#if pdfDocuments.length === 0}
				<option value="">No PDFs available</option>
			{:else}
				<option value="">Select a PDF...</option>
				{#each pdfDocuments as pdf (pdf.id)}
					<option value={pdf.id}>{pdf.name}</option>
				{/each}
			{/if}
		</select>

		<button
			onclick={handleConvert}
			class="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			disabled={!selectedPdfId || isConverting}
		>
			{#if isConverting}
				Converting...
			{:else}
				Convert to Markdown
			{/if}
		</button>

		<ProgressIndicator {progress} />
	</div>

	{#if error}
		<div class="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-700">{error}</p>
		</div>
	{/if}

	{#if convertedMarkdown}
		<div class="mt-6 bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Converted Markdown</h2>
			<div class="prose prose-sm max-w-none bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
				<pre class="whitespace-pre-wrap text-sm text-gray-800">{convertedMarkdown}</pre>
			</div>
		</div>
	{/if}
</div>
