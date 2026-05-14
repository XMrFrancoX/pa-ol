<script>
	import { _ } from 'svelte-i18n';
	import { supabase } from '$lib/supabase.js';
	import { toast } from '$lib/stores/toast.js';
	import { invalidateAll, goto } from '$app/navigation';
	import { generateRemitoPDF } from '$lib/pdf.js';

	export let data;
	$: ({ deliveries } = data);

	const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '—';
	const statusBadge = { pending: 'badge-warning', delivered: 'badge-success', returned: 'badge-info' };
	const statusLabel = { pending: 'Pendiente', delivered: 'Entregado', returned: 'Devuelto' };

	let showModal = false;
	let saving = false;

	let form = { responsible_id: '', project_id: '', notes: '', recipient_id: '', delivery_date: new Date().toISOString().split('T')[0] };
	let deliveryItems = [{ material_sku: '', material_name: '', location_id: '', quantity: 1 }];
	let materials = [];
	let locations = [];
	let projects = [];
	let users = [];

	async function openNew() {
		const [mats, locs, projs, usrs] = await Promise.all([
			supabase.from('materials').select('sku, name, unit_of_measure').order('name'),
			supabase.from('locations').select('*').order('name'),
			supabase.from('projects').select('id, name').order('name'),
			supabase.from('user_profiles').select('id, full_name').order('full_name')
		]);
		materials = mats.data ?? [];
		locations = locs.data ?? [];
		projects = projs.data ?? [];
		users = usrs.data ?? [];
		form = { responsible_id: '', project_id: '', notes: '', recipient_id: '', delivery_date: new Date().toISOString().split('T')[0] };
		deliveryItems = [{ material_sku: '', material_name: '', location_id: '', quantity: 1 }];
		showModal = true;
	}
	function closeModal() { showModal = false; }

	function addItem() { deliveryItems = [...deliveryItems, { material_sku: '', material_name: '', location_id: '', quantity: 1 }]; }
	function removeItem(i) { deliveryItems = deliveryItems.filter((_, idx) => idx !== i); }

	function onSkuChange(i) {
		const mat = materials.find(m => m.sku === deliveryItems[i].material_sku);
		if (mat) { deliveryItems[i].material_name = mat.name; deliveryItems = [...deliveryItems]; }
	}

	async function importFromProject() {
		if (!form.project_id) return;
		const { data: bom } = await supabase
			.from('project_bom')
			.select('material_sku, quantity_needed, materials(name)')
			.eq('project_id', form.project_id);
		if (bom?.length) {
			deliveryItems = bom.map(b => ({
				material_sku: b.material_sku,
				material_name: b.materials?.name ?? '',
				location_id: '',
				quantity: b.quantity_needed
			}));
			toast.info('BOM importada del proyecto');
		}
	}

	async function saveDelivery() {
		if (!form.responsible_id || deliveryItems.some(i => !i.material_sku)) return;
		saving = true;

		// Validate stock
		for (const item of deliveryItems) {
			if (item.location_id) {
				const { data: sl } = await supabase
					.from('stock_by_location')
					.select('quantity')
					.eq('material_sku', item.material_sku)
					.eq('location_id', item.location_id)
					.single();
				if (!sl || sl.quantity < item.quantity) {
					toast.error(`Stock insuficiente para ${item.material_name} en la ubicación seleccionada.`);
					saving = false;
					return;
				}
			}
		}

		// Create delivery
		const { data: delivery, error: dErr } = await supabase
			.from('deliveries')
			.insert({
				responsible_id: form.responsible_id,
				project_id: form.project_id || null,
				recipient_id: form.recipient_id || null,
				delivery_date: form.delivery_date || null,
				notes: form.notes,
				status: 'pending'
			})
			.select()
			.single();
		if (dErr) { toast.error('Error: ' + dErr.message); saving = false; return; }

		// Insert items
		const items = deliveryItems.map(i => ({
			delivery_id: delivery.id,
			material_sku: i.material_sku,
			location_id: i.location_id || null,
			quantity: Number(i.quantity)
		}));
		await supabase.from('delivery_items').insert(items);

		toast.success('Entrega creada');
		saving = false;
		closeModal();
		goto('/delivery/' + delivery.id);
	}
</script>

<svelte:head><title>Delivery — Pañol</title></svelte:head>

<div class="page-header">
	<div class="page-header-left">
		<h1 class="page-title">{$_('delivery.title')}</h1>
		<p class="page-subtitle">{$_('delivery.subtitle')}</p>
	</div>
	<div class="page-actions">
		<button id="new-delivery-btn" class="btn btn-primary" on:click={openNew}>+ {$_('delivery.newDelivery')}</button>
	</div>
</div>

<div class="table-wrapper">
	<table>
		<thead>
			<tr>
				<th>N°</th>
				<th>Responsable</th>
				<th>Proyecto</th>
				<th>{$_('common.status')}</th>
				<th>Fecha</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each deliveries as d}
				<tr>
					<td><span class="chip number-mono">ENT-{String(d.id).padStart(5,'0')}</span></td>
					<td class="font-semibold">{d.user_profiles?.full_name ?? '—'}</td>
					<td class="td-muted">{d.projects?.name ?? '—'}</td>
					<td><span class="badge {statusBadge[d.status] ?? 'badge-neutral'}">{statusLabel[d.status] ?? d.status}</span></td>
					<td class="td-muted">{fmtDate(d.created_at)}</td>
					<td><a href="/delivery/{d.id}" class="btn btn-ghost btn-sm">Ver →</a></td>
				</tr>
			{:else}
				<tr><td colspan="6">
					<div class="empty-state">
						<div class="empty-icon"><i class="ph ph-truck"></i></div>
						<div class="empty-title">Sin entregas</div>
						<div class="empty-desc">Registrá la primera entrega de materiales.</div>
					</div>
				</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- Modal: Nueva Entrega -->
{#if showModal}
<div class="modal-backdrop" on:click|self={closeModal}>
	<div class="modal modal-xl">
		<div class="modal-header">
			<span class="modal-title">Nueva Entrega</span>
			<button class="btn btn-ghost btn-sm btn-icon" on:click={closeModal}>✕</button>
		</div>
		<div class="modal-body">
			<div class="form-grid-2">
				<div class="form-group">
					<label class="form-label" for="d-resp">Responsable *</label>
					<select id="d-resp" class="form-control" bind:value={form.responsible_id}>
						<option value="">Seleccionar responsable...</option>
						{#each users as u}<option value={u.id}>{u.full_name}</option>{/each}
					</select>
				</div>
				<div class="form-group">
					<label class="form-label" for="d-proj">Proyecto (opcional)</label>
					<div class="flex gap-2">
						<select id="d-proj" class="form-control" bind:value={form.project_id}>
							<option value="">Sin proyecto</option>
							{#each projects as p}<option value={p.id}>{p.name}</option>{/each}
						</select>
						{#if form.project_id}
							<button class="btn btn-outline btn-sm" style="white-space:nowrap" on:click={importFromProject}>
								<i class="ph ph-download-simple"></i> Importar BOM
							</button>
						{/if}
					</div>
				</div>
				<div class="form-group">
					<label class="form-label" for="d-recip">{$_('delivery.receivedBy')}</label>
					<select id="d-recip" class="form-control" bind:value={form.recipient_id}>
						<option value="">Seleccionar receptor...</option>
						{#each users as u}<option value={u.id}>{u.full_name}</option>{/each}
					</select>
				</div>
				<div class="form-group">
					<label class="form-label" for="d-date">{$_('delivery.deliveredAt')}</label>
					<input id="d-date" type="date" class="form-control" bind:value={form.delivery_date} />
				</div>
				<div class="form-group" style="grid-column:1/-1">
					<label class="form-label" for="d-notes">Observaciones</label>
					<input id="d-notes" class="form-control" bind:value={form.notes} placeholder="Notas opcionales..." />
				</div>
			</div>

			<div class="divider"></div>
			<div class="flex items-center justify-between mb-4">
				<h4>Materiales a Entregar</h4>
				<button class="btn btn-outline btn-sm" on:click={addItem}>+ Agregar</button>
			</div>

			{#each deliveryItems as item, i}
				<div class="d-item-row">
					<div class="form-group" style="flex:2">
						<label class="form-label">Material *</label>
						<select class="form-control" bind:value={item.material_sku} on:change={() => onSkuChange(i)}>
							<option value="">Seleccionar...</option>
							{#each materials as m}<option value={m.sku}>{m.name} ({m.sku})</option>{/each}
						</select>
					</div>
					<div class="form-group" style="flex:1">
						<label class="form-label">Cantidad *</label>
						<input type="number" min="1" class="form-control" bind:value={item.quantity} />
					</div>
					<div class="form-group" style="flex:1.5">
						<label class="form-label">Ubicación de Origen</label>
						<select class="form-control" bind:value={item.location_id}>
							<option value="">Sin especificar</option>
							{#each locations as l}<option value={l.id}>{l.name}</option>{/each}
						</select>
					</div>
					{#if deliveryItems.length > 1}
						<button class="btn btn-ghost btn-sm btn-icon" style="margin-top:1.6rem" on:click={() => removeItem(i)}>✕</button>
					{/if}
				</div>
			{/each}
		</div>
		<div class="modal-footer">
			<button class="btn btn-ghost" on:click={closeModal}>{$_('common.cancel')}</button>
			<button class="btn btn-primary" on:click={saveDelivery} disabled={saving || !form.responsible_id}>
				{saving ? 'Guardando...' : 'Crear Entrega'}
			</button>
		</div>
	</div>
</div>
{/if}

<style>
	.d-item-row { display: flex; gap: var(--space-3); align-items: flex-start; padding: var(--space-3) 0; border-bottom: 1px solid var(--border); }
	.d-item-row:last-child { border-bottom: none; }
</style>
