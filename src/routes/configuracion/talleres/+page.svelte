<script>
	import { _ } from 'svelte-i18n';
	import { supabase } from '$lib/supabase.js';
	import { toast } from '$lib/stores/toast.js';
	import { invalidateAll } from '$app/navigation';

	export let data;
	$: ({ courses, workshops, workshop_courses } = data);

	let newWorkshop = '';
	let newCourse = '';
	let loading = false;

	async function addWorkshop() {
		if (!newWorkshop) return;
		loading = true;
		const { error } = await supabase.from('workshops').insert({ name: newWorkshop });
		loading = false;
		if (error) toast.error(error.message);
		else { toast.success('Taller agregado'); newWorkshop = ''; invalidateAll(); }
	}

	async function addCourse() {
		if (!newCourse) return;
		loading = true;
		const { error } = await supabase.from('courses').insert({ name: newCourse });
		loading = false;
		if (error) toast.error(error.message);
		else { toast.success('Curso agregado'); newCourse = ''; invalidateAll(); }
	}

	async function deleteWorkshop(id) {
		if (!confirm('¿Eliminar este taller?')) return;
		const { error } = await supabase.from('workshops').delete().eq('id', id);
		if (error) toast.error(error.message);
		else { toast.success('Taller eliminado'); invalidateAll(); }
	}

	async function deleteCourse(id) {
		if (!confirm('¿Eliminar este curso?')) return;
		const { error } = await supabase.from('courses').delete().eq('id', id);
		if (error) toast.error(error.message);
		else { toast.success('Curso eliminado'); invalidateAll(); }
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

<svelte:head><title>Talleres y Cursos — Pañol</title></svelte:head>

<div class="page-header">
	<div class="page-header-left">
		<h1 class="page-title">Configuración de Talleres</h1>
		<p class="page-subtitle">Gestioná los talleres, cursos y sus relaciones.</p>
	</div>
</div>

<div class="grid-2">
	<!-- Workshops Section -->
	<div class="card">
		<div class="card-header"><span class="card-title"><i class="ph ph-factory"></i> Talleres</span></div>
		<div class="p-4">
			<div class="flex gap-2 mb-4">
				<input class="form-control" bind:value={newWorkshop} placeholder="Nombre del taller..." />
				<button class="btn btn-primary" on:click={addWorkshop} disabled={loading}>+ Agregar</button>
			</div>
			<div class="list-group">
				{#each workshops as w}
					<div class="list-item">
						<span>{w.name}</span>
						<button class="btn btn-ghost btn-sm btn-icon" on:click={() => deleteWorkshop(w.id)}><i class="ph ph-trash"></i></button>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Courses Section -->
	<div class="card">
		<div class="card-header"><span class="card-title"><i class="ph ph-graduation-cap"></i> Cursos</span></div>
		<div class="p-4">
			<div class="flex gap-2 mb-4">
				<input class="form-control" bind:value={newCourse} placeholder="Ej: 4DT..." />
				<button class="btn btn-primary" on:click={addCourse} disabled={loading}>+ Agregar</button>
			</div>
			<div class="list-group h-64 overflow-y-auto">
				{#each courses as c}
					<div class="list-item">
						<span>{c.name}</span>
						<button class="btn btn-ghost btn-sm btn-icon" on:click={() => deleteCourse(c.id)}><i class="ph ph-trash"></i></button>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<!-- Associations Section -->
<div class="card mt-6">
	<div class="card-header"><span class="card-title"><i class="ph ph-link"></i> Asociar Cursos a Talleres</span></div>
	<div class="p-4">
		<div class="flex gap-4 items-end mb-6 bg-surface p-4 rounded-lg border border-dashed border-primary">
			<div class="form-group flex-1">
				<label class="form-label">Taller</label>
				<select class="form-control" bind:value={selectedWorkshop}>
					<option value="">Seleccionar taller...</option>
					{#each workshops as w}<option value={w.id}>{w.name}</option>{/each}
				</select>
			</div>
			<div class="form-group flex-1">
				<label class="form-label">Curso</label>
				<select class="form-control" bind:value={selectedCourse}>
					<option value="">Seleccionar curso...</option>
					{#each courses as c}<option value={c.id}>{c.name}</option>{/each}
				</select>
			</div>
			<button class="btn btn-primary" on:click={associate} disabled={loading || !selectedWorkshop || !selectedCourse}>
				<i class="ph ph-plus"></i> Vincular
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
									<button class="assoc-tag-del" on:click={() => removeAssociation(w.id, rel.course_id)}>✕</button>
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
	.list-group { display: flex; flex-direction: column; gap: 4px; }
	.list-item { 
		display: flex; justify-content: space-between; align-items: center; 
		padding: 8px 12px; background: var(--bg-surface); border-radius: var(--radius);
		border: 1px solid var(--border);
	}
	.assoc-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: var(--space-4);
	}
	.assoc-card {
		padding: var(--space-4);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
	}
	.assoc-card-title { font-weight: 700; margin-bottom: var(--space-3); font-size: 0.9rem; color: var(--primary-light); }
	.assoc-tags { display: flex; flex-wrap: wrap; gap: 6px; }
	.assoc-tag {
		display: inline-flex; align-items: center; gap: 6px;
		background: rgba(99,102,241,0.08); color: var(--primary-light);
		padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;
		border: 1px solid rgba(99,102,241,0.15);
	}
	.assoc-tag-del { 
		background: none; border: none; color: inherit; cursor: pointer; 
		font-size: 0.7rem; padding: 2px; display: flex; align-items: center; justify-content: center;
		opacity: 0.6; transition: opacity 0.2s;
	}
	.assoc-tag-del:hover { opacity: 1; color: var(--danger); }
</style>
