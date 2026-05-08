import { redirect, error } from '@sveltejs/kit';

export async function load({ locals, params }) {
	const { data: { session } } = await locals.supabase.auth.getSession();
	if (!session) throw redirect(303, '/login');

	const { data: project, error: err } = await locals.supabase
		.from('projects')
		.select(`
			id, name, description, status, created_at,
			project_bom(
				id, quantity_needed,
				materials(sku, name, unit_of_measure, avg_cost, stock_by_location(quantity))
			)
		`)
		.eq('id', params.id)
		.single();

	if (err || !project) throw error(404, 'Proyecto no encontrado');

	// Calculate feasibility
	let maxUnits = Infinity;
	const feasibility = project.project_bom.map(b => {
		const totalStock = b.materials?.stock_by_location?.reduce((s, r) => s + r.quantity, 0) ?? 0;
		const possible = b.quantity_needed > 0 ? Math.floor(totalStock / b.quantity_needed) : Infinity;
		if (possible < maxUnits) maxUnits = possible;
		return {
			sku: b.materials?.sku,
			name: b.materials?.name,
			unit: b.materials?.unit_of_measure,
			needed: b.quantity_needed,
			stock: totalStock,
			possible,
			missing: Math.max(0, b.quantity_needed - totalStock)
		};
	});
	if (maxUnits === Infinity) maxUnits = 0;

	return { project, feasibility, maxUnits };
}
