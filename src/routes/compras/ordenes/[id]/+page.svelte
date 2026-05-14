<script>
	import { _ } from 'svelte-i18n';
	import { supabase } from '$lib/supabase.js';
	import { toast } from '$lib/stores/toast.js';
	import { invalidateAll } from '$app/navigation';

	export let data;
	$: ({ order, locations } = data);

	const fmtMoney = (n) => n != null ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n) : '—';
	const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '—';

	const statusBadge = { draft: 'badge-neutral', sent: 'badge-warning', received: 'badge-success', cancelled: 'badge-danger' };
	const statusLabel = { draft: 'Borrador', sent: 'Enviada', received: 'Recibida', cancelled: 'Cancelada' };

	// Reception form
	let showReceiveModal = false;
	let receiving = false;

	// Per-item: received_qty, unit_price, location_id
	let receiveData = {};

	function openReceive() {
		receiveData = {};
		for (const item of order.purchase_order_items) {
			receiveData[item.id] = {
				received_qty: item.received_qty ?? item.requested_qty,
				unit_price: item.unit_price ?? item.materials?.avg_cost ?? 0,
				location_id: ''
			};
		}
		showReceiveModal = true;
	}
	function closeReceive() { showReceiveModal = false; }

	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	onMount(() => {
		if ($page.url.searchParams.get('receive') === 'true' && (order.status === 'sent' || order.status === 'draft')) {
			openReceive();
		}
	});

	$: orderTotal = Object.values(receiveData).reduce((sum, r) => {
		return sum + (Number(r.received_qty) || 0) * (Number(r.unit_price) || 0);
	}, 0);

	async function confirmReceive() {
		// Validation: Ensure all items have a location
		if (Object.values(receiveData).some(r => !r.location_id)) {
			toast.error('Debes seleccionar una ubicación para todos los ítems para poder ingresar el stock.');
			return;
		}
		receiving = true;
		try {
			// 1. Update each purchase_order_item
			for (const item of order.purchase_order_items) {
				const r = receiveData[item.id];
				const qty = Number(r.received_qty);
				const price = Number(r.unit_price);
				const subtotal = qty * price;

				await supabase.from('purchase_order_items').update({
					received_qty: qty,
					unit_price: price,
					subtotal
				}).eq('id', item.id);

				// 2. Update stock_by_location
				if (r.location_id) {
					const { data: existing } = await supabase
						.from('stock_by_location')
						.select('id, quantity')
						.eq('material_sku', item.material_sku)
						.eq('location_id', r.location_id)
						.single();

					if (existing) {
						await supabase.from('stock_by_location').update({
							quantity: existing.quantity + qty
						}).eq('id', existing.id);
					} else {
						await supabase.from('stock_by_location').insert({
							material_sku: item.material_sku,
							location_id: r.location_id,
							quantity: qty
						});
					}
				}

				// 3. Recalculate PPP (Weighted Average Cost)
				const { data: stockRows } = await supabase
					.from('stock_by_location')
					.select('quantity')
					.eq('material_sku', item.material_sku);

				const { data: mat } = await supabase
					.from('materials')
					.select('avg_cost')
					.eq('sku', item.material_sku)
					.single();

				const currentStock = stockRows?.reduce((s, r2) => s + r2.quantity, 0) ?? 0;
				const currentAvgCost = mat?.avg_cost ?? 0;
				// PPP formula: (currentStock * currentAvgCost + qty * price) / (currentStock + qty)
				// Note: currentStock already includes the new qty at this point
				const prevStock = currentStock - qty;
				const newAvgCost = prevStock <= 0
					? price
					: (prevStock * currentAvgCost + qty * price) / currentStock;

				await supabase.from('materials').update({
					avg_cost: newAvgCost,
					last_purchase_price: price
				}).eq('sku', item.material_sku);
			}

			// 4. Update OC status
			await supabase.from('purchase_orders').update({
				status: 'received',
				received_at: new Date().toISOString(),
				total_value: orderTotal
			}).eq('id', order.id);

			toast.success('Mercadería recibida. Stock actualizado con PPP.');
			closeReceive();
			invalidateAll();
		} catch (e) {
			toast.error('Error al procesar: ' + e.message);
		} finally {
			receiving = false;
		}
	}

	async function updateStatus(status) {
		await supabase.from('purchase_orders').update({ status }).eq('id', order.id);
		toast.success('Estado actualizado');
		invalidateAll();
	}
	$: isProfesor = data.profile?.role === 'profesor';
</script>

<svelte:head><title>OC-{String(order.id).padStart(5,'0')} — Pañol</title></svelte:head>

<div class="page-header">
	<div class="page-header-left">
		<a href="/compras/ordenes" class="btn btn-ghost btn-sm mb-4">← Volver</a>
		<h1 class="page-title">OC-{String(order.id).padStart(5,'0')}</h1>
		<div class="flex items-center gap-3 mt-2">
			<span class="badge {statusBadge[order.status]}">{statusLabel[order.status]}</span>
			<span class="text-secondary text-sm">{order.suppliers?.razon_social}</span>
			<span class="text-muted text-sm">· {fmtDate(order.created_at)}</span>
		</div>
	</div>
	<div class="page-actions">
		{#if !isProfesor}
			{#if order.status === 'draft'}
				<button class="btn btn-ghost" on:click={() => updateStatus('sent')}><i class="ph ph-paper-plane-tilt"></i> Marcar como Enviada</button>
				<button id="receive-btn" class="btn btn-primary" on:click={openReceive}><i class="ph ph-download-simple"></i> Recibir Mercadería</button>
			{:else if order.status === 'sent'}
				<button id="receive-btn" class="btn btn-primary" on:click={openReceive}><i class="ph ph-download-simple"></i> Recibir Mercadería</button>
			{/if}
		{/if}
	</div>
</div>

<div class="grid-2 mb-6">
	<!-- Supplier Info -->
	<div class="card">
		<div class="card-header"><span class="card-title"><i class="ph ph-buildings"></i> Proveedor</span></div>
		<div class="info-list">
			<div class="info-row"><span class="info-label">Razón Social</span><span>{order.suppliers?.razon_social ?? '—'}</span></div>
			<div class="info-row"><span class="info-label">CUIT</span><span class="number-mono">{order.suppliers?.cuit ?? '—'}</span></div>
			<div class="info-row"><span class="info-label">Contacto</span><span>{order.suppliers?.contact_info ?? '—'}</span></div>
		</div>
	</div>
	<!-- Order Summary -->
	<div class="card">
		<div class="card-header"><span class="card-title"><i class="ph ph-clipboard-text"></i> Resumen</span></div>
		<div class="info-list">
			<div class="info-row"><span class="info-label">Fecha OC</span><span>{fmtDate(order.created_at)}</span></div>
			<div class="info-row"><span class="info-label">Fecha Recepción</span><span>{fmtDate(order.received_at)}</span></div>
			{#if !isProfesor}
				<div class="info-row"><span class="info-label">Total</span><span class="number-mono font-bold text-success">{fmtMoney(order.total_value)}</span></div>
			{/if}
			{#if order.notes}<div class="info-row"><span class="info-label">Notas</span><span>{order.notes}</span></div>{/if}
		</div>
	</div>
</div>

<!-- Items Table -->
<div class="card">
	<div class="card-header">
		<span class="card-title"><i class="ph ph-package"></i> Ítems de la Orden</span>
	</div>
	<div class="table-wrapper" style="border:none;border-radius:0">
		<table>
			<thead>
				<tr>
					<th>SKU</th>
					<th>Material</th>
					<th>Destino/Curso</th>
					<th style="text-align:right">Cant. Pedida</th>
					<th style="text-align:right">Cant. Recibida</th>
					{#if !isProfesor}
						<th style="text-align:right">Precio Unit.</th>
						<th style="text-align:right">Subtotal</th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each order.purchase_order_items as item}
					<tr>
						<td><span class="chip">{item.material_sku}</span></td>
						<td class="font-semibold">{item.materials?.name ?? '—'}</td>
						<td class="td-muted">
							{#if item.workshops}<span class="badge badge-info mr-1" style="font-size:0.65rem">{item.workshops.name}</span>{/if}
							{#if item.courses}<span class="badge badge-neutral mr-1" style="font-size:0.65rem">{item.courses.name}</span>{/if}
							{#if item.locations}<span class="badge badge-success mr-1" style="font-size:0.65rem">{item.locations.name}</span>{/if}
							<span>{item.destination_course || ''}</span>
						</td>
						<td class="text-right">{item.requested_qty} {item.materials?.unit_of_measure ?? ''}</td>
						<td class="text-right">
							{#if item.received_qty != null}
								<span class="text-success font-semibold">{item.received_qty}</span>
							{:else}
								<span class="text-muted">—</span>
							{/if}
						</td>
						{#if !isProfesor}
							<td class="text-right number-mono">{fmtMoney(item.unit_price)}</td>
							<td class="text-right number-mono font-semibold">{fmtMoney(item.subtotal)}</td>
						{/if}
					</tr>
				{/each}
			</tbody>
			{#if order.total_value && !isProfesor}
				<tfoot>
					<tr style="background: var(--bg-surface);">
						<td colspan="6" class="text-right font-semibold" style="padding: 12px 16px; color: var(--text-secondary);">Total OC:</td>
						<td class="text-right number-mono font-bold" style="padding: 12px 16px; color: var(--secondary); font-size:1rem">{fmtMoney(order.total_value)}</td>
					</tr>
				</tfoot>
			{/if}
		</table>
	</div>
</div>

<!-- Modal: Receive -->
{#if showReceiveModal}
<div class="modal-backdrop" on:click|self={closeReceive}>
	<div class="modal modal-xl">
		<div class="modal-header">
			<span class="modal-title"><i class="ph ph-download-simple"></i> Recibir Mercadería</span>
			<button class="btn btn-ghost btn-sm btn-icon" on:click={closeReceive}>✕</button>
		</div>
		<div class="modal-body">
			<div class="alert alert-info mb-5">
				<span><i class="ph ph-info"></i></span>
				<span>Ingresá la cantidad real recibida y el precio pagado. El sistema actualizará el stock y recalculará el Costo Promedio Ponderado (PPP) automáticamente.</span>
			</div>

			{#each order.purchase_order_items as item}
				{@const r = receiveData[item.id] ?? {}}
				<div class="receive-item">
					<div class="ri-header">
						<span class="chip">{item.material_sku}</span>
						<span class="ri-name">{item.materials?.name}</span>
						<span class="badge badge-neutral">Pedido: {item.requested_qty} {item.materials?.unit_of_measure}</span>
					</div>
					<div class="ri-fields">
						<div class="form-group">
							<label class="form-label">Cant. Recibida</label>
							<input type="number" min="0" class="form-control" bind:value={receiveData[item.id].received_qty} />
						</div>
						<div class="form-group">
							<label class="form-label">Precio Unit. (ARS)</label>
							<input type="number" min="0" step="0.01" class="form-control" bind:value={receiveData[item.id].unit_price} />
						</div>
						<div class="form-group">
							<label class="form-label">Ingresar a Ubicación *</label>
							<select class="form-control" bind:value={receiveData[item.id].location_id} required>
								<option value="">Seleccionar ubicación...</option>
								{#each locations as loc}<option value={loc.id}>{loc.name}</option>{/each}
							</select>
						</div>
						<div class="form-group">
							<label class="form-label">Subtotal</label>
							<div class="form-control" style="font-weight:700; color: var(--secondary); background: var(--bg-surface);">
								{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format((receiveData[item.id]?.received_qty || 0) * (receiveData[item.id]?.unit_price || 0))}
							</div>
						</div>
					</div>
					{#if item.materials?.avg_cost}
						<div class="ri-ppp">
							PPP actual: {fmtMoney(item.materials.avg_cost)} →
							<strong class="text-primary-color">
								{fmtMoney(
									((item.materials.avg_cost || 0) + (receiveData[item.id]?.unit_price || 0)) / 2
								)} (estimado)
							</strong>
						</div>
					{/if}
				</div>
			{/each}

			<div class="total-bar">
				<span>Total de la OC:</span>
				<span class="total-val">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(orderTotal)}</span>
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn btn-ghost" on:click={closeReceive}>{$_('common.cancel')}</button>
			<button class="btn btn-primary" on:click={confirmReceive} disabled={receiving}>
				{receiving ? 'Procesando...' : '✓ Confirmar Recepción'}
			</button>
		</div>
	</div>
</div>
{/if}

<style>
	.info-list { display: flex; flex-direction: column; gap: 12px; }
	.info-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; }
	.info-label { color: var(--text-muted); font-size: 0.8rem; }

	.receive-item {
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--border);
	}
	.receive-item:last-child { border-bottom: none; }
	.ri-header { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
	.ri-name { font-weight: 600; font-size: 0.9rem; flex: 1; }
	.ri-fields { display: grid; grid-template-columns: 1fr 1fr 1.5fr 1fr; gap: var(--space-3); }
	.ri-ppp { font-size: 0.78rem; color: var(--text-muted); margin-top: var(--space-2); }

	.total-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-4) var(--space-5);
		background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05));
		border: 1px solid rgba(16,185,129,0.2);
		border-radius: var(--radius);
		margin-top: var(--space-5);
		font-weight: 600;
	}
	.total-val { font-size: 1.5rem; font-weight: 800; color: var(--secondary); font-variant-numeric: tabular-nums; }
</style>
