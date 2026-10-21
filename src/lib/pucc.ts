/**
 * Client-safe PUCC helpers (no Node imports — usable in components).
 */

/** Last 5 chassis characters the PUC portal needs, or null when unknown. */
export function deriveChassisLast5(
	vin: string | null | undefined,
): string | null {
	const compact = (vin ?? "").toUpperCase().replace(/[\s-]+/g, "");
	if (compact.length < 5) return null;
	const last5 = compact.slice(-5);
	return /^[A-Z0-9]{5}$/.test(last5) ? last5 : null;
}

/** Same-origin URL that streams a stored PUCC PDF (auth-checked). */
export function puccArtifactUrl(runId: number): string {
	return `/api/pucc/${runId}`;
}
