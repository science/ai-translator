import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		alias: {
			// Force Svelte to use browser version in tests
			'svelte': 'svelte'
		}
	},
	resolve: {
		conditions: ['browser']
	}
});
