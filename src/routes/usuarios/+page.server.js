import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	const { data: { session } } = await locals.supabase.auth.getSession();
	if (!session) throw redirect(303, '/login');

	const { data: profiles } = await locals.supabase
		.from('user_profiles')
		.select('id, full_name, email, role, created_at')
		.order('full_name');

	return { profiles: profiles ?? [] };
}
