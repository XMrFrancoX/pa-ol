import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	const { data: { session } } = await locals.supabase.auth.getSession();
	if (!session) throw redirect(303, '/login');

	const { data: suppliers } = await locals.supabase.from('suppliers').select('*').order('razon_social');

	return { suppliers: suppliers ?? [] };
}
