<script>
	import { _ } from 'svelte-i18n';
	import { supabase } from '$lib/supabase.js';
	import { toast } from '$lib/stores/toast.js';
	import { invalidateAll } from '$app/navigation';
	import { generateRemitoPDF } from '$lib/pdf.js';

	export let data;
	$: ({ delivery } = data);

	const fmtDate = (d) => d ? new Date(d).toLocaleString('es-AR') : '—';
	const statusBadge = { pending: 'badge-warning', delivered: 'badge-success', returned: 'badge-info' };
	const statusLabel = { pending: 'Pendiente', delivered: 'Entregado', returned: 'Devuelto' };

	let confirming = false;

	async function confirmDelivery() {
		confirming = true;
		try {
			// Discount stock for each item
			for (const item of delivery.delivery_items) {
				if (item.locations?.id) {
					const { data: sl } = await supabase
						.from('stock_by_location')
						.select('id, quantity')
						.eq('material_sku', item.materials?.sku)
						.eq('location_id', item.locations.id)
						.single();

					if (!sl || sl.quantity < item.quantity) {
						toast.error(`Stock insuficiente para ${item.materials?.name}`);
						confirming = false;
						return;
					}
					await supabase.from('stock_by_location').update({
						quantity: sl.quantity - item.quantity
					}).eq('id', sl.id);
				}
			}

			await supabase.from('deliveries').update({
				status: 'delivered',
				delivered_at: new Date().toISOString()
			}).eq('id', delivery.id);

			toast.success('Entrega confirmada. Stock descontado.');
			invalidateAll();
		} catch (e) {
			toast.error('Error: ' + e.message);
		} finally {
			confirming = false;
		}
	}

	async function markReturned() {
		await supabase.from('deliveries').update({ status: 'returned' }).eq('id', delivery.id);
		toast.info('Entrega marcada como devuelta');
		invalidateAll();
	}

	function downloadPDF() {
		const items = delivery.delivery_items.map(i => ({
			material_sku: i.materials?.sku,
			material_name: i.materials?.name,
			location_name: i.locations?.name,
			quantity: i.quantity,
			unit_of_measure: i.materials?.unit_of_measure
		}));
		generateRemitoPDF({
			id: delivery.id,
			created_at: delivery.created_at,
			status: statusLabel[delivery.status],
			responsible_name: delivery.user_profiles?.full_name,
			project_name: delivery.projects?.name,
			notes: delivery.notes
		}, items);
	}
</script>

<svelte:head><title>Entrega ENT-{String(delivery.id).padStart(5,'0')} — Pañol</title></svelte:head>

<div class="page-header">
	<div class="page-header-left">
		<a href="/delivery" class="btn btn-ghost btn-sm mb-4">← Volver</a>
		<h1 class="page-title">ENT-{String(delivery.id).padStart(5,'0')}</h1>
		<div class="flex items-center gap-3 mt-2">
			<span class="badge {statusBadge[delivery.status]}">{statusLabel[delivery.status]}</span>
			<span class="text-secondary text-sm">{delivery.user_profiles?.full_name}</span>
			<span class="text-muted text-sm">· {fmtDate(delivery.created_at)}</span>
		</div>
	</div>
	<div class="page-actions">
		<button id="download-pdf-btn" class="btn btn-ghost" on:click={downloadPDF}>
			<i class="ph ph-file-pdf"></i> {$_('delivery.generateRemito')}
		</button>
		{#if delivery.status === 'pending'}
			<button id="confirm-delivery-btn" class="btn btn-primary" on:click={confirmDelivery} disabled={confirming}>
				{confirming ? 'Procesando...' : '✓ Confirmar Entrega'}
			</button>
		{:else if delivery.status === 'delivered'}
			<button class="btn btn-ghost" on:click={markReturned}><i class="ph ph-arrow-u-up-left"></i> Marcar como Devuelto</button>
		{/if}
	</div>
</div>

<div class="grid-2 mb-6">
	<div class="card">
		<div class="card-header"><span class="card-title"><i class="ph ph-user"></i> Responsable</span></div>
		<div class="info-list">
			<div class="info-row"><span class="info-label">Nombre</span><span class="font-semibold">{delivery.user_profiles?.full_name ?? '—'}</span></div>
			<div class="info-row"><span class="info-label">Email</span><span class="td-muted">{delivery.user_profiles?.email ?? '—'}</span></div>
			<div class="info-row"><span class="info-label">Proyecto</span><span>{delivery.projects?.name ?? 'Sin proyecto'}</span></div>
			<div class="info-row"><span class="info-label">Fecha Entrega</span><span>{fmtDate(delivery.delivered_at)}</span></div>
		</div>
	</div>

	<!-- Status visual -->
	<div class="card">
		<div class="card-header"><span class="card-title"><i class="ph ph-chart-bar"></i> Estado</span></div>
		<div class="status-track">
			{#each [['pending','Pendiente','<i class="ph ph-hourglass"></i>'], ['delivered','Entregado','<i class="ph ph-check-circle"></i>'], ['returned','Devuelto','<i class="ph ph-arrow-u-up-left"></i>']] as [s, label, icon]}
				<div class="st-step" class:done={delivery.status === s || (s === 'pending' && delivery.status === 'delivered')}>
					<div class="st-icon">{@html icon}</div>
					<div class="st-label">{label}</div>
				</div>
				{#if s !== 'returned'}<div class="st-line"></div>{/if}
			{/each}
		</div>
		{#if delivery.notes}
			<div class="mt-4 text-sm text-muted"><i class="ph ph-note-pencil"></i> {delivery.notes}</div>
		{/if}
	</div>
</div>

<!-- Items -->
<div class="card">
	<div class="card-header"><span class="card-title"><i class="ph ph-package"></i> Materiales Entregados</span></div>
	<div class="table-wrapper" style="border:none;border-radius:0">
		<table>
			<thead>
				<tr>
					<th>SKU</th>
					<th>Componente</th>
					<th>Ubicación</th>
					<th style="text-align:right">Cantidad</th>
				</tr>
			</thead>
			<tbody>
				{#each delivery.delivery_items as item}
					<tr>
						<td><span class="chip">{item.materials?.sku}</span></td>
						<td class="font-semibold">{item.materials?.name}</td>
						<td class="td-muted">{item.locations?.name ?? '—'}</td>
						<td class="text-right font-semibold">{item.quantity} {item.materials?.unit_of_measure}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

{#if delivery.status === 'pending'}
	<div class="alert alert-warning mt-6">
		<span><i class="ph ph-warning-circle"></i></span>
		<span>Esta entrega está <strong>pendiente</strong>. Al confirmar, el stock se descontará automáticamente de las ubicaciones seleccionadas.</span>
	</div>
{/if}

<style>
	.info-list { display: flex; flex-direction: column; gap: 12px; }
	.info-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; }
	.info-label { color: var(--text-muted); font-size: 0.8rem; }

	.status-track {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
		padding: var(--space-4) 0;
	}
	.st-step { display: flex; flex-direction: column; align-items: center; gap: 6px; }
	.st-icon {
		width: 40px; height: 40px;
		border-radius: 50%;
		background: var(--bg-surface);
		border: 2px solid var(--border);
		display: flex; align-items: center; justify-content: center;
		font-size: 1.1rem;
		transition: all var(--transition);
	}
	.st-step.done .st-icon {
		background: rgba(99,102,241,0.15);
		border-color: var(--primary);
	}
	.st-label { font-size: 0.72rem; color: var(--text-muted); text-align: center; }
	.st-step.done .st-label { color: var(--primary-light); }
	.st-line { flex: 1; height: 2px; background: var(--border); margin: 0 8px; margin-bottom: 20px; }
</style>
