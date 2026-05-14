import { redirect, error } from '@sveltejs/kit';

export async function load({ locals, params }) {
	const { data: { session } } = await locals.supabase.auth.getSession();
	if (!session) throw redirect(303, '/login');

	const { data: order, error: err } = await locals.supabase
		.from('purchase_orders')
		.select(`
			id, status, created_at, received_at, total_value, notes,
			suppliers(id, razon_social, cuit, contact_info),
			purchase_order_items(
				id, material_sku, requested_qty, received_qty, unit_price, subtotal, destination_course,
				materials(name, unit_of_measure, avg_cost),
				workshops(name),
				courses(name),
				locations:destination_location_id(name)
			)
		`)
		.eq('id', params.id)
		.single();

	if (err || !order) throw error(404, 'Orden no encontrada');

	const { data: locations } = await locals.supabase.from('locations').select('*').order('name');

	return { order, locations: locations ?? [] };
}
