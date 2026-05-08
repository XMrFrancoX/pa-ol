import { writable } from 'svelte/store';

export const toasts = writable([]);
let counter = 0;

export function addToast(message, type = 'info', duration = 4000) {
	const id = counter++;
	toasts.update(t => [...t, { id, message, type }]);
	if (duration > 0) {
		setTimeout(() => removeToast(id), duration);
	}
	return id;
}

export function removeToast(id) {
	toasts.update(t => t.filter(toast => toast.id !== id));
}

export const toast = {
	success: (msg, dur) => addToast(msg, 'success', dur),
	error: (msg, dur) => addToast(msg, 'error', dur ?? 6000),
	warning: (msg, dur) => addToast(msg, 'warning', dur),
	info: (msg, dur) => addToast(msg, 'info', dur),
};
