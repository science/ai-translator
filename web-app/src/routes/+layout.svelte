<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { base } from '$app/paths';

	let { children } = $props();

	// Primary workflow item (shown at top with separator)
	const workflowItem = {
		href: '/workflow',
		label: 'One Step Translation',
		icon: 'M13 10V3L4 14h7v7l9-11h-7z', // Lightning bolt icon for "one-shot" action
		isPrimary: true
	};

	// Regular navigation items
	const navItems = [
		{ href: '/', label: 'Upload', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
		{ href: '/convert', label: 'Convert PDF', icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
		{ href: '/cleanup', label: 'Cleanup', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
		{ href: '/translate', label: 'Translate', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' },
		{ href: '/documents', label: 'My Documents', icon: 'M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z' },
		{ href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
	];

	// Get the pathname without the base prefix for comparison
	function getRelativePath(pathname: string): string {
		if (base && pathname.startsWith(base)) {
			return pathname.slice(base.length) || '/';
		}
		return pathname;
	}

	function isActive(href: string): boolean {
		const relativePath = getRelativePath(page.url.pathname);
		if (href === '/') {
			return relativePath === '/';
		}
		return relativePath.startsWith(href);
	}

	// Construct full href with base path
	function fullHref(href: string): string {
		return href === '/' ? base || '/' : base + href;
	}
</script>

<svelte:head>
	<title>Book Translate</title>
	<meta name="description" content="Translate markdown books to Japanese using OpenAI" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
		<div class="flex items-center h-16 px-4">
			<div class="flex items-center gap-2">
				<svg class="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
				</svg>
				<span class="text-xl font-semibold text-gray-900">Book Translate</span>
			</div>
		</div>
	</header>

	<!-- Main container -->
	<div class="flex pt-16">
		<!-- Sidebar -->
		<nav aria-label="Main navigation" class="fixed left-0 top-16 bottom-0 w-56 bg-white border-r border-gray-200 overflow-y-auto">
			<div class="p-4">
				<!-- Primary workflow item -->
				<a
					href={fullHref(workflowItem.href)}
					class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors mb-2 {isActive(workflowItem.href)
						? 'bg-blue-600 text-white'
						: 'bg-blue-50 text-blue-700 hover:bg-blue-100'}"
					aria-current={isActive(workflowItem.href) ? 'page' : undefined}
				>
					<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={workflowItem.icon} />
					</svg>
					<span class="font-medium">{workflowItem.label}</span>
				</a>

				<!-- Separator -->
				<div class="border-b border-gray-200 my-3"></div>

				<!-- Regular navigation items -->
				<ul class="space-y-1">
					{#each navItems as item}
						<li>
							<a
								href={fullHref(item.href)}
								class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors {isActive(item.href) ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}"
								aria-current={isActive(item.href) ? 'page' : undefined}
							>
								<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
								</svg>
								<span>{item.label}</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</nav>

		<!-- Main content -->
		<main class="flex-1 ml-56 p-8">
			{@render children()}
		</main>
	</div>
</div>
