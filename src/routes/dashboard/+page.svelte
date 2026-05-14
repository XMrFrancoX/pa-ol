<script>
	import { _ } from 'svelte-i18n';

	export let data;
	$: ({ stats, recentDeliveries } = data);

	const fmt = (n) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0 }).format(n ?? 0);
	const fmtMoney = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n ?? 0);

	const statusColors = {
		pending: 'badge-warning',
		delivered: 'badge-success',
		returned: 'badge-info'
	};
	const statusLabels = {
		pending: 'Pendiente',
		delivered: 'Entregado',
		returned: 'Devuelto'
	};
	$: isProfesor = data.profile?.role === 'profesor';
</script>

<svelte:head><title>Panel — Inventario Pañol</title></svelte:head>

<div class="page-header">
	<div class="page-header-left">
		<h1 class="page-title">{$_('dashboard.title')}</h1>
		<p class="page-subtitle">Resumen general del sistema</p>
	</div>
</div>

<!-- Stats -->
<div class="stats-grid">
	<div class="stat-card" style="--accent-color: var(--primary)">
		<div class="stat-icon"><i class="ph ph-package"></i></div>
		<div class="stat-label">{$_('dashboard.totalMaterials')}</div>
		<div class="stat-value">{fmt(stats.materialCount)}</div>
		<div class="stat-sub">SKUs registrados</div>
	</div>
	<div class="stat-card" style="--accent-color: var(--secondary)">
		<div class="stat-icon"><i class="ph ph-factory"></i></div>
		<div class="stat-label">{$_('dashboard.totalStock')}</div>
		<div class="stat-value">{fmt(stats.totalStockQty)}</div>
		<div class="stat-sub">unidades en total</div>
	</div>
	{#if !isProfesor}
	<div class="stat-card" style="--accent-color: var(--accent)">
		<div class="stat-icon"><i class="ph ph-currency-circle-dollar"></i></div>
		<div class="stat-label">{$_('dashboard.inventoryValue')}</div>
		<div class="stat-value number-mono" style="font-size:1.4rem">{fmtMoney(stats.totalValuation)}</div>
		<div class="stat-sub">valorización PPP</div>
	</div>
	{/if}
	<div class="stat-card" style="--accent-color: var(--warning)">
		<div class="stat-icon"><i class="ph ph-shopping-cart"></i></div>
		<div class="stat-label">{$_('dashboard.pendingOrders')}</div>
		<div class="stat-value">{fmt(stats.pendingOrders)}</div>
		<div class="stat-sub">OC sin recibir</div>
	</div>
	<div class="stat-card" style="--accent-color: var(--info)">
		<div class="stat-icon"><i class="ph ph-gear"></i></div>
		<div class="stat-label">{$_('dashboard.activeProjects')}</div>
		<div class="stat-value">{fmt(stats.activeProjects)}</div>
		<div class="stat-sub">proyectos activos</div>
	</div>
</div>

<!-- Quick Actions -->
<div class="grid-2 mb-8">
	<div class="card">
		<div class="card-header">
			<span class="card-title"><i class="ph ph-lightning"></i> Acciones Rápidas</span>
		</div>
		<div class="quick-actions">
			<a href="/inventario" class="quick-action">
				<span class="qa-icon"><i class="ph ph-package"></i></span>
				<div>
					<div class="qa-title">Ver Inventario</div>
					<div class="qa-sub">Maestro de materiales</div>
				</div>
			</a>
			<a href="/compras/ordenes" class="quick-action">
				<span class="qa-icon"><i class="ph ph-shopping-cart"></i></span>
				<div>
					<div class="qa-title">Nueva OC</div>
					<div class="qa-sub">Orden de compra</div>
				</div>
			</a>
			<a href="/proyectos" class="quick-action">
				<span class="qa-icon"><i class="ph ph-gear"></i></span>
				<div>
					<div class="qa-title">Proyectos</div>
					<div class="qa-sub">BOM y factibilidad</div>
				</div>
			</a>
			<a href="/delivery" class="quick-action">
				<span class="qa-icon"><i class="ph ph-truck"></i></span>
				<div>
					<div class="qa-title">Nueva Entrega</div>
					<div class="qa-sub">Asignar materiales</div>
				</div>
			</a>
		</div>
	</div>

	<!-- Recent Deliveries -->
	<div class="card">
		<div class="card-header">
			<span class="card-title"><i class="ph ph-truck"></i> {$_('dashboard.recentDeliveries')}</span>
			<a href="/delivery" class="btn btn-ghost btn-sm">{$_('common.view')} todos</a>
		</div>
		{#if recentDeliveries.length === 0}
			<div class="empty-state" style="padding: 2rem">
				<div class="empty-icon"><i class="ph ph-envelope-simple"></i></div>
				<div class="empty-title">Sin entregas recientes</div>
			</div>
		{:else}
			<div class="recent-list">
				{#each recentDeliveries as d}
					<a href="/delivery/{d.id}" class="recent-item">
						<div class="recent-info">
							<div class="recent-title">{d.projects?.name ?? 'Sin proyecto'}</div>
							<div class="recent-sub">{d.user_profiles?.full_name ?? '—'}</div>
						</div>
						<span class="badge {statusColors[d.status] ?? 'badge-neutral'}">
							{statusLabels[d.status] ?? d.status}
						</span>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.quick-actions {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.quick-action {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px;
		border-radius: var(--radius);
		text-decoration: none;
		transition: background var(--transition);
	}
	.quick-action:hover { background: var(--bg-card-hover); }
	.qa-icon { font-size: 1.5rem; width: 40px; text-align: center; flex-shrink: 0; }
	.qa-title { font-size: 0.9rem; font-weight: 600; color: var(--text-primary); }
	.qa-sub { font-size: 0.78rem; color: var(--text-muted); }

	.recent-list { display: flex; flex-direction: column; gap: 2px; }
	.recent-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 8px;
		border-radius: var(--radius);
		text-decoration: none;
		transition: background var(--transition);
	}
	.recent-item:hover { background: var(--bg-card-hover); }
	.recent-title { font-size: 0.875rem; font-weight: 500; color: var(--text-primary); }
	.recent-sub { font-size: 0.78rem; color: var(--text-muted); }
</style>
