<script>
	import { _ } from 'svelte-i18n';
	import { supabase } from '$lib/supabase.js';
	import { toast } from '$lib/stores/toast.js';
	import { invalidateAll } from '$app/navigation';

	export let data;
	$: ({ materials, locations, totalValuation, search: initSearch } = data);

	const fmtMoney = (n) => n != null ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n) : '—';
	const fmt = (n) => new Intl.NumberFormat('es-AR').format(n ?? 0);

	// Search
	let search = initSearch ?? '';
	let searchTimeout;
	function onSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			const url = new URL(window.location.href);
			url.searchParams.set('q', search);
			window.location.href = url.toString();
		}, 400);
	}

	// Drilldown
	let drilldownSku = null;
	function toggleDrilldown(sku) {
		drilldownSku = drilldownSku === sku ? null : sku;
	}
	let selectedMat = null;
	function selectMat(mat) {
		selectedMat = mat;
	}
	function closeSelected() { selectedMat = null; }

	function getTotalStock(mat) {
		return mat.stock_by_location?.reduce((s, r) => s + (r.quantity || 0), 0) ?? 0;
	}

	// Modal: Nuevo/Editar Material
	let showModal = false;
	let editingMat = null;
	let form = { sku: '', name: '', technical_spec: '', unit_of_measure: 'unidades', last_purchase_price: '', image_url: '' };
	let matStock = []; // [{ location_id, quantity }]
	let imageFile = null;
	let saving = false;
	const units = ['unidades', 'metros', 'packs', 'gramos', 'litros', 'pares'];

	function openNew() {
		editingMat = null;
		imageFile = null;
		form = { sku: '', name: '', technical_spec: '', unit_of_measure: 'unidades', last_purchase_price: '', image_url: '' };
		matStock = [{ location_id: '', quantity: 0 }];
		showModal = true;
	}
	function openEdit(mat) {
		editingMat = mat;
		imageFile = null;
		form = {
			sku: mat.sku,
			name: mat.name,
			technical_spec: mat.technical_spec ?? '',
			unit_of_measure: mat.unit_of_measure,
			last_purchase_price: mat.last_purchase_price ?? '',
			image_url: mat.image_url ?? ''
		};
		matStock = mat.stock_by_location?.map(s => ({ location_id: s.location_id, quantity: s.quantity })) || [];
		if (matStock.length === 0) matStock = [{ location_id: '', quantity: 0 }];
		showModal = true;
	}
	function closeModal() { showModal = false; }

	async function saveMaterial() {
		if (!form.sku || !form.name) return;
		saving = true;

		let uploadedUrl = form.image_url;

		// Si se seleccionó una imagen nueva, la subimos a Supabase Storage
		if (imageFile) {
			const fileExt = imageFile.name.split('.').pop();
			const fileName = `${form.sku.trim().toUpperCase()}-${Date.now()}.${fileExt}`;
			
			const { error: uploadError } = await supabase.storage
				.from('material-images')
				.upload(fileName, imageFile);

			if (uploadError) {
				toast.error('Error al subir la imagen: ' + uploadError.message);
				saving = false;
				return;
			}
			
			const { data: publicUrlData } = supabase.storage
				.from('material-images')
				.getPublicUrl(fileName);
				
			uploadedUrl = publicUrlData.publicUrl;
		}

		const payload = {
			sku: form.sku.trim().toUpperCase(),
			name: form.name.trim(),
			technical_spec: form.technical_spec,
			unit_of_measure: form.unit_of_measure,
			last_purchase_price: form.last_purchase_price ? parseFloat(form.last_purchase_price) : null,
			image_url: uploadedUrl
		};
		let error;
		if (editingMat) {
			({ error } = await supabase.from('materials').update(payload).eq('sku', editingMat.sku));
		} else {
			({ error } = await supabase.from('materials').insert(payload));
		}

		if (error) {
			toast.error('Error al guardar: ' + error.message);
			saving = false;
			return;
		}

		// Save stock by location
		for (const s of matStock) {
			if (!s.location_id) continue;
			await supabase.from('stock_by_location').upsert({
				material_sku: form.sku.trim().toUpperCase(),
				location_id: s.location_id,
				quantity: Number(s.quantity)
			}, { onConflict: 'material_sku,location_id' });
		}

		toast.success(editingMat ? 'Material actualizado' : 'Material creado');
		saving = false;
		closeModal();
		invalidateAll();
	}

	async function deleteMaterial(sku) {
		if (!confirm(`¿Eliminar el material ${sku}? Esta acción no se puede deshacer.`)) return;
		const { error } = await supabase.from('materials').delete().eq('sku', sku);
		if (error) toast.error('Error: ' + error.message);
		else { toast.success('Material eliminado'); invalidateAll(); }
	}

	// Modal: Ubicaciones
	let showLocModal = false;
	let locForm = { name: '', description: '' };
	let editingLoc = null;

	function openNewLoc() { editingLoc = null; locForm = { name: '', description: '' }; showLocModal = true; }
	function openEditLoc(loc) { editingLoc = loc; locForm = { name: loc.name, description: loc.description ?? '' }; showLocModal = true; }
	function closeLocModal() { showLocModal = false; }

	async function saveLoc() {
		if (!locForm.name) return;
		saving = true;
		const payload = { name: locForm.name.trim(), description: locForm.description };
		let error;
		if (editingLoc) {
			({ error } = await supabase.from('locations').update(payload).eq('id', editingLoc.id));
		} else {
			({ error } = await supabase.from('locations').insert(payload));
		}
		saving = false;
		if (error) toast.error('Error: ' + error.message);
		else { toast.success('Ubicación guardada'); closeLocModal(); invalidateAll(); }
	}

	// Active tab
	let tab = 'materials'; // 'materials' | 'locations' | 'valuation'
	$: isProfesor = data.profile?.role === 'profesor';
</script>

<svelte:head><title>Inventario — Pañol</title></svelte:head>

<div class="page-header">
	<div class="page-header-left">
		<h1 class="page-title">{$_('inventory.title')}</h1>
		<p class="page-subtitle">{$_('inventory.subtitle')}</p>
	</div>
	<div class="page-actions">
		<button id="new-location-btn" class="btn btn-ghost" on:click={openNewLoc}>+ {$_('inventory.newLocation')}</button>
		<button id="new-material-btn" class="btn btn-primary" on:click={openNew}>+ {$_('inventory.newMaterial')}</button>
	</div>
</div>

<!-- Valuation Banner -->
{#if !isProfesor}
<div class="valuation-banner mb-6">
	<div class="vb-label"><i class="ph ph-currency-circle-dollar"></i> {$_('inventory.totalValuation')}</div>
	<div class="vb-value">
		{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalValuation)}
	</div>
	<div class="vb-sub">calculado con PPP (Precio Promedio Ponderado)</div>
</div>
{/if}

<!-- Tabs -->
<div class="tabs mb-6">
	<button class="tab-btn" class:active={tab==='materials'} on:click={() => tab='materials'}><i class="ph ph-package"></i> Materiales ({materials.length})</button>
	<button class="tab-btn" class:active={tab==='locations'} on:click={() => tab='locations'}><i class="ph ph-map-pin"></i> Ubicaciones ({locations.length})</button>
</div>

{#if tab === 'materials'}
	<!-- Search -->
	<div class="toolbar">
		<div class="search-bar" style="max-width:360px">
			<span class="search-icon"><i class="ph ph-magnifying-glass"></i></span>
			<input
				type="search"
				class="form-control"
				placeholder="{$_('common.search')} por nombre o SKU..."
				bind:value={search}
				on:input={onSearch}
			/>
		</div>
	</div>

	<div class="table-wrapper">
		<table>
			<thead>
				<tr>
					<th style="width: 50px"></th>
					<th>{$_('inventory.sku')}</th>
					<th>{$_('inventory.componentName')}</th>
					<th>{$_('inventory.unitOfMeasure')}</th>
					<th>{$_('inventory.location')}</th>
					<th style="text-align:right">{$_('inventory.totalStock')}</th>
					{#if !isProfesor}
						<th style="text-align:right">{$_('inventory.avgCost')}</th>
						<th style="text-align:right">Valorización</th>
					{/if}
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each materials as mat (mat.sku)}
					{@const totalQty = getTotalStock(mat)}
					<tr class="clickable-row" class:selected={selectedMat?.sku === mat.sku} on:click={() => selectMat(mat)}>
						<td>
							{#if mat.image_url}
								<img src={mat.image_url} alt={mat.name} class="mat-thumb" />
							{:else}
								<div class="mat-thumb-placeholder"><i class="ph ph-image"></i></div>
							{/if}
						</td>
						<td><span class="chip">{mat.sku}</span></td>
						<td>
							<div class="font-semibold text-sm">{mat.name}</div>
							{#if mat.technical_spec}
								<div class="text-xs text-muted truncate" style="max-width:220px">{mat.technical_spec}</div>
							{/if}
						</td>
						<td class="td-muted">{mat.unit_of_measure}</td>
						<td class="td-muted text-xs">
							{mat.stock_by_location?.[0]?.locations?.name ?? '—'}
							{#if (mat.stock_by_location?.length ?? 0) > 1}
								<span class="text-primary-light">(+{mat.stock_by_location.length - 1})</span>
							{/if}
						</td>
						<td style="text-align:right">
							<button
								class="stock-total-btn"
								class:has-stock={totalQty > 0}
								on:click|stopPropagation={() => toggleDrilldown(mat.sku)}
							>
								<span class="font-semibold">{fmt(totalQty)}</span>
								<span class="dd-arrow">{drilldownSku === mat.sku ? '▲' : '▼'}</span>
							</button>
						</td>
						{#if !isProfesor}
							<td style="text-align:right" class="number-mono">{fmtMoney(mat.avg_cost)}</td>
							<td style="text-align:right" class="number-mono text-sm">{fmtMoney(totalQty * (mat.avg_cost ?? 0))}</td>
						{/if}
						<td>
							<div class="flex gap-2 justify-end">
								<button class="btn btn-ghost btn-sm btn-icon" on:click|stopPropagation={() => openEdit(mat)} title="Editar"><i class="ph ph-pencil-simple"></i></button>
								<button class="btn btn-ghost btn-sm btn-icon" on:click|stopPropagation={() => deleteMaterial(mat.sku)} title="Eliminar"><i class="ph ph-trash"></i></button>
							</div>
						</td>
					</tr>
					<!-- Drilldown row -->
					{#if drilldownSku === mat.sku}
						<tr class="drilldown-row">
							<td colspan={isProfesor ? 6 : 8}>
								<div class="drilldown-content">
									<div class="drilldown-title"><i class="ph ph-map-pin"></i> Stock por ubicación — {mat.name}</div>
									{#if mat.stock_by_location?.length === 0}
										<p class="text-muted text-sm">Sin stock registrado en ninguna ubicación.</p>
									{:else}
										<div class="loc-chips">
											{#each mat.stock_by_location as sl}
												<div class="loc-chip">
													<span class="loc-name">{sl.locations?.name ?? 'Sin nombre'}</span>
													<span class="loc-qty">{fmt(sl.quantity)} {mat.unit_of_measure}</span>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							</td>
						</tr>
					{/if}
				{:else}
					<tr>
						<td colspan="8">
							<div class="empty-state">
								<div class="empty-icon"><i class="ph ph-package"></i></div>
								<div class="empty-title">Sin materiales</div>
								<div class="empty-desc">Creá el primer material con el botón "Nuevo Material"</div>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

{:else if tab === 'locations'}
	<div class="table-wrapper">
		<table>
			<thead>
				<tr>
					<th>{$_('inventory.locationName')}</th>
					<th>{$_('common.description')}</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each locations as loc}
					<tr>
						<td class="font-semibold">{loc.name}</td>
						<td class="td-muted">{loc.description ?? '—'}</td>
						<td>
							<div class="flex gap-2 justify-end">
								<button class="btn btn-ghost btn-sm btn-icon" on:click={() => openEditLoc(loc)}><i class="ph ph-pencil-simple"></i></button>
							</div>
						</td>
					</tr>
				{:else}
					<tr><td colspan="3"><div class="empty-state" style="padding:2rem"><div class="empty-icon"><i class="ph ph-map-pin"></i></div><div class="empty-title">Sin ubicaciones</div></div></td></tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<!-- Modal: Material -->
{#if showModal}
	<div class="modal-backdrop" on:click|self={closeModal}>
		<div class="modal">
			<div class="modal-header">
				<span class="modal-title">{editingMat ? 'Editar Material' : $_('inventory.newMaterial')}</span>
				<button class="btn btn-ghost btn-sm btn-icon" on:click={closeModal}>✕</button>
			</div>
			<div class="modal-body">
				<div class="form-grid-2">
					<div class="form-group">
						<label class="form-label" for="mat-sku">{$_('inventory.sku')} *</label>
						<input id="mat-sku" class="form-control" bind:value={form.sku} placeholder="RES-10K" disabled={!!editingMat} />
					</div>
					<div class="form-group">
						<label class="form-label" for="mat-unit">{$_('inventory.unitOfMeasure')}</label>
						<select id="mat-unit" class="form-control" bind:value={form.unit_of_measure}>
							{#each units as u}<option value={u}>{u}</option>{/each}
						</select>
					</div>
				</div>
				<div class="form-group mt-4">
					<label class="form-label" for="mat-name">{$_('inventory.componentName')} *</label>
					<input id="mat-name" class="form-control" bind:value={form.name} placeholder="Resistencia 10kΩ 1/4W" />
				</div>
				<div class="form-group mt-4">
					<label class="form-label" for="mat-spec">{$_('inventory.technicalSpec')}</label>
					<textarea id="mat-spec" class="form-control" bind:value={form.technical_spec} placeholder="Tolerancia: ±5%, Potencia: 0.25W..."></textarea>
				</div>
				<div class="form-group mt-4">
					<label class="form-label" for="mat-price">{$_('inventory.lastPurchasePrice')}</label>
					<input id="mat-price" type="number" step="0.01" min="0" class="form-control" bind:value={form.last_purchase_price} placeholder="0.00" />
				</div>
				<div class="form-group mt-4">
					<label class="form-label">Foto del Producto (opcional)</label>
					<div class="flex items-center gap-4">
						{#if form.image_url && !imageFile}
							<img src={form.image_url} alt="Actual" class="mat-thumb-preview" />
						{/if}
						<input type="file" accept="image/*" class="form-control" on:change={(e) => imageFile = e.target.files[0]} />
					</div>
				</div>

				<div class="divider"></div>
				<div class="flex items-center justify-between mb-2">
					<div class="sp-section-title">Ubicación y Stock Inicial</div>
					<button class="btn btn-ghost btn-sm" on:click={() => matStock = [...matStock, { location_id: '', quantity: 0 }]}>+ Agregar Ubicación</button>
				</div>
				{#each matStock as s, i}
					<div class="flex gap-2 mb-2 items-end">
						<div class="form-group flex-1">
							<select class="form-control" bind:value={s.location_id}>
								<option value="">Seleccionar ubicación...</option>
								{#each locations as loc}<option value={loc.id}>{loc.name}</option>{/each}
							</select>
						</div>
						<div class="form-group" style="width: 100px">
							<input type="number" step="0.001" class="form-control" bind:value={s.quantity} placeholder="Cant." />
						</div>
						{#if matStock.length > 1}
							<button class="btn btn-ghost btn-sm btn-icon mb-1" on:click={() => matStock = matStock.filter((_, idx) => idx !== i)}>✕</button>
						{/if}
					</div>
				{/each}
			</div>
			<div class="modal-footer">
				<button class="btn btn-ghost" on:click={closeModal}>{$_('common.cancel')}</button>
				<button class="btn btn-primary" on:click={saveMaterial} disabled={saving || !form.sku || !form.name}>
					{saving ? $_('common.loading') : $_('common.save')}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal: Ubicación -->
{#if showLocModal}
	<div class="modal-backdrop" on:click|self={closeLocModal}>
		<div class="modal">
			<div class="modal-header">
				<span class="modal-title">{editingLoc ? 'Editar Ubicación' : $_('inventory.newLocation')}</span>
				<button class="btn btn-ghost btn-sm btn-icon" on:click={closeLocModal}>✕</button>
			</div>
			<div class="modal-body">
				<div class="form-group">
					<label class="form-label" for="loc-name">{$_('inventory.locationName')} *</label>
					<input id="loc-name" class="form-control" bind:value={locForm.name} placeholder="Estante A1" />
				</div>
				<div class="form-group mt-4">
					<label class="form-label" for="loc-desc">{$_('common.description')}</label>
					<input id="loc-desc" class="form-control" bind:value={locForm.description} placeholder="Sector resistencias..." />
				</div>
			</div>
			<div class="modal-footer">
				<button class="btn btn-ghost" on:click={closeLocModal}>{$_('common.cancel')}</button>
				<button class="btn btn-primary" on:click={saveLoc} disabled={saving || !locForm.name}>
					{saving ? $_('common.loading') : $_('common.save')}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.valuation-banner {
		background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05));
		border: 1px solid rgba(99,102,241,0.3);
		border-radius: var(--radius-lg);
		padding: var(--space-5) var(--space-6);
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}
	.vb-label { font-size: 0.8rem; font-weight: 600; color: var(--primary-light); text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
	.vb-value { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; }
	.vb-sub { font-size: 0.78rem; color: var(--text-muted); }

	.stock-total-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.875rem;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		transition: background var(--transition);
	}
	.stock-total-btn:hover { background: var(--bg-card-hover); }
	.stock-total-btn.has-stock .font-semibold { color: var(--secondary); }
	.dd-arrow { font-size: 0.6rem; color: var(--text-muted); }

	.drilldown-row td { padding: 0; }
	.drilldown-content {
		background: var(--bg-surface);
		padding: var(--space-4) var(--space-6);
		border-bottom: 1px solid var(--border);
	}
	.drilldown-title { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: var(--space-3); }
	.loc-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
	.loc-chip {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 6px 12px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 0.82rem;
	}
	.loc-name { color: var(--text-secondary); font-weight: 500; }
	.loc-qty { color: var(--secondary); font-weight: 700; font-variant-numeric: tabular-nums; }

	.mat-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg-surface); }
	.mat-thumb-placeholder { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: var(--bg-surface); border: 1px dashed var(--border); border-radius: var(--radius); font-size: 1.2rem; color: var(--text-muted); }
	.mat-thumb-preview { width: 60px; height: 60px; object-fit: cover; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg-surface); flex-shrink: 0; }

	.clickable-row { cursor: pointer; transition: background var(--transition); }
	.clickable-row:hover { background: var(--bg-card-hover); }
	.clickable-row.selected { background: rgba(99,102,241,0.08); }

	/* Side Panel */
	.side-panel-backdrop {
		position: fixed;
		top: 0; right: 0; bottom: 0; left: 0;
		background: rgba(0,0,0,0.2);
		z-index: 100;
		display: flex; justify-content: flex-end;
	}
	.side-panel {
		width: 400px;
		background: var(--bg-card);
		height: 100%;
		box-shadow: var(--shadow-xl);
		display: flex; flex-direction: column;
		border-left: 1px solid var(--border);
		animation: slideIn 0.3s ease-out;
	}
	@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

	.sp-header { padding: var(--space-5); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
	.sp-title { font-weight: 700; font-size: 1.1rem; color: var(--text-primary); }
	.sp-body { padding: var(--space-6); overflow-y: auto; flex: 1; }
	.sp-image { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--radius-lg); border: 1px solid var(--border); margin-bottom: var(--space-6); }
	.sp-image-placeholder { width: 100%; aspect-ratio: 1; background: var(--bg-surface); border: 1px dashed var(--border); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; font-size: 3rem; color: var(--text-muted); margin-bottom: var(--space-6); }
	.sp-section { margin-bottom: var(--space-6); }
	.sp-section-title { font-size: 0.75rem; font-weight: 600; color: var(--primary-light); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-3); }
	.sp-spec { font-size: 0.9rem; line-height: 1.6; color: var(--text-secondary); white-space: pre-wrap; }
</style>

{#if selectedMat}
	<div class="side-panel-backdrop" on:click|self={closeSelected}>
		<div class="side-panel">
			<div class="sp-header">
				<span class="sp-title">Información del Componente</span>
				<button class="btn btn-ghost btn-sm btn-icon" on:click={closeSelected}>✕</button>
			</div>
			<div class="sp-body">
				{#if selectedMat.image_url}
					<img src={selectedMat.image_url} alt={selectedMat.name} class="sp-image" />
				{:else}
					<div class="sp-image-placeholder"><i class="ph ph-image"></i></div>
				{/if}
				
				<div class="sp-section">
					<div class="sp-section-title">General</div>
					<h2 style="font-size:1.25rem; font-weight:800; margin-bottom:4px">{selectedMat.name}</h2>
					<span class="chip">{selectedMat.sku}</span>
				</div>

				{#if selectedMat.technical_spec}
					<div class="sp-section">
						<div class="sp-section-title">Especificaciones Técnicas</div>
						<div class="sp-spec">{selectedMat.technical_spec}</div>
					</div>
				{/if}

				<div class="sp-section">
					<div class="sp-section-title">Stock por Ubicación</div>
					<div class="loc-chips">
						{#each selectedMat.stock_by_location || [] as sl}
							<div class="loc-chip">
								<span class="loc-name">{sl.locations?.name}</span>
								<span class="loc-qty">{fmt(sl.quantity)} {selectedMat.unit_of_measure}</span>
							</div>
						{:else}
							<p class="text-muted text-sm">Sin stock disponible.</p>
						{/each}
					</div>
				</div>

				{#if !isProfesor}
					<div class="sp-section">
						<div class="sp-section-title">Valorización</div>
						<div class="info-list">
							<div class="info-row"><span>Costo Promedio (PPP)</span><span class="number-mono font-bold">{fmtMoney(selectedMat.avg_cost)}</span></div>
							<div class="info-row"><span>Valor en Stock</span><span class="number-mono font-bold text-success">{fmtMoney(getTotalStock(selectedMat) * (selectedMat.avg_cost || 0))}</span></div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
