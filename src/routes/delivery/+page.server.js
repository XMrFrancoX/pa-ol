import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	const { data: { session } } = await locals.supabase.auth.getSession();
	if (!session) throw redirect(303, '/login');

	const { data: deliveries } = await locals.supabase
		.from('deliveries')
		.select(`
			id, status, created_at, delivered_at,
			user_profiles!responsible_id(full_name),
			projects(name)
		`)
		.order('created_at', { ascending: false });

	return { deliveries: deliveries ?? [] };
}
