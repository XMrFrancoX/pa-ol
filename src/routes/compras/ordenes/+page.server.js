import { redirect } from '@sveltejs/kit';

export async function load({ locals, url }) {
	const { data: { session } } = await locals.supabase.auth.getSession();
	if (!session) throw redirect(303, '/login');

	const [
		{ data: orders },
		{ data: suppliers }
	] = await Promise.all([
		locals.supabase
			.from('purchase_orders')
			.select('id, status, created_at, received_at, total_value, suppliers(razon_social)')
			.order('created_at', { ascending: false }),
		locals.supabase.from('suppliers').select('*').order('razon_social')
	]);

	return { orders: orders ?? [], suppliers: suppliers ?? [] };
}
