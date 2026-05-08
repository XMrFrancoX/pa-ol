<script>
	import { _ } from 'svelte-i18n';

	export let data;
	$: ({ project, feasibility, maxUnits } = data);

	const fmt = (n) => new Intl.NumberFormat('es-AR').format(n ?? 0);
	const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '—';
	$: missing = feasibility.filter(f => f.missing > 0);
	$: allOk = missing.length === 0;
	$: stockProgress = (f) => Math.min(100, f.stock > 0 && f.needed > 0 ? (f.stock / f.needed) * 100 : 0);
</script>

<svelte:head><title>{project.name} — Pañol</title></svelte:head>

<div class="page-header">
	<div class="page-header-left">
		<a href="/proyectos" class="btn btn-ghost btn-sm mb-4">← Proyectos</a>
		<h1 class="page-title">{project.name}</h1>
		{#if project.description}
			<p class="page-subtitle">{project.description}</p>
		{/if}
	</div>
	<div class="page-actions">
		<a href="/delivery" class="btn btn-primary" class:disabled={!allOk}>
			<i class="ph ph-truck"></i> Crear Entrega
		</a>
	</div>
</div>

<!-- Feasibility Banner -->
<div class="feasibility-banner mb-8" class:all-ok={allOk} class:has-missing={!allOk}>
	<div class="fb-main">
		<span class="fb-icon">
			{#if allOk}
				<i class="ph ph-check-circle text-success"></i>
			{:else}
				<i class="ph ph-warning-circle text-warning"></i>
			{/if}
		</span>
		<div>
			<div class="fb-title">
				{#if allOk}
					¡Tenés stock suficiente!
				{:else}
					Stock insuficiente para la meta
				{/if}
			</div>
			<div class="fb-sub">
				{$_('projects.canProduce')} <strong>{fmt(maxUnits)} kit{maxUnits !== 1 ? 's' : ''}</strong> completos
				{#if !allOk}
					· Faltan {missing.length} componente{missing.length !== 1 ? 's' : ''}
				{/if}
			</div>
		</div>
	</div>
	{#if !allOk}
		<a href="/compras/ordenes" class="btn btn-ghost btn-sm"><i class="ph ph-shopping-cart"></i> Comprar faltantes</a>
	{/if}
</div>

<!-- BOM Table -->
<div class="card">
	<div class="card-header">
		<span class="card-title"><i class="ph ph-gear"></i> {$_('projects.bom')}</span>
		<span class="badge badge-neutral">{feasibility.length} componentes</span>
	</div>
	<div class="table-wrapper" style="border:none;border-radius:0">
		<table>
			<thead>
				<tr>
					<th>SKU</th>
					<th>Componente</th>
					<th style="text-align:right">Necesario</th>
					<th style="text-align:right">Stock Disponible</th>
					<th style="min-width:160px">Cobertura</th>
					<th style="text-align:right">Posibles</th>
					<th style="text-align:right">Faltante</th>
				</tr>
			</thead>
			<tbody>
				{#each feasibility as f}
					<tr class:row-missing={f.missing > 0}>
						<td><span class="chip">{f.sku}</span></td>
						<td class="font-semibold">{f.name}</td>
						<td class="text-right">{fmt(f.needed)} {f.unit}</td>
						<td class="text-right">
							<span class:text-success={f.stock >= f.needed} class:text-danger={f.stock < f.needed}>
								{fmt(f.stock)} {f.unit}
							</span>
						</td>
						<td>
							<div class="progress {f.stock >= f.needed ? 'progress-success' : 'progress-danger'}">
								<div class="progress-bar" style="width:{stockProgress(f)}%"></div>
							</div>
						</td>
						<td class="text-right font-semibold">{f.possible === Infinity ? '∞' : fmt(f.possible)}</td>
						<td class="text-right">
							{#if f.missing > 0}
								<span class="badge badge-danger">−{fmt(f.missing)} {f.unit}</span>
							{:else}
								<span class="badge badge-success">OK</span>
							{/if}
						</td>
					</tr>
				{:else}
					<tr><td colspan="7"><div class="empty-state" style="padding:2rem"><div class="empty-icon"><i class="ph ph-clipboard-text"></i></div><div class="empty-title">Sin BOM definida</div></div></td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

{#if !allOk}
	<div class="card mt-6" style="border-color: rgba(239,68,68,0.3)">
		<div class="card-header">
			<span class="card-title" style="color: var(--danger)"><i class="ph ph-warning-circle"></i> {$_('projects.missingComponents')}</span>
		</div>
		<div class="missing-list">
			{#each missing as f}
				<div class="missing-item">
					<span class="chip">{f.sku}</span>
					<span class="font-semibold">{f.name}</span>
					<span class="ml-auto badge badge-danger">Necesitás {fmt(f.missing)} {f.unit} más</span>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.feasibility-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-5);
		padding: var(--space-5) var(--space-6);
		border-radius: var(--radius-lg);
		border: 1px solid;
	}
	.all-ok {
		background: rgba(16,185,129,0.08);
		border-color: rgba(16,185,129,0.3);
	}
	.has-missing {
		background: rgba(245,158,11,0.08);
		border-color: rgba(245,158,11,0.3);
	}
	.fb-main { display: flex; align-items: center; gap: var(--space-4); }
	.fb-icon { font-size: 2rem; }
	.fb-title { font-size: 1rem; font-weight: 700; color: var(--text-primary); }
	.fb-sub { font-size: 0.875rem; color: var(--text-secondary); }

	.row-missing { background: rgba(239,68,68,0.04); }

	.missing-list { display: flex; flex-direction: column; gap: 8px; }
	.missing-item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 10px 0;
		border-bottom: 1px solid var(--border);
		font-size: 0.875rem;
	}
	.missing-item:last-child { border-bottom: none; }
	.ml-auto { margin-left: auto; }
</style>
