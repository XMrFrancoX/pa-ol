<script>
	import { toasts, removeToast } from '$lib/stores/toast.js';

	const icons = {
		success: '✓',
		error: '✕',
		warning: '⚠',
		info: 'ℹ'
	};
</script>

<div class="toast-container">
	{#each $toasts as toast (toast.id)}
		<div class="toast toast-{toast.type}" role="alert">
			<span class="toast-icon toast-icon-{toast.type}">{icons[toast.type]}</span>
			<span class="toast-message">{toast.message}</span>
			<button class="toast-close" on:click={() => removeToast(toast.id)}>✕</button>
		</div>
	{/each}
</div>

<style>
	.toast-icon {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 700;
		flex-shrink: 0;
	}
	.toast-icon-success { background: rgba(16,185,129,0.2); color: var(--secondary-light); }
	.toast-icon-error { background: rgba(239,68,68,0.2); color: #f87171; }
	.toast-icon-warning { background: rgba(245,158,11,0.2); color: var(--accent); }
	.toast-icon-info { background: rgba(59,130,246,0.2); color: #60a5fa; }
	.toast-message { flex: 1; font-size: 0.875rem; color: var(--text-primary); }
	.toast-close {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 2px 4px;
		font-size: 0.8rem;
		transition: color var(--transition);
		flex-shrink: 0;
	}
	.toast-close:hover { color: var(--text-primary); }
</style>
