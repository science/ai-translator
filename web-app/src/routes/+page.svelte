<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import {
		type StoredDocument,
		getAllDocuments,
		saveDocument,
		deleteDocument as deleteDocFromDB,
		migrateFromLocalStorage,
		generateDocumentId,
		requestPersistentStorage
	} from '$lib/storage';

	// Display-friendly version of StoredDocument (content not needed for list)
	interface DocumentListItem {
		id: string;
		name: string;
		type: 'pdf' | 'markdown' | 'text';
		size: number;
		uploadedAt: string;
	}

	let documents = $state<DocumentListItem[]>([]);
	let isDragging = $state(false);
	let fileInput: HTMLInputElement;
	let error = $state('');

	onMount(async () => {
		if (browser) {
			// Migrate any existing localStorage data to IndexedDB
			await migrateFromLocalStorage();
			// Request persistent storage (browser may auto-approve)
			await requestPersistentStorage();
			// Load documents from IndexedDB
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
				uploadedAt: doc.uploadedAt
			}));
		}
	}

	function getFileType(filename: string): 'pdf' | 'markdown' | 'text' {
		const ext = filename.split('.').pop()?.toLowerCase();
		if (ext === 'pdf') return 'pdf';
		if (ext === 'md' || ext === 'markdown') return 'markdown';
		return 'text';
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function isPdfFile(file: File): boolean {
		// Check both MIME type and extension for reliability
		if (file.type === 'application/pdf') return true;
		const ext = file.name.split('.').pop()?.toLowerCase();
		return ext === 'pdf';
	}

	async function handleFiles(files: FileList | null) {
		if (!files) return;

		error = ''; // Clear any previous error

		for (const file of Array.from(files)) {
			try {
				// Read file content - PDFs as Blob, text as string
				const content = await readFileContent(file);

				const doc: StoredDocument = {
					id: generateDocumentId(),
					name: file.name,
					type: getFileType(file.name),
					content: content,
					size: file.size,
					uploadedAt: new Date().toISOString(),
					phase: 'uploaded'
				};

				// Save to IndexedDB
				await saveDocument(doc);

				// Update local display list
				documents = [
					...documents,
					{
						id: doc.id,
						name: doc.name,
						type: doc.type,
						size: doc.size,
						uploadedAt: doc.uploadedAt
					}
				];
			} catch (err) {
				const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
				error = `Failed to save "${file.name}" (${fileSizeMB} MB). ${err instanceof Error ? err.message : 'Unknown error'}`;
				return; // Stop processing further files
			}
		}
	}

	async function readFileContent(file: File): Promise<Blob | string> {
		if (isPdfFile(file)) {
			// Store PDFs directly as Blobs (no base64 encoding!)
			return file;
		} else {
			// Read text files as strings
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = (e) => resolve(e.target?.result as string);
				reader.onerror = reject;
				reader.readAsText(file);
			});
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		handleFiles(event.dataTransfer?.files ?? null);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleInputChange(event: Event) {
		const input = event.target as HTMLInputElement;
		handleFiles(input.files);
		// Reset input so same file can be uploaded again
		input.value = '';
	}

	async function deleteDocument(id: string) {
		await deleteDocFromDB(id);
		documents = documents.filter((doc) => doc.id !== id);
	}

	function formatDate(isoString: string): string {
		return new Date(isoString).toLocaleDateString();
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
</script>

<div class="max-w-4xl">
	<h1 class="text-2xl font-bold text-gray-900 mb-6">Upload Document</h1>

	{#if error}
		<div data-testid="upload-error" class="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-700">{error}</p>
		</div>
	{/if}

	<div class="bg-white rounded-lg border border-gray-200 p-8">
		<!-- Dropzone -->
		<div
			data-testid="dropzone"
			class="border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer {isDragging
				? 'border-blue-500 bg-blue-50'
				: 'border-gray-300 hover:border-blue-400'}"
			role="button"
			tabindex="0"
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			onclick={() => fileInput?.click()}
			onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
		>
			<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
				/>
			</svg>
			<p class="mt-4 text-lg text-gray-600">Drop files here or click to browse</p>
			<p class="mt-2 text-sm text-gray-500">Accepts: .pdf, .md, .txt</p>
		</div>

		<!-- Hidden file input -->
		<input
			bind:this={fileInput}
			type="file"
			accept=".pdf,.md,.txt,.markdown"
			multiple
			class="hidden"
			onchange={handleInputChange}
		/>
	</div>

	<!-- Recent Uploads Section -->
	{#if documents.length > 0}
		<div data-testid="recent-uploads" class="mt-8 bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Recent Uploads</h2>

			<div class="space-y-3">
				{#each documents as doc (doc.id)}
					<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
						<div class="flex items-center gap-3">
							<svg class="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getDocIcon(doc.type)} />
							</svg>
							<div>
								<p class="font-medium text-gray-900">{doc.name}</p>
								<p class="text-sm text-gray-500">
									{formatFileSize(doc.size)} | Uploaded: {formatDate(doc.uploadedAt)}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<button
								class="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
							>
								View
							</button>
							<button
								data-testid="delete-file"
								onclick={() => deleteDocument(doc.id)}
								class="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
							>
								Delete
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
