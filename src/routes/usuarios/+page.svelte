<script>
	import { _ } from 'svelte-i18n';
	import { supabase } from '$lib/supabase.js';
	import { toast } from '$lib/stores/toast.js';
	import { invalidateAll } from '$app/navigation';

	export let data;
	$: ({ profiles } = data);

	const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '—';
	const roleBadge = { admin: 'badge-danger', encargado: 'badge-warning', alumno: 'badge-info' };
	const roleLabel = { admin: 'Administrador', encargado: 'Encargado', alumno: 'Alumno' };

	let showModal = false;
	let saving = false;
	let editingUser = null;
	let form = { full_name: '', email: '', role: 'alumno', password: '' };

	function openEdit(u) {
		editingUser = u;
		form = { full_name: u.full_name ?? '', email: u.email ?? '', role: u.role ?? 'alumno', password: '' };
		showModal = true;
	}
	function closeModal() { showModal = false; }

	async function saveUser() {
		if (!form.full_name || !editingUser) return;
		saving = true;
		const { error } = await supabase
			.from('user_profiles')
			.update({ full_name: form.full_name, role: form.role })
			.eq('id', editingUser.id);
		saving = false;
		if (error) toast.error('Error: ' + error.message);
		else { toast.success('Usuario actualizado'); closeModal(); invalidateAll(); }
	}

	async function inviteUser() {
		if (!form.email || !form.full_name) return;
		saving = true;
		// Admin creates user via supabase admin (needs service key on server)
		// Here we show the concept - in production use a server action
		toast.info('La invitación de nuevos usuarios requiere configuración del servidor (service key).');
		saving = false;
		closeModal();
	}

	let filterRole = 'all';
	$: filtered = filterRole === 'all' ? profiles : profiles.filter(p => p.role === filterRole);
</script>

<svelte:head><title>Usuarios — Pañol</title></svelte:head>

<div class="page-header">
	<div class="page-header-left">
		<h1 class="page-title">{$_('users.title')}</h1>
		<p class="page-subtitle">{$_('users.subtitle')}</p>
	</div>
</div>

<!-- Stats -->
<div class="stats-grid mb-6">
	{#each [['Todos', profiles.length, 'badge-neutral', 'all'], ['Administradores', profiles.filter(p=>p.role==='admin').length, 'badge-danger', 'admin'], ['Encargados', profiles.filter(p=>p.role==='encargado').length, 'badge-warning', 'encargado'], ['Alumnos', profiles.filter(p=>p.role==='alumno').length, 'badge-info', 'alumno']] as [label, count, badge, role]}
		<button
			class="role-stat"
			class:active={filterRole === role}
			on:click={() => filterRole = role}
		>
			<span class="badge {badge}">{label}</span>
			<span class="role-count">{count}</span>
		</button>
	{/each}
</div>

<div class="table-wrapper">
	<table>
		<thead>
			<tr>
				<th>Usuario</th>
				<th>Email</th>
				<th>{$_('users.role')}</th>
				<th>Creado</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each filtered as u}
				<tr>
					<td>
						<div class="flex items-center gap-3">
							<div class="user-avatar-sm">{(u.full_name || u.email || 'U').charAt(0).toUpperCase()}</div>
							<span class="font-semibold">{u.full_name ?? '—'}</span>
						</div>
					</td>
					<td class="td-muted">{u.email}</td>
					<td><span class="badge {roleBadge[u.role] ?? 'badge-neutral'}">{roleLabel[u.role] ?? u.role}</span></td>
					<td class="td-muted">{fmtDate(u.created_at)}</td>
					<td>
						<button class="btn btn-ghost btn-sm btn-icon" on:click={() => openEdit(u)} title="Editar rol"><i class="ph ph-pencil-simple"></i></button>
					</td>
				</tr>
			{:else}
				<tr><td colspan="5"><div class="empty-state" style="padding:2rem"><div class="empty-icon"><i class="ph ph-users"></i></div><div class="empty-title">Sin usuarios</div></div></td></tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- Modal: Editar Rol -->
{#if showModal}
<div class="modal-backdrop" on:click|self={closeModal}>
	<div class="modal">
		<div class="modal-header">
			<span class="modal-title">Editar Usuario</span>
			<button class="btn btn-ghost btn-sm btn-icon" on:click={closeModal}>✕</button>
		</div>
		<div class="modal-body">
			<div class="form-group">
				<label class="form-label" for="u-name">Nombre Completo</label>
				<input id="u-name" class="form-control" bind:value={form.full_name} />
			</div>
			<div class="form-group mt-4">
				<label class="form-label">Email</label>
				<div class="form-control" style="background:var(--bg-surface); cursor:not-allowed; color:var(--text-muted)">{editingUser?.email}</div>
			</div>
			<div class="form-group mt-4">
				<label class="form-label" for="u-role">Rol</label>
				<select id="u-role" class="form-control" bind:value={form.role}>
					<option value="alumno">Alumno</option>
					<option value="encargado">Encargado</option>
					<option value="admin">Administrador</option>
				</select>
				<div class="form-hint">
					Alumno: solo lectura · Encargado: operaciones · Admin: configuración total
				</div>
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn btn-ghost" on:click={closeModal}>{$_('common.cancel')}</button>
			<button class="btn btn-primary" on:click={saveUser} disabled={saving}>
				{saving ? 'Guardando...' : $_('common.save')}
			</button>
		</div>
	</div>
</div>
{/if}

<style>
	.role-stat {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4) var(--space-5);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		cursor: pointer;
		transition: all var(--transition);
		font-family: inherit;
	}
	.role-stat:hover { border-color: var(--border-light); }
	.role-stat.active { border-color: var(--primary); background: rgba(99,102,241,0.05); }
	.role-count { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); }

	.user-avatar-sm {
		width: 32px; height: 32px;
		background: linear-gradient(135deg, var(--primary), var(--primary-light));
		border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
		font-size: 0.85rem; font-weight: 700; color: white;
		flex-shrink: 0;
	}
</style>
