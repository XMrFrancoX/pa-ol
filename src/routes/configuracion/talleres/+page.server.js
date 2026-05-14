import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	const { data: { session } } = await locals.supabase.auth.getSession();
	if (!session) throw redirect(303, '/login');

	const [
		{ data: courses },
		{ data: workshops },
		{ data: workshop_courses }
	] = await Promise.all([
		locals.supabase.from('courses').select('*').order('name'),
		locals.supabase.from('workshops').select('*').order('name'),
		locals.supabase.from('workshop_courses').select('*, courses(name), workshops(name)')
	]);

	return {
		courses: courses ?? [],
		workshops: workshops ?? [],
		workshop_courses: workshop_courses ?? []
	};
}
