<script lang="ts">
	// Cleanup (Rectification) page
</script>

<div class="max-w-4xl">
	<h1 class="text-2xl font-bold text-gray-900 mb-6">Cleanup Document</h1>

	<div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
		<div>
			<label class="block text-sm font-medium text-gray-700 mb-2">
				Select document to clean up:
			</label>
			<select class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
				<option value="">No documents available</option>
			</select>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-2">Model:</label>
				<select class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
					<option value="gpt-5-mini">gpt-5-mini</option>
					<option value="gpt-4o">gpt-4o</option>
					<option value="gpt-5">gpt-5</option>
				</select>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-2">Chunk Size:</label>
				<input
					type="number"
					value="4000"
					class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
		</div>

		<button
			class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			disabled
		>
			Start Cleanup
		</button>
	</div>
</div>
