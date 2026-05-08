import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	const { data: { session } } = await locals.supabase.auth.getSession();
	if (!session) throw redirect(303, '/login');

	const [
		{ count: materialCount },
		{ data: stockData },
		{ count: pendingOrders },
		{ count: activeProjects },
		{ data: recentDeliveries }
	] = await Promise.all([
		locals.supabase.from('materials').select('*', { count: 'exact', head: true }),
		locals.supabase.from('materials').select('avg_cost, stock_by_location(quantity)'),
		locals.supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).in('status', ['draft', 'sent']),
		locals.supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
		locals.supabase.from('deliveries')
			.select('id, status, created_at, user_profiles!responsible_id(full_name), projects(name)')
			.order('created_at', { ascending: false })
			.limit(5)
	]);

	// Total stock qty and valuation
	let totalStockQty = 0;
	let totalValuation = 0;
	for (const mat of (stockData || [])) {
		const qty = mat.stock_by_location?.reduce((s, r) => s + (r.quantity || 0), 0) ?? 0;
		totalStockQty += qty;
		totalValuation += qty * (mat.avg_cost || 0);
	}

	return {
		stats: {
			materialCount: materialCount ?? 0,
			totalStockQty,
			totalValuation,
			pendingOrders: pendingOrders ?? 0,
			activeProjects: activeProjects ?? 0
		},
		recentDeliveries: recentDeliveries ?? []
	};
}
