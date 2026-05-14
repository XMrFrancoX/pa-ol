import { redirect } from '@sveltejs/kit';

export async function load({ locals, url }) {
	const { data: { session } } = await locals.supabase.auth.getSession();
	if (!session) throw redirect(303, '/login');

	const [
		{ data: orders },
		{ data: suppliers },
		{ data: courses },
		{ data: workshops },
		{ data: locations },
		{ data: materials }
	] = await Promise.all([
		locals.supabase
			.from('purchase_orders')
			.select('id, status, created_at, received_at, total_value, suppliers(razon_social)')
			.order('created_at', { ascending: false }),
		locals.supabase.from('suppliers').select('id, razon_social').order('razon_social'),
		locals.supabase.from('courses').select('id, name').order('name'),
		locals.supabase.from('workshops').select('id, name').order('name'),
		locals.supabase.from('locations').select('id, name').order('name'),
		locals.supabase.from('materials').select('sku, name').order('name')
	]);

	return { 
		orders: orders ?? [], 
		suppliers: suppliers ?? [],
		courses: courses ?? [],
		workshops: workshops ?? [],
		locations: locations ?? [],
		materials: materials ?? []
	};
}
