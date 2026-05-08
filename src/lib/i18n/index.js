import { register, init, getLocaleFromNavigator } from 'svelte-i18n';

register('es', () => import('./es.json'));
register('en', () => import('./en.json'));

export function setupI18n() {
	init({
		fallbackLocale: 'es',
		initialLocale: typeof localStorage !== 'undefined'
			? (localStorage.getItem('locale') || getLocaleFromNavigator() || 'es')
			: 'es'
	});
}
