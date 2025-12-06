import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	optimizeDeps: {
		// Pre-bundle these dependencies to avoid dynamic import issues in production
		include: ['@opendocsg/pdf2md', 'unpdf', 'unpdf/pdfjs']
	},
	build: {
		// Ensure dynamic imports are properly handled
		modulePreload: {
			polyfill: true
		},
		rollupOptions: {
			output: {
				// Use content-based hashing for better cache consistency
				chunkFileNames: 'chunks/[name]-[hash].js'
			}
		}
	},
	ssr: {
		// Ensure these packages are bundled, not externalized
		noExternal: ['@opendocsg/pdf2md', 'unpdf']
	}
});
