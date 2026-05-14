import { redirect } from '@sveltejs/kit';

export async function load({ locals, url }) {
	const { data: { session } } = await locals.supabase.auth.getSession();

	// Public routes
	const publicPaths = ['/login'];
	if (publicPaths.includes(url.pathname)) {
		if (session) throw redirect(303, '/dashboard');
		return {};
	}

	if (!session) {
		throw redirect(303, '/login');
	}

	// Fetch user profile
	const { data: profile } = await locals.supabase
		.from('user_profiles')
		.select('*')
		.eq('id', session.user.id)
		.single();

	return {
		session,
		profile: profile ?? {
			id: session.user.id,
			email: session.user.email,
			full_name: session.user.email,
			role: 'profesor'
		}
	};
}
