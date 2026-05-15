import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	const { data: { user } } = await locals.supabase.auth.getUser();
	if (!user) throw redirect(303, '/login');

	const [
		{ data: budgets },
		{ data: suppliers },
		{ data: materials }
	] = await Promise.all([
		locals.supabase
			.from('budgets')
			.select('*, supplier_a:suppliers!supplier_a_id(razon_social), supplier_b:suppliers!supplier_b_id(razon_social)')
			.order('created_at', { ascending: false }),
		locals.supabase.from('suppliers').select('id, razon_social').order('razon_social'),
		locals.supabase.from('materials').select('sku, name').order('name')
	]);

	return { 
		budgets: budgets ?? [], 
		suppliers: suppliers ?? [],
		materials: materials ?? []
	};
}
