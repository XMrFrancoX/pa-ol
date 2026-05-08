<script>
	import { locale } from 'svelte-i18n';

	function toggle() {
		const next = $locale === 'es' ? 'en' : 'es';
		locale.set(next);
		localStorage.setItem('locale', next);
	}
</script>

<button class="lang-toggle" on:click={toggle} title="Switch language">
	<span class="lang-icon">🌐</span>
	<span class="lang-label">{$locale === 'es' ? 'EN' : 'ES'}</span>
</button>

<style>
	.lang-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		color: var(--text-secondary);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition);
		font-family: inherit;
	}
	.lang-toggle:hover {
		background: var(--bg-card-hover);
		color: var(--text-primary);
		border-color: var(--border-light);
	}
	.lang-icon { font-size: 0.9rem; }
</style>
