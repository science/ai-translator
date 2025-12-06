import { defineConfig, devices } from '@playwright/test';

// Use preview server for production build tests
const usePreview = process.env.TEST_PRODUCTION === 'true';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		// Use base path when testing production build (matches svelte.config.js)
		baseURL: usePreview ? 'http://localhost:4173/ai-translator' : 'http://localhost:5173',
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		// Use preview for production testing, dev for normal testing
		command: usePreview ? 'npm run preview -- --port 4173' : 'npm run dev',
		url: usePreview ? 'http://localhost:4173/ai-translator' : 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 120000
	}
});
