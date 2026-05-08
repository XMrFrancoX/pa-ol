<script>
	import { _ } from 'svelte-i18n';
	import { supabase } from '$lib/supabase.js';
	import { toast } from '$lib/stores/toast.js';
	import { invalidateAll } from '$app/navigation';

	export let data;
	$: ({ suppliers } = data);

	const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '—';

	let showModal = false;
	let editingSup = null;
	let saving = false;
	let form = { razon_social: '', cuit: '', address: '', contact_info: '' };

	function openNew() { editingSup = null; form = { razon_social: '', cuit: '', address: '', contact_info: '' }; showModal = true; }
	function openEdit(s) { editingSup = s; form = { razon_social: s.razon_social, cuit: s.cuit ?? '', address: s.address ?? '', contact_info: s.contact_info ?? '' }; showModal = true; }
	function closeModal() { showModal = false; }

	async function save() {
		if (!form.razon_social) return;
		saving = true;
		const payload = { razon_social: form.razon_social, cuit: form.cuit, address: form.address, contact_info: form.contact_info };
		let error;
		if (editingSup) {
			({ error } = await supabase.from('suppliers').update(payload).eq('id', editingSup.id));
		} else {
			({ error } = await supabase.from('suppliers').insert(payload));
		}
		saving = false;
		if (error) toast.error('Error: ' + error.message);
		else { toast.success('Proveedor guardado'); closeModal(); invalidateAll(); }
	}

	async function del(id) {
		if (!confirm('¿Eliminar proveedor?')) return;
		const { error } = await supabase.from('suppliers').delete().eq('id', id);
		if (error) toast.error('Error: ' + error.message);
		else { toast.success('Proveedor eliminado'); invalidateAll(); }
	}
</script>

<svelte:head><title>Proveedores — Pañol</title></svelte:head>

<div class="page-header">
	<div class="page-header-left">
		<h1 class="page-title">{$_('purchases.title')} — Proveedores</h1>
		<p class="page-subtitle">ABM de proveedores</p>
	</div>
	<div class="page-actions">
		<a href="/compras/ordenes" class="btn btn-ghost">← Órdenes de Compra</a>
		<button id="new-supplier-btn" class="btn btn-primary" on:click={openNew}>+ {$_('purchases.newSupplier')}</button>
	</div>
</div>

<div class="table-wrapper">
	<table>
		<thead>
			<tr>
				<th>{$_('purchases.razonSocial')}</th>
				<th>{$_('purchases.cuit')}</th>
				<th>{$_('purchases.address')}</th>
				<th>{$_('purchases.contact')}</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each suppliers as s}
				<tr>
					<td class="font-semibold">{s.razon_social}</td>
					<td class="td-muted number-mono">{s.cuit ?? '—'}</td>
					<td class="td-muted">{s.address ?? '—'}</td>
					<td class="td-muted">{s.contact_info ?? '—'}</td>
					<td>
						<div class="flex gap-2 justify-end">
							<button class="btn btn-ghost btn-sm btn-icon" on:click={() => openEdit(s)} title="Editar"><i class="ph ph-pencil-simple"></i></button>
							<button class="btn btn-ghost btn-sm btn-icon" on:click={() => del(s.id)} title="Eliminar"><i class="ph ph-trash"></i></button>
						</div>
					</td>
				</tr>
			{:else}
				<tr><td colspan="5">
					<div class="empty-state">
						<div class="empty-icon"><i class="ph ph-buildings"></i></div>
						<div class="empty-title">Sin proveedores</div>
						<div class="empty-desc">Agregá el primer proveedor para poder crear órdenes de compra.</div>
					</div>
				</td></tr>
			{/each}
		</tbody>
	</table>
</div>

{#if showModal}
<div class="modal-backdrop" on:click|self={closeModal}>
	<div class="modal">
		<div class="modal-header">
			<span class="modal-title">{editingSup ? 'Editar Proveedor' : $_('purchases.newSupplier')}</span>
			<button class="btn btn-ghost btn-sm btn-icon" on:click={closeModal}>✕</button>
		</div>
		<div class="modal-body">
			<div class="form-group">
				<label class="form-label" for="sup-rs">{$_('purchases.razonSocial')} *</label>
				<input id="sup-rs" class="form-control" bind:value={form.razon_social} placeholder="Empresa S.A." />
			</div>
			<div class="form-grid-2 mt-4">
				<div class="form-group">
					<label class="form-label" for="sup-cuit">{$_('purchases.cuit')}</label>
					<input id="sup-cuit" class="form-control" bind:value={form.cuit} placeholder="20-12345678-9" />
				</div>
				<div class="form-group">
					<label class="form-label" for="sup-contact">{$_('purchases.contact')}</label>
					<input id="sup-contact" class="form-control" bind:value={form.contact_info} placeholder="Tel / Email" />
				</div>
			</div>
			<div class="form-group mt-4">
				<label class="form-label" for="sup-addr">{$_('purchases.address')}</label>
				<input id="sup-addr" class="form-control" bind:value={form.address} placeholder="Av. Corrientes 1234, CABA" />
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn btn-ghost" on:click={closeModal}>{$_('common.cancel')}</button>
			<button class="btn btn-primary" on:click={save} disabled={saving || !form.razon_social}>
				{saving ? $_('common.loading') : $_('common.save')}
			</button>
		</div>
	</div>
</div>
{/if}
