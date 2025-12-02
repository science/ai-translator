<script lang="ts">
	// My Documents page
</script>

<div class="max-w-4xl">
	<h1 class="text-2xl font-bold text-gray-900 mb-6">My Documents</h1>

	<div class="bg-white rounded-lg border border-gray-200 p-6">
		<div class="flex flex-wrap items-center gap-2 mb-4">
			<span class="text-sm font-medium text-gray-700">Filter:</span>
			<button class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full">All</button>
			<button class="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-full">PDF</button>
			<button class="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-full">Markdown</button>
			<button class="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-full">Translated</button>
			<button class="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-full">Cleaned</button>
		</div>

		<input
			type="search"
			placeholder="Search documents..."
			class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
		/>

		<div class="text-center py-12 text-gray-500">
			<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
			</svg>
			<p class="mt-4">No documents yet</p>
			<p class="text-sm">Upload a file to get started</p>
		</div>
	</div>
</div>
