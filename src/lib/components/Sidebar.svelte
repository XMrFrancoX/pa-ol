<script>
	import { page } from '$app/stores';
	import { _ } from 'svelte-i18n';
	import { supabase } from '$lib/supabase.js';
	import { goto } from '$app/navigation';
	import { userProfile } from '$lib/stores/auth.js';
	import { toast } from '$lib/stores/toast.js';

	export let profile = null;

	const navItems = [
		{ href: '/dashboard', icon: 'ph-squares-four', labelKey: 'nav.dashboard' },
		{ href: '/inventario', icon: 'ph-package', labelKey: 'nav.inventory' },
		{
			label: 'nav.purchases',
			icon: 'ph-shopping-cart',
			children: [
				{ href: '/compras/ordenes', labelKey: 'nav.orders', icon: 'ph-receipt' },
				{ href: '/compras/proveedores', labelKey: 'nav.suppliers', icon: 'ph-buildings' },
			]
		},
		{ href: '/proyectos', icon: 'ph-gear', labelKey: 'nav.projects' },
		{ href: '/delivery', icon: 'ph-truck', labelKey: 'nav.delivery' },
		{ href: '/usuarios', icon: 'ph-users', labelKey: 'nav.users', roles: ['admin'] },
	];

	let expandedGroups = { 'nav.purchases': true };

	function toggleGroup(key) {
		expandedGroups[key] = !expandedGroups[key];
		expandedGroups = { ...expandedGroups };
	}

	function isActive(href) {
		return $page.url.pathname.startsWith(href);
	}

	function isGroupActive(children) {
		return children.some(c => $page.url.pathname.startsWith(c.href));
	}

	async function handleLogout() {
		await supabase.auth.signOut();
		toast.success($_('auth.logoutSuccess'));
		goto('/login');
	}

	$: roleLabel = profile?.role === 'admin' ? $_('users.roles.admin')
		: profile?.role === 'encargado' ? $_('users.roles.encargado')
		: $_('users.roles.alumno');
</script>

<aside class="sidebar">
	<!-- Logo -->
	<div class="sidebar-logo">
		<div class="logo-icon"><i class="ph ph-package"></i></div>
		<div class="logo-text">
			<span class="logo-title">Pañol</span>
			<span class="logo-sub">Sistema de Inventario</span>
		</div>
	</div>

	<!-- Nav -->
	<nav class="sidebar-nav">
		{#each navItems as item}
			{#if item.roles && !item.roles.includes(profile?.role)}
				<!-- hidden for this role -->
			{:else if item.children}
				<!-- Group -->
				<div class="nav-group">
					<button
						class="nav-group-toggle"
						class:active={isGroupActive(item.children)}
						on:click={() => toggleGroup(item.label)}
					>
						<span class="nav-icon"><i class="ph {item.icon}"></i></span>
						<span class="nav-label">{$_(item.label)}</span>
						<span class="nav-arrow" class:rotated={expandedGroups[item.label]}><i class="ph ph-caret-right"></i></span>
					</button>
					{#if expandedGroups[item.label]}
						<div class="nav-children">
							{#each item.children as child}
								<a
									href={child.href}
									class="nav-link nav-child"
									class:active={isActive(child.href)}
								>
									<span class="nav-icon"><i class="ph {child.icon}"></i></span>
									<span class="nav-label">{$_(child.labelKey)}</span>
								</a>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<a
					href={item.href}
					class="nav-link"
					class:active={isActive(item.href)}
				>
					<span class="nav-icon"><i class="ph {item.icon}"></i></span>
					<span class="nav-label">{$_(item.labelKey)}</span>
				</a>
			{/if}
		{/each}
	</nav>

	<!-- User block -->
	<div class="sidebar-footer">
		<a href="/perfil" class="user-block" class:active={isActive('/perfil')}>
			<div class="user-avatar">
				{(profile?.full_name || 'U').charAt(0).toUpperCase()}
			</div>
			<div class="user-info">
				<span class="user-name">{profile?.full_name || 'Usuario'}</span>
				<span class="user-role">{roleLabel}</span>
			</div>
		</a>
		<button class="logout-btn" on:click={handleLogout} title={$_('nav.logout')}><i class="ph ph-sign-out"></i></button>
	</div>
</aside>

<style>
	.sidebar {
		position: fixed;
		top: 0;
		left: 0;
		height: 100vh;
		width: var(--sidebar-width);
		background: var(--sidebar-bg);
		border-right: 1px solid var(--sidebar-border);
		display: flex;
		flex-direction: column;
		z-index: 50;
		overflow: hidden;
	}

	/* Logo */
	.sidebar-logo {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 20px 16px;
		border-bottom: 1px solid var(--sidebar-border);
		flex-shrink: 0;
	}
	.logo-icon {
		width: 38px;
		height: 38px;
		background: linear-gradient(135deg, var(--primary), var(--primary-dark));
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		flex-shrink: 0;
		box-shadow: 0 4px 12px var(--primary-glow);
	}
	.logo-title {
		display: block;
		font-size: 1rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}
	.logo-sub {
		display: block;
		font-size: 0.68rem;
		color: var(--text-muted);
		font-weight: 400;
	}

	/* Nav */
	.sidebar-nav {
		flex: 1;
		overflow-y: auto;
		padding: 12px 10px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 10px;
		border-radius: var(--radius);
		color: var(--text-muted);
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
		transition: all var(--transition);
		position: relative;
	}
	.nav-link:hover {
		background: rgba(99, 102, 241, 0.06);
		color: var(--text-secondary);
	}
	.nav-link.active {
		background: rgba(99, 102, 241, 0.12);
		color: var(--primary-light);
	}
	.nav-link.active::before {
		content: '';
		position: absolute;
		left: 0;
		top: 20%;
		bottom: 20%;
		width: 3px;
		background: var(--primary);
		border-radius: 0 2px 2px 0;
	}
	.nav-child {
		padding-left: 28px;
	}

	.nav-icon { font-size: 1rem; width: 20px; text-align: center; flex-shrink: 0; }
	.nav-label { flex: 1; }

	/* Group toggle */
	.nav-group {}
	.nav-group-toggle {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 9px 10px;
		border: none;
		background: transparent;
		border-radius: var(--radius);
		color: var(--text-muted);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition);
		font-family: inherit;
		text-align: left;
	}
	.nav-group-toggle:hover {
		background: rgba(99, 102, 241, 0.06);
		color: var(--text-secondary);
	}
	.nav-group-toggle.active { color: var(--primary-light); }
	.nav-arrow {
		font-size: 1.1rem;
		transition: transform var(--transition);
		color: var(--text-muted);
		line-height: 1;
	}
	.nav-arrow.rotated { transform: rotate(90deg); }
	.nav-children {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 2px;
	}

	/* Footer */
	.sidebar-footer {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 10px;
		border-top: 1px solid var(--sidebar-border);
		flex-shrink: 0;
	}
	.user-block {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		padding: 8px;
		border-radius: var(--radius);
		text-decoration: none;
		transition: background var(--transition);
		min-width: 0;
	}
	.user-block:hover { background: rgba(99, 102, 241, 0.06); }
	.user-avatar {
		width: 32px;
		height: 32px;
		background: linear-gradient(135deg, var(--primary), var(--primary-light));
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		font-weight: 700;
		color: white;
		flex-shrink: 0;
	}
	.user-name {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.user-role {
		display: block;
		font-size: 0.7rem;
		color: var(--text-muted);
		text-transform: capitalize;
	}
	.logout-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		cursor: pointer;
		transition: all var(--transition);
		font-size: 1rem;
		flex-shrink: 0;
	}
	.logout-btn:hover {
		background: rgba(239, 68, 68, 0.1);
		border-color: rgba(239, 68, 68, 0.3);
		color: var(--danger);
	}

	@media (max-width: 768px) {
		.sidebar { transform: translateX(-100%); }
	}
</style>
