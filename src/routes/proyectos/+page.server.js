import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	const { data: { session } } = await locals.supabase.auth.getSession();
	if (!session) throw redirect(303, '/login');

	const { data: projects } = await locals.supabase
		.from('projects')
		.select('id, name, description, status, created_at, project_bom(count)')
		.order('created_at', { ascending: false });

	return { projects: projects ?? [] };
}
