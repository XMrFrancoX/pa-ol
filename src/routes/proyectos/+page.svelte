<script>
	import { _ } from 'svelte-i18n';
	import { supabase } from '$lib/supabase.js';
	import { toast } from '$lib/stores/toast.js';
	import { invalidateAll, goto } from '$app/navigation';

	export let data;
	$: ({ projects, workshops, courses, locations } = data);

	const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '—';
	const statusBadge = { active: 'badge-success', archived: 'badge-neutral', draft: 'badge-warning' };
	const statusLabel = { active: 'Activo', archived: 'Archivado', draft: 'Borrador' };

	let showModal = false;
	let saving = false;
	let form = { name: '', description: '', workshop_id: '', course_id: '', destination_location_id: '' };
	let bomItems = [{ material_sku: '', material_name: '', quantity_needed: 1 }];
	let materials = [];
	let editingProject = null;

	async function openNew() {
		const { data: mats } = await supabase.from('materials').select('sku, name, unit_of_measure').order('name');
		materials = mats ?? [];
		editingProject = null;
		form = { name: '', description: '', workshop_id: '', course_id: '', destination_location_id: '' };
		bomItems = [{ material_sku: '', material_name: '', quantity_needed: 1 }];
		showModal = true;
	}
	function closeModal() { showModal = false; }

	function addBomItem() { bomItems = [...bomItems, { material_sku: '', material_name: '', quantity_needed: 1 }]; }
	function removeBomItem(i) { bomItems = bomItems.filter((_, idx) => idx !== i); }
	function onBomSkuChange(i) {
		const mat = materials.find(m => m.sku === bomItems[i].material_sku);
		if (mat) { bomItems[i].material_name = mat.name; bomItems = [...bomItems]; }
	}

	async function saveProject() {
		if (!form.name || bomItems.some(b => !b.material_sku)) return;
		saving = true;
		const { data: proj, error: pErr } = await supabase
			.from('projects')
			.insert({ 
				name: form.name, 
				description: form.description, 
				workshop_id: form.workshop_id || null,
				course_id: form.course_id || null,
				destination_location_id: form.destination_location_id || null
			})
			.select()
			.single();
		if (pErr) { toast.error('Error: ' + pErr.message); saving = false; return; }

		const boms = bomItems.map(b => ({
			project_id: proj.id,
			material_sku: b.material_sku,
			quantity_needed: Number(b.quantity_needed)
		}));
		const { error: bErr } = await supabase.from('project_bom').insert(boms);
		saving = false;
		if (bErr) toast.error('Error en BOM: ' + bErr.message);
		else { toast.success('Proyecto creado'); closeModal(); goto('/proyectos/' + proj.id); }
	}
	async function deleteProject(id) {
		if (!confirm('¿Eliminar este proyecto? Se borrarán también sus registros de materiales (BOM).')) return;
		const { error } = await supabase.from('projects').delete().eq('id', id);
		if (error) toast.error(error.message);
		else { toast.success('Proyecto eliminado'); invalidateAll(); }
	}
</script>

<svelte:head><title>Proyectos — Pañol</title></svelte:head>

<div class="page-header">
	<div class="page-header-left">
		<h1 class="page-title">{$_('projects.title')}</h1>
		<p class="page-subtitle">{$_('projects.subtitle')}</p>
	</div>
	<div class="page-actions">
		<button id="new-project-btn" class="btn btn-primary" on:click={openNew}>+ {$_('projects.newProject')}</button>
	</div>
</div>

<div class="projects-grid">
	{#each projects as p}
		<a href="/proyectos/{p.id}" class="project-card">
			<div class="pc-header">
				<span class="badge {statusBadge[p.status] ?? 'badge-neutral'}">{statusLabel[p.status] ?? p.status}</span>
				<span class="pc-date">{fmtDate(p.created_at)}</span>
			</div>
			<h3 class="pc-name">{p.name}</h3>
			{#if p.courses || p.workshops || p.locations}
				<div class="pc-meta">
					{#if p.workshops}<span class="pc-tag"><i class="ph ph-factory"></i> {p.workshops.name}</span>{/if}
					{#if p.courses}<span class="pc-tag"><i class="ph ph-graduation-cap"></i> {p.courses.name}</span>{/if}
					{#if p.locations}<span class="pc-tag"><i class="ph ph-map-pin"></i> {p.locations.name}</span>{/if}
				</div>
			{/if}
			{#if p.description}
				<p class="pc-desc">{p.description}</p>
			{/if}
			<div class="pc-footer">
				<span class="chip"><i class="ph ph-gear"></i> {p.project_bom?.[0]?.count ?? 0} componentes</span>
				<span class="pc-arrow">→</span>
			</div>
		</a>
	{:else}
		<div class="empty-state" style="grid-column:1/-1">
			<div class="empty-icon"><i class="ph ph-gear"></i></div>
			<div class="empty-title">Sin proyectos</div>
			<div class="empty-desc">Creá el primer proyecto con su lista de materiales (BOM).</div>
			<button class="btn btn-primary" on:click={openNew}>+ Nuevo Proyecto</button>
		</div>
	{/each}
</div>

<!-- Modal: Nuevo Proyecto -->
{#if showModal}
<div class="modal-backdrop" on:click|self={closeModal}>
	<div class="modal modal-xl">
		<div class="modal-header">
			<span class="modal-title">Nuevo Proyecto</span>
			<button class="btn btn-ghost btn-sm btn-icon" on:click={closeModal}>✕</button>
		</div>
		<div class="modal-body">
			<div class="form-grid-2">
				<div class="form-group" style="grid-column:1/-1">
					<label class="form-label" for="p-name">Nombre del Proyecto *</label>
					<input id="p-name" class="form-control" bind:value={form.name} placeholder="Kit Electrónica Básica 3°A" />
				</div>
				<div class="form-group" style="grid-column:1/-1">
					<label class="form-label" for="p-desc">Descripción</label>
					<textarea id="p-desc" class="form-control" bind:value={form.description} placeholder="Descripción del proyecto..."></textarea>
				</div>
				<div class="form-group">
					<label class="form-label" for="p-workshop">Taller</label>
					<select id="p-workshop" class="form-control" bind:value={form.workshop_id}>
						<option value="">Sin taller</option>
						{#each workshops as w}<option value={w.id}>{w.name}</option>{/each}
					</select>
				</div>
				<div class="form-group">
					<label class="form-label" for="p-course">Curso</label>
					<select id="p-course" class="form-control" bind:value={form.course_id}>
						<option value="">Sin curso</option>
						{#each courses as c}<option value={c.id}>{c.name}</option>{/each}
					</select>
				</div>
				<div class="form-group">
					<label class="form-label" for="p-dest">Destino (Ubicación)</label>
					<select id="p-dest" class="form-control" bind:value={form.destination_location_id}>
						<option value="">Seleccionar...</option>
						{#each locations as loc}<option value={loc.id}>{loc.name}</option>{/each}
					</select>
				</div>
			</div>

			<div class="divider"></div>
			<div class="flex items-center justify-between mb-4">
				<h4>Lista de Materiales (BOM)</h4>
				<button class="btn btn-outline btn-sm" on:click={addBomItem}>+ Agregar componente</button>
			</div>

			{#each bomItems as bom, i}
				<div class="bom-row">
					<div class="form-group" style="flex:2">
						<label class="form-label">Componente *</label>
						<select class="form-control" bind:value={bom.material_sku} on:change={() => onBomSkuChange(i)}>
							<option value="">Seleccionar...</option>
							{#each materials as m}<option value={m.sku}>{m.name} ({m.sku})</option>{/each}
						</select>
					</div>
					<div class="form-group" style="flex:1">
						<label class="form-label">Cant. Necesaria *</label>
						<input type="number" min="1" class="form-control" bind:value={bom.quantity_needed} />
					</div>
					{#if bomItems.length > 1}
						<button class="btn btn-ghost btn-sm btn-icon" style="margin-top:1.6rem" on:click={() => removeBomItem(i)}>✕</button>
					{/if}
				</div>
			{/each}
		</div>
		<div class="modal-footer">
			<button class="btn btn-ghost" on:click={closeModal}>{$_('common.cancel')}</button>
			<button class="btn btn-primary" on:click={saveProject} disabled={saving || !form.name}>
				{saving ? 'Creando...' : 'Crear Proyecto'}
			</button>
		</div>
	</div>
</div>
{/if}

<style>
	.projects-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--space-5);
	}
	.project-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--space-5);
		text-decoration: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		transition: all var(--transition);
	}
	.project-card:hover {
		border-color: var(--primary);
		box-shadow: var(--shadow-glow);
		transform: translateY(-2px);
	}
	.pc-header { display: flex; justify-content: space-between; align-items: center; }
	.pc-date { font-size: 0.75rem; color: var(--text-muted); }
	.pc-name { font-size: 1rem; font-weight: 700; color: var(--text-primary); }
	.pc-desc { font-size: 0.8rem; color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	.pc-meta { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-1); }
	.pc-tag { font-size: 0.7rem; color: var(--primary-light); background: rgba(99,102,241,0.08); padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; }
	.pc-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
	.pc-arrow { color: var(--primary-light); font-size: 1.2rem; }

	.bom-row { display: flex; gap: var(--space-3); align-items: flex-start; padding: var(--space-3) 0; border-bottom: 1px solid var(--border); }
	.bom-row:last-child { border-bottom: none; }
</style>
