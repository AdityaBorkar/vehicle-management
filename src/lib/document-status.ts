export type DocumentDisplayStatus =
	| "valid"
	| "expiring"
	| "expired"
	| "no-expiry"
	| "superseded"
	| "archived";

export type DisplayDoc = {
	status: string;
	isCurrent: boolean;
	expiryDate: Date | null;
	kind: string;
};

function daysLeft(expiry: Date): number {
	return Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Vault display status (Spec 05).
 * - archived/superseded first
 * - purchase_order is optional and never blocks compliance: even with an
 *   expiry date it is excluded from overdue/expiring-soon logic.
 * - no-expiry kinds (NULL expiry) show "no-expiry".
 */
export function getDocumentDisplayStatus(
	doc: DisplayDoc,
): DocumentDisplayStatus {
	if (doc.status === "archived") return "archived";
	if (doc.status === "superseded" || !doc.isCurrent) return "superseded";
	if (doc.kind === "purchase_order")
		return doc.expiryDate ? "valid" : "no-expiry";
	if (!doc.expiryDate) return "no-expiry";
	const left = daysLeft(doc.expiryDate);
	if (left < 0) return "expired";
	if (left <= 30) return "expiring";
	return "valid";
}
