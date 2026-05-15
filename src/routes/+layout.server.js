import { redirect } from '@sveltejs/kit';

export async function load({ locals, url }) {
	const { data: { user } } = await locals.supabase.auth.getUser();

	// Public routes
	const publicPaths = ['/login'];
	if (publicPaths.includes(url.pathname)) {
		if (user) throw redirect(303, '/dashboard');
		return {};
	}

	if (!user) {
		throw redirect(303, '/login');
	}

	// Fetch user profile
	const { data: profile } = await locals.supabase
		.from('user_profiles')
		.select('*')
		.eq('id', user.id)
		.single();

	return {
		user,
		profile: profile ?? {
			id: user.id,
			email: user.email,
			full_name: user.email,
			role: 'profesor'
		}
	};
}
