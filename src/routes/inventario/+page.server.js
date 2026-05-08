import { redirect } from '@sveltejs/kit';

export async function load({ locals, url }) {
	const { data: { session } } = await locals.supabase.auth.getSession();
	if (!session) throw redirect(303, '/login');

	const search = url.searchParams.get('q') || '';

	let query = locals.supabase
		.from('materials')
		.select(`
			sku, name, technical_spec, unit_of_measure, avg_cost, last_purchase_price, image_url,
			stock_by_location(id, quantity, locations(id, name))
		`)
		.order('name');

	if (search) query = query.ilike('name', `%${search}%`);

	const { data: materials, error } = await query;

	// Total valuation
	let totalValuation = 0;
	for (const m of (materials || [])) {
		const qty = m.stock_by_location?.reduce((s, r) => s + (r.quantity || 0), 0) ?? 0;
		totalValuation += qty * (m.avg_cost || 0);
	}

	const { data: locations } = await locals.supabase.from('locations').select('*').order('name');

	return { materials: materials ?? [], locations: locations ?? [], totalValuation, search };
}
