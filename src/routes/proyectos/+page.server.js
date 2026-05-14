import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	const { data: { session } } = await locals.supabase.auth.getSession();
	if (!session) throw redirect(303, '/login');

	const [
		{ data: projects },
		{ data: courses },
		{ data: workshops },
		{ data: locations }
	] = await Promise.all([
		locals.supabase
			.from('projects')
			.select('id, name, description, status, created_at, project_bom(count), courses(name), workshops(name), locations:destination_location_id(name)')
			.order('created_at', { ascending: false }),
		locals.supabase.from('courses').select('*').order('name'),
		locals.supabase.from('workshops').select('*').order('name'),
		locals.supabase.from('locations').select('*').order('name')
	]);

	return { 
		projects: projects ?? [], 
		courses: courses ?? [], 
		workshops: workshops ?? [], 
		locations: locations ?? [] 
	};
}
