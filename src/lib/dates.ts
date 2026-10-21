const DAY_MS = 86_400_000;

export function daysUntil(date: Date): number {
	return Math.ceil((date.getTime() - Date.now()) / DAY_MS);
}
export function formatDate(value: Date | string | null | undefined): string {
	if (!value) return "—";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return date.toLocaleDateString();
}

export function toDateInput(value: Date | string | null | undefined): string {
	if (!value) return "";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 10);
}

export function formatDateTime(
	value: Date | string | null | undefined,
): string {
	if (!value) return "—";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return date.toLocaleString();
}
