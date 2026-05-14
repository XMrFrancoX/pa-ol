<script>
	import { _ } from 'svelte-i18n';
	import { supabase } from '$lib/supabase.js';
	import { toast } from '$lib/stores/toast.js';
	import { invalidateAll } from '$app/navigation';

	export let data;
	$: ({ courses, workshops, locations, workshop_courses } = data);

	let newItemNames = { workshops: '', courses: '', locations: '' };
	let loading = false;

	async function addItem(table) {
		const name = newItemNames[table];
		if (!name) return;
		loading = true;
		const { error } = await supabase.from(table).insert({ name });
		loading = false;
		if (error) toast.error(error.message);
		else { toast.success('Agregado con éxito'); newItemNames[table] = ''; invalidateAll(); }
	}

	async function deleteItem(table, id) {
		if (!confirm('¿Eliminar este elemento? Esta acción puede fallar si está en uso.')) return;
		const { error } = await supabase.from(table).delete().eq('id', id);
		if (error) toast.error('No se puede eliminar: está siendo utilizado en otra parte del sistema.');
		else { toast.success('Eliminado'); invalidateAll(); }
	}

	let selectedWorkshop = '';
	let selectedCourse = '';

	async function associate() {
		if (!selectedWorkshop || !selectedCourse) return;
		loading = true;
		const { error } = await supabase.from('workshop_courses').insert({
			workshop_id: selectedWorkshop,
			course_id: selectedCourse
		});
		loading = false;
		if (error) toast.error('Ya están asociados o error: ' + error.message);
		else { toast.success('Asociación creada'); invalidateAll(); }
	}

	async function removeAssociation(wId, cId) {
		const { error } = await supabase.from('workshop_courses').delete().eq('workshop_id', wId).eq('course_id', cId);
		if (error) toast.error(error.message);
		else { toast.success('Asociación eliminada'); invalidateAll(); }
	}
</script>

<svelte:head><title>Configuración — Pañol</title></svelte:head>

<div class="page-header">
	<div class="page-header-left">
		<h1 class="page-title">Configuración del Sistema</h1>
		<p class="page-subtitle">Gestioná las entidades base del sistema: talleres, cursos y ubicaciones.</p>
	</div>
</div>

<div class="config-grid">
	<!-- Workshops Section -->
	<div class="card config-card">
		<div class="card-header"><span class="card-title"><i class="ph ph-factory"></i> Talleres</span></div>
		<div class="p-4">
			<div class="input-group mb-4">
				<input class="form-control" bind:value={newItemNames.workshops} placeholder="Nombre del taller..." />
				<button class="btn btn-primary" on:click={() => addItem('workshops')} disabled={loading}>+ Añadir</button>
			</div>
			<div class="table-container">
				<table class="config-table">
					<thead>
						<tr><th>Nombre</th><th style="width:40px"></th></tr>
					</thead>
					<tbody>
						{#each workshops as w}
							<tr>
								<td>{w.name}</td>
								<td><button class="btn-del" on:click={() => deleteItem('workshops', w.id)}><i class="ph ph-trash"></i></button></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<!-- Courses Section -->
	<div class="card config-card">
		<div class="card-header"><span class="card-title"><i class="ph ph-graduation-cap"></i> Cursos</span></div>
		<div class="p-4">
			<div class="input-group mb-4">
				<input class="form-control" bind:value={newItemNames.courses} placeholder="Nombre del curso (ej: 4DT)..." />
				<button class="btn btn-primary" on:click={() => addItem('courses')} disabled={loading}>+ Añadir</button>
			</div>
			<div class="table-container">
				<table class="config-table">
					<thead>
						<tr><th>Nombre</th><th style="width:40px"></th></tr>
					</thead>
					<tbody>
						{#each courses as c}
							<tr>
								<td>{c.name}</td>
								<td><button class="btn-del" on:click={() => deleteItem('courses', c.id)}><i class="ph ph-trash"></i></button></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<!-- Locations Section -->
	<div class="card config-card">
		<div class="card-header"><span class="card-title"><i class="ph ph-map-pin"></i> Ubicaciones</span></div>
		<div class="p-4">
			<div class="input-group mb-4">
				<input class="form-control" bind:value={newItemNames.locations} placeholder="Nombre de ubicación..." />
				<button class="btn btn-primary" on:click={() => addItem('locations')} disabled={loading}>+ Añadir</button>
			</div>
			<div class="table-container">
				<table class="config-table">
					<thead>
						<tr><th>Nombre</th><th style="width:40px"></th></tr>
					</thead>
					<tbody>
						{#each locations as l}
							<tr>
								<td>{l.name}</td>
								<td><button class="btn-del" on:click={() => deleteItem('locations', l.id)}><i class="ph ph-trash"></i></button></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>

<!-- Associations Section -->
<div class="card mt-6">
	<div class="card-header"><span class="card-title"><i class="ph ph-link"></i> Asociación Talleres - Cursos</span></div>
	<div class="p-6">
		<div class="association-builder mb-8">
			<div class="form-group">
				<label class="form-label">Taller</label>
				<select class="form-control" bind:value={selectedWorkshop}>
					<option value="">Seleccionar taller...</option>
					{#each workshops as w}<option value={w.id}>{w.name}</option>{/each}
				</select>
			</div>
			<i class="ph ph-arrow-right icon-sep"></i>
			<div class="form-group">
				<label class="form-label">Curso</label>
				<select class="form-control" bind:value={selectedCourse}>
					<option value="">Seleccionar curso...</option>
					{#each courses as c}<option value={c.id}>{c.name}</option>{/each}
				</select>
			</div>
			<button class="btn btn-primary btn-lg" on:click={associate} disabled={loading || !selectedWorkshop || !selectedCourse}>
				<i class="ph ph-link"></i> Vincular curso al taller
			</button>
		</div>

		<div class="assoc-grid">
			{#each workshops as w}
				{@const related = workshop_courses.filter(wc => wc.workshop_id === w.id)}
				{#if related.length > 0}
					<div class="assoc-card">
						<div class="assoc-card-title">{w.name}</div>
						<div class="assoc-tags">
							{#each related as rel}
								<span class="assoc-tag">
									{rel.courses?.name}
									<button class="assoc-tag-del" on:click={() => removeAssociation(w.id, rel.course_id)} title="Eliminar asociación">✕</button>
								</span>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
	.config-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: var(--space-6); }
	
	.config-card { display: flex; flex-direction: column; }
	
	.input-group { display: flex; gap: 8px; }
	
	.table-container { 
		max-height: 300px; overflow-y: auto; 
		border: 1px solid var(--border); border-radius: var(--radius);
		background: var(--bg-surface);
	}
	
	.config-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
	.config-table th { 
		text-align: left; padding: 10px 12px; background: var(--bg-card); 
		position: sticky; top: 0; border-bottom: 1px solid var(--border);
		color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;
	}
	.config-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); }
	.config-table tr:last-child td { border-bottom: none; }
	.config-table tr:hover { background: rgba(255,255,255,0.02); }

	.btn-del {
		background: none; border: none; color: var(--text-muted); cursor: pointer;
		display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;
		border-radius: 6px; transition: all 0.2s;
	}
	.btn-del:hover { background: rgba(239, 68, 68, 0.1); color: var(--danger); }

	.association-builder {
		display: flex; align-items: flex-end; gap: var(--space-4);
		padding: var(--space-5); background: var(--bg-card); border-radius: var(--radius-lg);
		border: 1px solid var(--border);
	}
	.icon-sep { font-size: 1.2rem; color: var(--text-muted); margin-bottom: 12px; }

	.assoc-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--space-4);
	}
	.assoc-card {
		padding: var(--space-4);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		transition: transform 0.2s;
	}
	.assoc-card:hover { transform: translateY(-2px); border-color: var(--primary-light); }
	.assoc-card-title { font-weight: 700; margin-bottom: var(--space-3); font-size: 0.95rem; color: var(--primary-light); }
	.assoc-tags { display: flex; flex-wrap: wrap; gap: 8px; }
	.assoc-tag {
		display: inline-flex; align-items: center; gap: 6px;
		background: rgba(99,102,241,0.08); color: var(--primary-light);
		padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;
		border: 1px solid rgba(99,102,241,0.15);
	}
	.assoc-tag-del { 
		background: none; border: none; color: inherit; cursor: pointer; 
		font-size: 0.75rem; padding: 2px; display: flex; align-items: center; justify-content: center;
		opacity: 0.6; transition: opacity 0.2s;
	}
	.assoc-tag-del:hover { opacity: 1; color: var(--danger); }
</style>
