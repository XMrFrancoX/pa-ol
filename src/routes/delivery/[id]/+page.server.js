import { redirect, error } from '@sveltejs/kit';

export async function load({ locals, params }) {
	const { data: { session } } = await locals.supabase.auth.getSession();
	if (!session) throw redirect(303, '/login');

	const { data: delivery, error: err } = await locals.supabase
		.from('deliveries')
		.select(`
			id, status, created_at, delivered_at, notes,
			user_profiles!responsible_id(id, full_name, email),
			projects(id, name),
			delivery_items(
				id, quantity,
				materials(sku, name, unit_of_measure),
				locations(id, name)
			)
		`)
		.eq('id', params.id)
		.single();

	if (err || !delivery) throw error(404, 'Entrega no encontrada');

	return { delivery };
}
