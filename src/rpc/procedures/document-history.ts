import { documents } from "#/db-schema";
import { db } from "#/lib/db";

/**
 * Snapshot a replaced value into the documents vault as history.
 * The row is written `superseded` straight away — it preserves the
 * previous issue/expiry dates and is never deleted or updated again.
 * Rows are write-once and never deleted.
 *
 * Kept in its own module (outside the oRPC router namespaces) because
 * every export of a `./procedures/*` module registered in the router
 * must be a procedure.
 */
export async function snapshotSupersededDocument(input: {
	userId: string;
	kind: string;
	documentName: string;
	documentNumber?: string | null;
	vehicleId?: number | null;
	driverId?: number | null;
	licenseId?: number | null;
	vehicleRegistration?: string | null;
	vin?: string | null;
	licenseNumber?: string | null;
	driverName?: string | null;
	issueDate?: Date | null;
	expiryDate?: Date | null;
	notes?: string | null;
}): Promise<void> {
	await db.insert(documents).values({
		documentName: input.documentName,
		documentNumber: input.documentNumber ?? null,
		driverId: input.driverId ?? null,
		driverName: input.driverName ?? null,
		expiryDate: input.expiryDate ?? null,
		isCurrent: false,
		issueDate: input.issueDate ?? null,
		kind: input.kind,
		licenseId: input.licenseId ?? null,
		licenseNumber: input.licenseNumber ?? null,
		notes: input.notes ?? null,
		status: "superseded",
		userId: input.userId,
		vehicleId: input.vehicleId ?? null,
		vehicleRegistration: input.vehicleRegistration ?? null,
		vin: input.vin ?? null,
	});
}
