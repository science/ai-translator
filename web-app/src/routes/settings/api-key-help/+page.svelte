<script lang="ts">
	import { base } from '$app/paths';
</script>

<div class="max-w-3xl">
	<div class="mb-6">
		<a
			href="{base}/settings"
			class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Settings
		</a>
	</div>

	<h1 class="text-2xl font-bold text-gray-900 mb-6">How to Get Your OpenAI API Key</h1>

	<div class="space-y-8">
		<!-- What is an API Key -->
		<section class="bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-3">What is an API Key?</h2>
			<p class="text-gray-600 mb-3">
				An API key is like a password that lets this app communicate with OpenAI's translation
				services. Think of it as your personal access code that allows the app to use AI-powered
				translation on your behalf.
			</p>
			<p class="text-gray-600">
				Without an API key, the app cannot connect to OpenAI's servers to perform translations.
				Each API key is unique to your account and tracks your usage.
			</p>
		</section>

		<!-- Step by Step Instructions -->
		<section class="bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Step-by-Step Instructions</h2>

			<div class="space-y-6">
				<div class="flex gap-4">
					<div class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
						1
					</div>
					<div>
						<h3 class="font-medium text-gray-900 mb-1">Create an OpenAI Account</h3>
						<p class="text-gray-600 mb-2">
							Go to OpenAI's platform and sign up for a free account. You can use your email,
							Google, Microsoft, or Apple account.
						</p>
						<a
							href="https://platform.openai.com/signup"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
						>
							Visit platform.openai.com
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
							</svg>
						</a>
					</div>
				</div>

				<div class="flex gap-4">
					<div class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
						2
					</div>
					<div>
						<h3 class="font-medium text-gray-900 mb-1">Verify Your Account</h3>
						<p class="text-gray-600">
							OpenAI will ask you to verify your email address and phone number. This helps
							secure your account and prevents misuse.
						</p>
					</div>
				</div>

				<div class="flex gap-4">
					<div class="flex-shrink-0 w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold">
						3
					</div>
					<div>
						<h3 class="font-medium text-gray-900 mb-1">Add a Payment Method & Purchase Credits</h3>
						<p class="text-gray-600 mb-2">
							<strong>Do this now:</strong> OpenAI uses prepaid billing, which means your API key
							won't work until you've added a payment method and purchased credits. Without credits,
							you'll get "insufficient quota" errors when trying to use the translation features.
						</p>
						<p class="text-gray-600 mb-3">
							Go to your billing settings, click "Add payment method", and enter your credit or debit
							card details. Then click "Add to credit balance" to purchase your initial credits
							($5-10 is plenty to get started and test the app).
						</p>
						<a
							href="https://platform.openai.com/settings/organization/billing/payment-methods"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
						>
							Go to Billing & Payment Methods
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
							</svg>
						</a>
					</div>
				</div>

				<div class="flex gap-4">
					<div class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
						4
					</div>
					<div>
						<h3 class="font-medium text-gray-900 mb-1">Navigate to API Keys</h3>
						<p class="text-gray-600 mb-2">
							Once logged in, click on "API keys" in the left sidebar, or go directly to the API keys page.
						</p>
						<a
							href="https://platform.openai.com/api-keys"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
						>
							Go to API Keys page
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
							</svg>
						</a>
					</div>
				</div>

				<div class="flex gap-4">
					<div class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
						5
					</div>
					<div>
						<h3 class="font-medium text-gray-900 mb-1">Create a New API Key</h3>
						<p class="text-gray-600">
							Click the "+ Create new secret key" button. Give your key a name (like "Book Translate")
							so you can identify it later. Click "Create secret key".
						</p>
					</div>
				</div>

				<div class="flex gap-4">
					<div class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
						6
					</div>
					<div>
						<h3 class="font-medium text-gray-900 mb-1">Copy Your Key Immediately</h3>
						<p class="text-gray-600">
							<strong>Important:</strong> Copy your API key right away! OpenAI will only show it once.
							If you lose it, you'll need to create a new one. Your key will look something like:
							<code class="bg-gray-100 px-2 py-1 rounded text-sm">sk-...</code>
						</p>
					</div>
				</div>

				<div class="flex gap-4">
					<div class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
						7
					</div>
					<div>
						<h3 class="font-medium text-gray-900 mb-1">Paste in Settings</h3>
						<p class="text-gray-600">
							Come back to this app, go to Settings, and paste your API key in the API Key field.
							Click "Save" to store it securely in your browser.
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Billing Information -->
		<section class="bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-3">About Costs and Billing</h2>
			<p class="text-gray-600 mb-3">
				OpenAI uses <strong>prepaid billing</strong> for API access. This means you must purchase
				credits before you can use the API. Your API requests will fail with "insufficient quota"
				errors if you haven't added credits to your account.
			</p>
			<p class="text-gray-600 mb-3">
				The cost depends on how much text you translate. Translating a typical book chapter might
				cost a few cents; an entire book might cost a few dollars. Starting with $5-10 in credits
				is plenty to experiment and translate several documents.
			</p>
			<p class="text-gray-600 mb-3">
				You can enable <strong>auto-recharge</strong> in your billing settings to automatically
				add credits when your balance runs low, or manually add credits as needed.
			</p>
			<p class="text-gray-600">
				<strong>Tip:</strong> Set a monthly budget limit in your OpenAI account settings to prevent
				unexpected charges. Purchased credits expire after 1 year.
			</p>
		</section>

		<!-- Rate Limits Warning -->
		<section class="bg-amber-50 border border-amber-200 rounded-lg p-6">
			<div class="flex gap-3">
				<svg class="w-6 h-6 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				<div>
					<h2 class="text-lg font-semibold text-amber-800 mb-2">About Rate Limits</h2>
					<p class="text-amber-700 mb-3">
						New OpenAI accounts have <strong>rate limits</strong> that restrict how many requests
						you can make per minute. This is normal and not a problem with your account.
					</p>
					<p class="text-amber-700 mb-3">
						<strong>What this means:</strong> If you're translating a large document, the app might
						need to pause briefly between sections. You might see "rate limit exceeded" messages -
						the app will automatically retry after a short wait.
					</p>
					<p class="text-amber-700">
						<strong>Good news:</strong> Your rate limits automatically increase as you use the API
						more and your account builds a track record. After a few successful payments, you'll
						have much higher limits.
					</p>
				</div>
			</div>
		</section>

		<!-- Security Warning -->
		<section class="bg-red-50 border border-red-200 rounded-lg p-6">
			<div class="flex gap-3">
				<svg class="w-6 h-6 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
				</svg>
				<div>
					<h2 class="text-lg font-semibold text-red-800 mb-2">Keep Your API Key Safe</h2>
					<p class="text-red-700 mb-3">
						Your API key is like a password. <strong>Never share it</strong> with anyone, and don't
						post it in public places like forums, emails, or social media.
					</p>
					<p class="text-red-700 mb-3">
						If someone else gets your key, they can use it to make requests that will be billed to
						your account. If you think your key has been compromised, delete it immediately in your
						OpenAI dashboard and create a new one.
					</p>
					<p class="text-red-700">
						This app stores your API key only in your browser's local storage. It is never sent to
						any server other than OpenAI's official API.
					</p>
				</div>
			</div>
		</section>

		<!-- Troubleshooting -->
		<section class="bg-white rounded-lg border border-gray-200 p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-3">Troubleshooting</h2>
			<div class="space-y-4">
				<div>
					<h3 class="font-medium text-gray-900">My key isn't working / "insufficient quota" error</h3>
					<p class="text-gray-600 text-sm">
						Make sure you copied the entire key including the "sk-" prefix. Most commonly, this error
						means you haven't added a payment method and purchased credits yet. Go to your
						<a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-700">OpenAI billing page</a>
						to add credits.
					</p>
				</div>
				<div>
					<h3 class="font-medium text-gray-900">I see "rate limit" errors</h3>
					<p class="text-gray-600 text-sm">
						This is normal for new accounts. The app will automatically retry. If it persists,
						wait a few minutes and try again, or consider processing smaller documents.
					</p>
				</div>
				<div>
					<h3 class="font-medium text-gray-900">I lost my API key</h3>
					<p class="text-gray-600 text-sm">
						You cannot retrieve a lost key. Go to the OpenAI API Keys page, delete the old key,
						and create a new one.
					</p>
				</div>
			</div>
		</section>

		<!-- Back to Settings -->
		<div class="text-center">
			<a
				href="{base}/settings"
				class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
			>
				Return to Settings
			</a>
		</div>
	</div>
</div>
