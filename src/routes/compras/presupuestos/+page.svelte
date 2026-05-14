<script>
	import { _ } from 'svelte-i18n';
	import { supabase } from '$lib/supabase.js';
	import { toast } from '$lib/stores/toast.js';
	import { invalidateAll, goto } from '$app/navigation';

	export let data;
	$: ({ budgets, suppliers, materials } = data);

	const fmtMoney = (n) => n != null ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n) : '—';
	const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '—';

	let showModal = false;
	let saving = false;
	let form = { supplier_a_id: '', supplier_b_id: '', notes: '' };
	let budgetItems = [{ material_sku: '', quantity: 1, price_a: 0, price_b: 0 }];

	async function openNew() {
		form = { supplier_a_id: '', supplier_b_id: '', notes: '' };
		budgetItems = [{ material_sku: '', quantity: 1, price_a: 0, price_b: 0 }];
		showModal = true;
	}
	function closeModal() { showModal = false; }

	function addItem() { budgetItems = [...budgetItems, { material_sku: '', quantity: 1, price_a: 0, price_b: 0 }]; }
	function removeItem(i) { budgetItems = budgetItems.filter((_, idx) => idx !== i); }

	$: totalA = budgetItems.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.price_a) || 0), 0);
	$: totalB = budgetItems.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.price_b) || 0), 0);
	$: winner = totalA > 0 && totalB > 0 ? (totalA < totalB ? 'A' : 'B') : null;

	async function saveBudget() {
		if (!form.supplier_a_id || !form.supplier_b_id || budgetItems.some(i => !i.material_sku)) {
			toast.error('Completá todos los campos obligatorios');
			return;
		}
		saving = true;
		const { data: b, error: bErr } = await supabase
			.from('budgets')
			.insert({
				supplier_a_id: form.supplier_a_id,
				supplier_b_id: form.supplier_b_id,
				notes: form.notes
			})
			.select()
			.single();
		
		if (bErr) { toast.error(bErr.message); saving = false; return; }

		const items = budgetItems.map(i => ({
			budget_id: b.id,
			material_sku: i.material_sku,
			quantity: Number(i.quantity),
			price_a: Number(i.price_a),
			price_b: Number(i.price_b)
		}));

		const { error: iErr } = await supabase.from('budget_items').insert(items);
		saving = false;
		if (iErr) toast.error(iErr.message);
		else {
			toast.success('Presupuesto guardado');
			closeModal();
			invalidateAll();
		}
	}

	async function createOC(budget, side) {
		const supplier_id = side === 'A' ? budget.supplier_a_id : budget.supplier_b_id;
		if (!supplier_id) return;

		if (!confirm(`¿Generar Orden de Compra para ${side === 'A' ? budget.supplier_a.razon_social : budget.supplier_b.razon_social}?`)) return;

		saving = true;
		// 1. Create OC
		const { data: oc, error: ocErr } = await supabase
			.from('purchase_orders')
			.insert({
				supplier_id,
				status: 'draft',
				notes: `Generada desde presupuesto #${budget.id.split('-')[0]}`
			})
			.select()
			.single();
		
		if (ocErr) { toast.error(ocErr.message); saving = false; return; }

		// 2. Fetch budget items
		const { data: bItems } = await supabase.from('budget_items').select('*').eq('budget_id', budget.id);

		// 3. Insert OC items
		const ocItems = bItems.map(i => ({
			po_id: oc.id,
			material_sku: i.material_sku,
			requested_qty: i.quantity,
			unit_price: side === 'A' ? i.price_a : i.price_b,
			subtotal: i.quantity * (side === 'A' ? i.price_a : i.price_b)
		}));

		await supabase.from('purchase_order_items').insert(ocItems);
		
		// 4. Update budget status
		await supabase.from('budgets').update({ status: 'converted' }).eq('id', budget.id);

		toast.success('Orden de Compra generada');
		saving = false;
		invalidateAll();
		goto('/compras/ordenes/' + oc.id);
	}
	async function deleteBudget(id) {
		if (!confirm('¿Eliminar esta comparativa de presupuesto?')) return;
		const { error } = await supabase.from('budgets').delete().eq('id', id);
		if (error) toast.error(error.message);
		else { toast.success('Presupuesto eliminado'); invalidateAll(); }
	}
</script>

<svelte:head><title>Presupuestos — Pañol</title></svelte:head>

<div class="page-header">
	<div class="page-header-left">
		<h1 class="page-title">{$_('purchases.budgets.title')}</h1>
		<p class="page-subtitle">Comparativa de proveedores y selección de mejor precio</p>
	</div>
	<div class="page-actions">
		<button class="btn btn-primary" on:click={openNew}>+ {$_('purchases.budgets.newBudget')}</button>
	</div>
</div>

<div class="table-wrapper">
	<table>
		<thead>
			<tr>
				<th>Fecha</th>
				<th>Proveedor A</th>
				<th>Proveedor B</th>
				<th>Estado</th>
				<th>Notas</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each budgets as b}
				<tr>
					<td class="td-muted">{fmtDate(b.created_at)}</td>
					<td>
						<div class="font-semibold">{b.supplier_a?.razon_social}</div>
					</td>
					<td>
						<div class="font-semibold">{b.supplier_b?.razon_social}</div>
					</td>
					<td>
						<span class="badge {b.status === 'converted' ? 'badge-success' : 'badge-neutral'}">
							{b.status === 'converted' ? 'Convertido' : 'Borrador'}
						</span>
					</td>
					<td class="td-muted truncate" style="max-width:150px">{b.notes || ''}</td>
					<td>
						<div class="flex gap-2 justify-end">
							{#if b.status !== 'converted'}
								<button class="btn btn-ghost btn-sm btn-icon text-danger" on:click={() => deleteBudget(b.id)}><i class="ph ph-trash"></i></button>
								<button class="btn btn-outline btn-sm" on:click={() => createOC(b, 'A')}>OC (A)</button>
								<button class="btn btn-outline btn-sm" on:click={() => createOC(b, 'B')}>OC (B)</button>
							{/if}
						</div>
					</td>
				</tr>
			{:else}
				<tr><td colspan="6"><div class="empty-state"><div class="empty-icon"><i class="ph ph-scales"></i></div><div class="empty-title">Sin presupuestos</div></div></td></tr>
			{/each}
		</tbody>
	</table>
</div>

{#if showModal}
<div class="modal-backdrop" on:click|self={closeModal}>
	<div class="modal modal-xl">
		<div class="modal-header">
			<span class="modal-title">Comparar Presupuestos</span>
			<button class="btn btn-ghost btn-sm btn-icon" on:click={closeModal}>✕</button>
		</div>
		<div class="modal-body">
			<div class="form-grid-2 mb-6">
				<div class="form-group">
					<label class="form-label">{$_('purchases.budgets.supplierA')} *</label>
					<select class="form-control" bind:value={form.supplier_a_id}>
						<option value="">Seleccionar...</option>
						{#each suppliers as s}<option value={s.id}>{s.razon_social}</option>{/each}
					</select>
				</div>
				<div class="form-group">
					<label class="form-label">{$_('purchases.budgets.supplierB')} *</label>
					<select class="form-control" bind:value={form.supplier_b_id}>
						<option value="">Seleccionar...</option>
						{#each suppliers as s}<option value={s.id}>{s.razon_social}</option>{/each}
					</select>
				</div>
			</div>

			<div class="divider"></div>
			
			<div class="flex items-center justify-between mb-4">
				<h4>Ítems a Cotizar</h4>
				<button class="btn btn-outline btn-sm" on:click={addItem}>+ Agregar ítem</button>
			</div>

			<div class="budget-items-list">
				<div class="bi-row bi-header-row">
					<div style="flex:2">Material</div>
					<div style="flex:0.8">Cant.</div>
					<div style="flex:1">Precio A</div>
					<div style="flex:1">Precio B</div>
					<div style="width:32px"></div>
				</div>
				{#each budgetItems as item, i}
					<div class="bi-row">
						<div style="flex:2">
							<select class="form-control" bind:value={item.material_sku}>
								<option value="">Seleccionar material...</option>
								{#each materials as m}<option value={m.sku}>{m.name}</option>{/each}
							</select>
						</div>
						<div style="flex:0.8">
							<input type="number" class="form-control" bind:value={item.quantity} />
						</div>
						<div style="flex:1">
							<input type="number" step="0.01" class="form-control" class:winner={item.price_a > 0 && item.price_a < item.price_b} bind:value={item.price_a} />
						</div>
						<div style="flex:1">
							<input type="number" step="0.01" class="form-control" class:winner={item.price_b > 0 && item.price_b < item.price_a} bind:value={item.price_b} />
						</div>
						<div style="width:32px">
							<button class="btn btn-ghost btn-sm btn-icon" on:click={() => removeItem(i)}>✕</button>
						</div>
					</div>
				{/each}
			</div>

			<div class="budget-summary mt-6">
				<div class="bs-col" class:winner={winner === 'A'}>
					<span class="bs-label">Total {form.supplier_a_id ? suppliers.find(s=>s.id===form.supplier_a_id)?.razon_social : 'A'}</span>
					<span class="bs-val">{fmtMoney(totalA)}</span>
					{#if winner === 'A'}<span class="winner-tag">Mejor Opción</span>{/if}
				</div>
				<div class="bs-col" class:winner={winner === 'B'}>
					<span class="bs-label">Total {form.supplier_b_id ? suppliers.find(s=>s.id===form.supplier_b_id)?.razon_social : 'B'}</span>
					<span class="bs-val">{fmtMoney(totalB)}</span>
					{#if winner === 'B'}<span class="winner-tag">Mejor Opción</span>{/if}
				</div>
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn btn-ghost" on:click={closeModal}>{$_('common.cancel')}</button>
			<button class="btn btn-primary" on:click={saveBudget} disabled={saving}>
				{saving ? 'Guardando...' : 'Guardar Comparativa'}
			</button>
		</div>
	</div>
</div>
{/if}

<style>
	.bi-row { display: flex; gap: var(--space-3); padding: var(--space-2) 0; align-items: center; }
	.bi-header-row { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); border-bottom: 1px solid var(--border); margin-bottom: var(--space-2); padding-bottom: var(--space-3); }
	
	.winner { border-color: var(--secondary) !important; background: rgba(16,185,129,0.05) !important; color: var(--secondary) !important; font-weight: 700; }

	.budget-summary {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
		padding: var(--space-4);
		background: var(--bg-surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
	}
	.bs-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-4);
		border-radius: var(--radius);
		transition: all var(--transition);
		position: relative;
	}
	.bs-col.winner { background: rgba(16,185,129,0.1); border: 1px solid var(--secondary); }
	.bs-label { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px; }
	.bs-val { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); }
	.winner-tag {
		position: absolute;
		top: -10px;
		background: var(--secondary);
		color: white;
		font-size: 0.65rem;
		padding: 2px 8px;
		border-radius: 10px;
		font-weight: 700;
		text-transform: uppercase;
	}
</style>
