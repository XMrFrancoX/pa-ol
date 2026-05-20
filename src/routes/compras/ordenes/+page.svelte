<script>
	import { _ } from 'svelte-i18n';
	import { supabase } from '$lib/supabase.js';
	import { toast } from '$lib/stores/toast.js';
	import { invalidateAll, goto } from '$app/navigation';

	export let data;
	$: ({ orders, suppliers, courses, workshops, locations, materials, workshop_courses } = data);

	const fmtMoney = (n) => n != null ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n) : '—';
	const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '—';

	const statusBadge = { draft: 'badge-neutral', sent: 'badge-warning', received: 'badge-success', cancelled: 'badge-danger' };
	const statusLabel = { draft: 'Borrador', sent: 'Enviada', received: 'Recibida', cancelled: 'Cancelada' };

	// New OC modal
	let showModal = false;
	let saving = false;
	let loading = false;
	let ocForm = { supplier_id: '', notes: '' };
	let ocItems = [{ material_sku: '', material_name: '', requested_qty: 1, course_id: '', workshop_id: '', destination_location_id: '' }];

	async function openNew() {
		ocForm = { supplier_id: '', notes: '' };
		ocItems = [{ material_sku: '', material_name: '', requested_qty: 1, unit_price: 0, course_id: '', workshop_id: '', destination_location_id: '' }];
		showModal = true;
	}
	function closeModal() { showModal = false; }

	function addItem() { ocItems = [...ocItems, { material_sku: '', material_name: '', requested_qty: 1, unit_price: 0, course_id: '', workshop_id: '', destination_location_id: '' }]; }
	function removeItem(i) { ocItems = ocItems.filter((_, idx) => idx !== i); }

	function onSkuChange(i) {
		const mat = materials.find(m => m.sku === ocItems[i].material_sku);
		if (mat) {
			ocItems[i].material_name = mat.name;
			ocItems = [...ocItems];
		}
	}

	function onWorkshopChange(i) {
		const workshopId = ocItems[i].workshop_id;
		if (!workshopId) return;
		const association = workshop_courses.find(wc => wc.workshop_id === workshopId);
		if (association) {
			ocItems[i].course_id = association.course_id;
			ocItems = [...ocItems];
		}
	}

	// Similarity helper (Levenshtein based)
	function getSimilarity(s1, s2) {
		let longer = s1, shorter = s2;
		if (s1.length < s2.length) { longer = s2; shorter = s1; }
		let longerLength = longer.length;
		if (longerLength === 0) return 1.0;
		return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
	}
	function editDistance(s1, s2) {
		s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
		const m = s1.length, n = s2.length;
		const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
		for (let i = 0; i <= m; i++) dp[i][0] = i;
		for (let j = 0; j <= n; j++) dp[0][j] = j;
		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
				else dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
			}
		}
		return dp[m][n];
	}

	// Import functionality
	let fileInput;
	async function handleImport(e) {
		const file = e.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (ev) => {
			const data = ev.target.result;
			let rows = [];
			
			if (file.name.endsWith('.csv')) {
				if (window.Papa) {
					const results = window.Papa.parse(data, { header: true, skipEmptyLines: true });
					rows = results.data;
				} else {
					const lines = data.split('\n');
					const headers = lines[0].split(',').map(h => h.trim());
					rows = lines.slice(1).map(line => {
						const values = line.split(',').map(v => v.trim());
						return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] }), {});
					});
				}
			} else {
				if (window.XLSX) {
					const workbook = window.XLSX.read(data, { type: 'binary' });
					const sheetName = workbook.SheetNames[0];
					rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
				} else {
					toast.error('Librería de Excel no cargada. Por favor, usa CSV o espera a que cargue.');
					return;
				}
			}

			if (rows.length === 0) { toast.error('Archivo vacío'); return; }

			loading = true;
			try {
				// 1. Handle Supplier (First row)
				const sName = rows[0].Proveedor || rows[0].proveedor || rows[0].Supplier;
				let foundSupplierId = '';
				if (sName) {
					let supplier = suppliers.find(s => s.razon_social.toLowerCase().includes(sName.toLowerCase()));
					if (!supplier) {
						// Auto-create supplier
						const { data: newS, error: sErr } = await supabase.from('suppliers').insert({ razon_social: sName }).select().single();
						if (!sErr) {
							supplier = newS;
							toast.info(`Proveedor creado: ${sName}`);
						}
					}
					if (supplier) foundSupplierId = supplier.id;
				}

				// 2. Handle Materials and Map items
				const mappedItems = [];
				for (const row of rows) {
					const itemName = row.Item || row.item || row.Material || '';
					if (!itemName) continue;

					// Try match: Exact -> Fuzzy -> Create
					let mat = materials.find(m => m.sku === itemName || m.name.toLowerCase() === itemName.toLowerCase());
					
					if (!mat) {
						// Try Fuzzy Match (Similarity > 0.85 as 95% might be too strict for human typos)
						let bestMatch = null;
						let maxSim = 0;
						for (const m of materials) {
							const sim = getSimilarity(itemName, m.name);
							if (sim > maxSim) { maxSim = sim; bestMatch = m; }
						}
						if (maxSim > 0.85) mat = bestMatch;
					}

					if (!mat) {
						// Auto-create material
						const sku = itemName.toUpperCase().replace(/[^A-Z0-9]/g, '-').substring(0, 20) + '-' + Math.floor(Math.random()*1000);
						const { data: newM, error: mErr } = await supabase.from('materials').insert({ 
							sku, 
							name: itemName,
							unit_of_measure: 'unidades'
						}).select().single();
						
						if (!mErr) {
							mat = newM;
							materials = [...materials, newM]; // Add to local list for next iterations
							toast.info(`Material creado: ${itemName}`);
						}
					}

					if (mat) {
						mappedItems.push({
							material_sku: mat.sku,
							material_name: mat.name,
							requested_qty: Number(row.Cantidad || row.cantidad || row.Quantity || 1),
							unit_price: Number(row['Mejor Precio Unitario'] || row['Precio Unitario'] || row.Price || 0),
							course_id: '',
							workshop_id: '',
							destination_location_id: ''
						});
					}
				}

				if (mappedItems.length === 0) {
					toast.error('No se encontraron ítems válidos en el archivo.');
					return;
				}

				// Open modal and populate
				ocForm = { supplier_id: foundSupplierId, notes: 'Importado desde archivo' };
				ocItems = mappedItems;
				showModal = true;
				toast.success('Datos cargados y entidades creadas si era necesario.');
				invalidateAll();
			} catch (err) {
				toast.error('Error al procesar: ' + err.message);
			} finally {
				loading = false;
			}
		};

		if (file.name.endsWith('.csv')) reader.readAsText(file);
		else reader.readAsBinaryString(file);
	}

	function downloadTemplate() {
		const headers = ['Item', 'Cantidad', 'Proveedor', 'Mejor Precio Unitario'];
		const sampleData = [['CABLE 1.5MM', '100', 'ELECTRICIDAD SA', '150.50']];
		
		if (window.XLSX) {
			const ws = window.XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
			const wb = window.XLSX.utils.book_new();
			window.XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
			window.XLSX.writeFile(wb, "plantilla_importacion.xlsx");
		} else {
			const csvContent = "data:text/csv;charset=utf-8," 
				+ headers.join(",") + "\n"
				+ sampleData[0].join(",");
			const encodedUri = encodeURI(csvContent);
			const link = document.createElement("a");
			link.setAttribute("href", encodedUri);
			link.setAttribute("download", "plantilla_importacion.csv");
			document.body.appendChild(link);
			link.click();
		}
	}

	// Consolidated view
	$: consolidated = (() => {
		const map = {};
		for (const item of ocItems) {
			if (!item.material_sku) continue;
			if (!map[item.material_sku]) map[item.material_sku] = { sku: item.material_sku, name: item.material_name, total: 0, destinationNames: [] };
			map[item.material_sku].total += Number(item.requested_qty) || 0;
			const dest = item.destination_location_id 
				? locations.find(l => l.id === item.destination_location_id)?.name 
				: (item.workshop_id ? workshops.find(w => w.id === item.workshop_id)?.name : courses.find(c => c.id === item.course_id)?.name);
			if (dest) map[item.material_sku].destinationNames.push(dest);
		}
		return Object.values(map);
	})();

	let showConsolidated = false;
	let showConfirm = false;

	async function saveOC() {
		if (!ocForm.supplier_id || ocItems.some(i => !i.material_sku)) return;
		if (!showConfirm) { showConfirm = true; return; }
		saving = true;

		const itemsToInsert = ocItems.map(i => ({
			material_sku: i.material_sku,
			requested_qty: Number(i.requested_qty),
			unit_price: i.unit_price || null,
			subtotal: (Number(i.requested_qty) * Number(i.unit_price || 0)) || null,
			course_id: i.course_id || null,
			workshop_id: i.workshop_id || null,
			destination_location_id: i.destination_location_id || null
		}));

		const totalValue = itemsToInsert.reduce((sum, i) => sum + (i.subtotal || 0), 0);

		const { data: oc, error: ocErr } = await supabase
			.from('purchase_orders')
			.insert({ 
				supplier_id: ocForm.supplier_id, 
				status: 'draft', 
				notes: ocForm.notes,
				total_value: totalValue 
			})
			.select()
			.single();

		if (ocErr) { toast.error('Error: ' + ocErr.message); saving = false; return; }

		const finalItems = itemsToInsert.map(i => ({ ...i, po_id: oc.id }));
		const { error: itemErr } = await supabase.from('purchase_order_items').insert(finalItems);
		
		saving = false;
		if (itemErr) toast.error('Error en ítems: ' + itemErr.message);
		else { toast.success('OC creada'); closeModal(); goto('/compras/ordenes/' + oc.id); }
	}

	async function deleteOrder(id) {
		if (!confirm(`¿Eliminar la orden OC-${String(id).padStart(5,'0')}? Esta acción no se puede deshacer.`)) return;
		const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
		if (error) toast.error('No se puede eliminar: puede que tenga ítems o recepciones asociadas.');
		else { toast.success('Orden eliminada'); invalidateAll(); }
	}
</script>

<svelte:head>
	<title>Órdenes de Compra — Pañol</title>
	<script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
</svelte:head>

<div class="page-header">
	<div class="page-header-left">
		<h1 class="page-title">{$_('purchases.title')}</h1>
		<p class="page-subtitle">{$_('purchases.subtitle')}</p>
	</div>
	<div class="page-actions">
		<input type="file" bind:this={fileInput} on:change={handleImport} accept=".csv, .xlsx, .xls" style="display:none" />
		<button class="btn btn-ghost" on:click={downloadTemplate} title="Descargar plantilla de importación"><i class="ph ph-download"></i> Plantilla</button>
		<button class="btn btn-ghost" on:click={() => fileInput.click()}><i class="ph ph-file-arrow-up"></i> Importar</button>
		<a href="/compras/proveedores" class="btn btn-ghost"><i class="ph ph-buildings"></i> Proveedores</a>
		<button id="new-order-btn" class="btn btn-primary" on:click={openNew}>+ {$_('purchases.newOrder')}</button>
	</div>
</div>

<div class="table-wrapper">
	<table>
		<thead>
			<tr>
				<th>{$_('purchases.orderNumber')}</th>
				<th>{$_('purchases.supplier')}</th>
				<th>{$_('common.status')}</th>
				<th>{$_('common.date')}</th>
				<th style="text-align:right">{$_('purchases.orderTotal')}</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each orders as o}
				<tr>
					<td><span class="chip number-mono">OC-{String(o.id).padStart(5,'0')}</span></td>
					<td class="font-semibold">{o.suppliers?.razon_social ?? '—'}</td>
					<td><span class="badge {statusBadge[o.status] ?? 'badge-neutral'}">{statusLabel[o.status] ?? o.status}</span></td>
					<td class="td-muted">{fmtDate(o.created_at)}</td>
					<td class="text-right number-mono">
						{fmtMoney(o.total_value ?? o.purchase_order_items?.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0))}
					</td>
					<td>
						<div class="flex gap-2 justify-end">
							{#if o.status === 'sent'}
								<button class="btn btn-outline btn-sm" on:click={() => goto('/compras/ordenes/' + o.id + '?receive=true')}>Recibir</button>
							{/if}
								{#if o.status === 'draft' || o.status === 'sent'}
									<button class="btn btn-ghost btn-sm btn-icon text-danger" on:click={() => deleteOrder(o.id)}><i class="ph ph-trash"></i></button>
								{/if}
								<a href="/compras/ordenes/{o.id}" class="btn btn-ghost btn-sm">Ver →</a>
						</div>
					</td>
				</tr>
			{:else}
				<tr><td colspan="6">
					<div class="empty-state">
						<div class="empty-icon"><i class="ph ph-shopping-cart"></i></div>
						<div class="empty-title">Sin órdenes de compra</div>
						<div class="empty-desc">Creá la primera OC para comenzar a gestionar las compras.</div>
					</div>
				</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- Modal: Nueva OC -->
{#if showModal}
<div class="modal-backdrop" on:click|self={closeModal}>
	<div class="modal modal-xl">
		<div class="modal-header">
			<span class="modal-title">Nueva Orden de Compra</span>
			<button class="btn btn-ghost btn-sm btn-icon" on:click={closeModal}>✕</button>
		</div>
		<div class="modal-body">
			<div class="form-grid-2">
				<div class="form-group">
					<label class="form-label" for="oc-supplier">Proveedor *</label>
					<select id="oc-supplier" class="form-control" bind:value={ocForm.supplier_id}>
						<option value="">Seleccioná un proveedor...</option>
						{#each suppliers as s}<option value={s.id}>{s.razon_social}</option>{/each}
					</select>
				</div>
				<div class="form-group">
					<label class="form-label" for="oc-notes">Observaciones</label>
					<input id="oc-notes" class="form-control" bind:value={ocForm.notes} placeholder="Notas opcionales..." />
				</div>
			</div>

			<div class="divider"></div>

			<div class="flex items-center justify-between mb-4">
				<h4>Ítems de la Orden</h4>
				<div class="flex gap-2">
					<button class="btn btn-ghost btn-sm" on:click={() => showConsolidated = !showConsolidated}>
						{showConsolidated ? 'Ver ítems' : 'Listado'}
					</button>
					<button class="btn btn-outline btn-sm" on:click={addItem}>+ Agregar ítem</button>
				</div>
			</div>

			{#if showConsolidated}
				<div class="consolidated-view">
					<div class="cv-title"><i class="ph ph-chart-bar"></i> Consolidado por Proveedor</div>
					{#each consolidated as row}
						<div class="cv-row">
							<span class="chip">{row.sku}</span>
							<span class="cv-name">{row.name}</span>
							<span class="cv-total">{row.total} uds. total</span>
							{#if row.destinationNames.length > 0}
								<span class="cv-dests">({row.destinationNames.join(', ')})</span>
							{/if}
						</div>
					{:else}
						<p class="text-muted text-sm">Agregá ítems para ver el consolidado.</p>
					{/each}
				</div>
			{:else}
				<div class="items-list">
					{#each ocItems as item, i}
						<div class="oc-item-row">
							<div class="form-group" style="flex:2">
								<label class="form-label">Material *</label>
								<select class="form-control" bind:value={item.material_sku} on:change={() => onSkuChange(i)}>
									<option value="">Seleccionar...</option>
									{#each materials as m}<option value={m.sku}>{m.name} ({m.sku})</option>{/each}
								</select>
							</div>
							<div class="form-group" style="flex:1">
								<label class="form-label">Cantidad *</label>
								<input type="number" min="1" class="form-control" bind:value={item.requested_qty} />
							</div>
							<div class="form-group" style="flex:1">
								<label class="form-label">Taller</label>
								<select class="form-control" bind:value={item.workshop_id} on:change={() => onWorkshopChange(i)}>
									<option value="">Sin taller</option>
									{#each workshops as w}<option value={w.id}>{w.name}</option>{/each}
								</select>
							</div>
							<div class="form-group" style="flex:1">
								<label class="form-label">Curso</label>
								<select class="form-control" bind:value={item.course_id}>
									<option value="">Sin curso</option>
									{#each courses as c}<option value={c.id}>{c.name}</option>{/each}
								</select>
							</div>
							<div class="form-group" style="flex:0.8">
								<label class="form-label">Precio</label>
								<input type="number" step="0.01" class="form-control" bind:value={item.unit_price} />
							</div>
							<div class="form-group" style="flex:1">
								<label class="form-label">Destino</label>
								<select class="form-control" bind:value={item.destination_location_id}>
									<option value="">Seleccionar...</option>
									{#each locations as loc}<option value={loc.id}>{loc.name}</option>{/each}
								</select>
							</div>
							{#if ocItems.length > 1}
								<button class="btn btn-ghost btn-sm btn-icon" style="margin-top:1.6rem" on:click={() => removeItem(i)}>✕</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
			
			{#if showConfirm}
				<div class="confirmation-overlay">
					<div class="confirmation-card">
						<h4>Confirmar Orden de Compra</h4>
						<p>¿Estás seguro que deseas crear esta orden de compra para <strong>{suppliers.find(s => s.id === ocForm.supplier_id)?.razon_social}</strong>?</p>
						<div class="flex gap-3 justify-end mt-4">
							<button class="btn btn-ghost" on:click={() => showConfirm = false}>Revisar</button>
							<button class="btn btn-primary" on:click={saveOC}>Confirmar y Crear</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
		<div class="modal-footer">
			<button class="btn btn-ghost" on:click={closeModal}>{$_('common.cancel')}</button>
			<button class="btn btn-primary" on:click={saveOC} disabled={saving || !ocForm.supplier_id}>
				{saving ? 'Creando...' : 'Crear OC'}
			</button>
		</div>
	</div>
</div>
{/if}

<style>
	.oc-item-row {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--border);
	}
	.oc-item-row:last-child { border-bottom: none; }

	@media (max-width: 768px) {
		.oc-item-row {
			flex-direction: column;
			gap: var(--space-3);
			padding: var(--space-4);
			background: var(--bg-surface);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			margin-bottom: var(--space-3);
		}
		.oc-item-row > .form-group {
			width: 100% !important;
			flex: none !important;
		}
		.oc-item-row button {
			align-self: flex-end;
			margin-top: var(--space-2) !important;
			width: 100%;
			justify-content: center;
		}
	}

	.consolidated-view {
		background: var(--bg-surface);
		border-radius: var(--radius);
		padding: var(--space-4);
		border: 1px solid var(--border);
	}
	.cv-title { font-size: 0.8rem; font-weight: 600; color: var(--primary-light); margin-bottom: var(--space-3); text-transform: uppercase; letter-spacing: 0.06em; }
	.cv-row { display: flex; align-items: center; gap: var(--space-3); padding: 6px 0; border-bottom: 1px solid var(--border); }
	.cv-row:last-child { border-bottom: none; }
	.cv-name { flex: 1; font-size: 0.875rem; color: var(--text-primary); }
	.cv-total { font-weight: 700; color: var(--secondary); font-size: 0.875rem; }
	.cv-dests { font-size: 0.78rem; color: var(--text-muted); }

	.confirmation-overlay {
		position: absolute;
		top: 0; left: 0; right: 0; bottom: 0;
		background: rgba(0,0,0,0.4);
		backdrop-filter: blur(2px);
		display: flex; align-items: center; justify-content: center;
		z-index: 100;
		border-radius: var(--radius-lg);
	}
	.confirmation-card {
		background: var(--bg-card);
		padding: var(--space-6);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		max-width: 400px;
		width: 90%;
		border: 1px solid var(--border);
	}
</style>
