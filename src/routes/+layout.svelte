<script>
	import '../app.css';
	import { setupI18n } from '$lib/i18n/index.js';
	import { isLoading } from 'svelte-i18n';
	import { page } from '$app/stores';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import LanguageToggle from '$lib/components/LanguageToggle.svelte';

	export let data;

	setupI18n();

	$: isPublicRoute = $page.url.pathname === '/login';
	$: profile = data?.profile ?? null;
</script>

{#if $isLoading}
	<div class="app-init">
		<div class="spinner"></div>
	</div>
{:else if isPublicRoute}
	<slot />
{:else}
	<div class="app-layout">
		<Sidebar {profile} />
		<div class="main-content">
			<!-- Top Bar -->
			<header class="topbar">
				<div class="topbar-left">
					<div class="breadcrumb-area">
						<!-- slot for page-specific breadcrumb -->
					</div>
				</div>
				<div class="topbar-right">
					<LanguageToggle />
				</div>
			</header>

			<!-- Page Content -->
			<main class="page-container">
				<slot />
			</main>
		</div>
	</div>
{/if}

<Toast />

<style>
	.app-init {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
		background: var(--bg-base);
	}

	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-8);
		height: 56px;
		background: var(--bg-surface);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		position: sticky;
		top: 0;
		z-index: 40;
	}
	.topbar-right {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
</style>
