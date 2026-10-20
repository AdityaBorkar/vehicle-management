import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
	aadharCards,
	dlVehicleClasses,
	documents,
	drivers,
	drivingLicenses,
	vehicles,
} from "#/db-schema";
import { db } from "#/lib/db";
import { authorized } from "../base";
import { verifyVehicleOwnership } from "./vehicle-ownership";

const documentKinds = [
	"insurance",
	"fitness",
	"pollution",
	"registration",
	"permit",
	"tax",
	"driving_license",
	"dl_class",
	"aadhar",
	"other",
] as const;

const kindSchema = z.enum(documentKinds);

const documentInputSchema = z.object({
	documentName: z.string().min(1),
	documentNumber: z.string().optional(),
	driverId: z.number().int().optional(),
	driverName: z.string().optional(),
	expiryDate: z.coerce.date().optional(),
	issueDate: z.coerce.date().optional(),
	kind: kindSchema,
	licenseId: z.number().int().optional(),
	licenseNumber: z.string().optional(),
	notes: z.string().optional(),
	vehicleId: z.number().int().optional(),
	vehicleRegistration: z.string().optional(),
	vin: z.string().optional(),
});

type DocumentListItem = {
	/** Stable key for React lists: `stored-<id>` or `<source>-<id>-<kind>`. */
	key: string;
	/** `stored` rows live in the vault; the rest mirror live records. */
	source: "stored" | "vehicle" | "license" | "aadhar";
	storedId: number | null;
	kind: string;
	documentName: string;
	documentNumber: string | null;
	vehicleId: number | null;
	vehicleRegistration: string | null;
	vin: string | null;
	driverId: number | null;
	driverName: string | null;
	licenseId: number | null;
	/** dl_vehicle_classes id for `dl_class` rows — used to renew the live record. */
	licenseClassId: number | null;
	/** DL number for driver documents. */
	licenseNumber: string | null;
	issueDate: Date | null;
	expiryDate: Date | null;
	/** Vault status. Live rows are always `active`. */
	status: string;
	isCurrent: boolean;
	notes: string | null;
	createdAt: Date | null;
};

async function verifyDriverOwnership(driverId: number, userId: string) {
	const [driver] = await db
		.select()
		.from(drivers)
		.where(and(eq(drivers.id, driverId), eq(drivers.userId, userId)));
	if (!driver) throw new Error("Driver not found");
	return driver;
}

export const list = authorized.handler(async ({ context }) => {
	const items: DocumentListItem[] = [];

	const stored = await db
		.select()
		.from(documents)
		.where(eq(documents.userId, context.user.id));
	for (const d of stored) {
		items.push({
			createdAt: d.createdAt,
			documentName: d.documentName,
			documentNumber: d.documentNumber,
			driverId: d.driverId,
			driverName: d.driverName,
			expiryDate: d.expiryDate,
			isCurrent: d.isCurrent ?? true,
			issueDate: d.issueDate,
			key: `stored-${d.id}`,
			kind: d.kind,
			licenseClassId: null,
			licenseId: d.licenseId,
			licenseNumber: d.licenseNumber,
			notes: d.notes,
			source: "stored",
			status: d.status ?? "active",
			storedId: d.id,
			vehicleId: d.vehicleId,
			vehicleRegistration: d.vehicleRegistration,
			vin: d.vin,
		});
	}

	const vehicleList = await db
		.select()
		.from(vehicles)
		.where(eq(vehicles.userId, context.user.id));
	for (const v of vehicleList) {
		const base = {
			createdAt: v.createdAt,
			documentNumber: null as string | null,
			driverId: null as number | null,
			driverName: null as string | null,
			isCurrent: true,
			licenseClassId: null as number | null,
			licenseId: null as number | null,
			licenseNumber: null as string | null,
			notes: null as string | null,
			source: "vehicle" as const,
			status: "active",
			storedId: null as number | null,
			vehicleId: v.id,
			vehicleRegistration: v.registrationNumber,
			vin: v.vin,
		};
		if (v.registrationDate) {
			items.push({
				...base,
				documentName: "Registration Certificate (RC)",
				expiryDate: null,
				issueDate: v.registrationDate,
				key: `vehicle-${v.id}-registration`,
				kind: "registration",
			});
		}
		if (v.insuranceValidTill) {
			items.push({
				...base,
				documentName: "Insurance",
				expiryDate: v.insuranceValidTill,
				issueDate: null,
				key: `vehicle-${v.id}-insurance`,
				kind: "insurance",
			});
		}
		if (v.fitnessValidTill) {
			items.push({
				...base,
				documentName: "Fitness Certificate",
				expiryDate: v.fitnessValidTill,
				issueDate: null,
				key: `vehicle-${v.id}-fitness`,
				kind: "fitness",
			});
		}
		if (v.pollutionValidTill) {
			items.push({
				...base,
				documentName: "Pollution (PUC)",
				expiryDate: v.pollutionValidTill,
				issueDate: null,
				key: `vehicle-${v.id}-pollution`,
				kind: "pollution",
			});
		}
	}

	const driverList = await db
		.select()
		.from(drivers)
		.where(eq(drivers.userId, context.user.id));
	for (const driver of driverList) {
		const cards = await db
			.select()
			.from(aadharCards)
			.where(eq(aadharCards.driverId, driver.id));
		for (const card of cards) {
			items.push({
				createdAt: card.createdAt,
				documentName: "Aadhar Card",
				documentNumber: card.aadharNumber,
				driverId: driver.id,
				driverName: driver.name,
				expiryDate: null,
				isCurrent: true,
				issueDate: null,
				key: `aadhar-${card.id}`,
				kind: "aadhar",
				licenseClassId: null,
				licenseId: null,
				licenseNumber: null,
				notes: null,
				source: "aadhar",
				status: "active",
				storedId: null,
				vehicleId: null,
				vehicleRegistration: null,
				vin: null,
			});
		}

		const licenses = await db
			.select()
			.from(drivingLicenses)
			.where(eq(drivingLicenses.driverId, driver.id));
		for (const license of licenses) {
			items.push({
				createdAt: license.createdAt,
				documentName: "Driving License",
				documentNumber: license.licenseNumber,
				driverId: driver.id,
				driverName: driver.name,
				expiryDate: null,
				isCurrent: true,
				issueDate: license.issueDate,
				key: `license-${license.id}`,
				kind: "driving_license",
				licenseClassId: null,
				licenseId: license.id,
				licenseNumber: license.licenseNumber,
				notes: license.holderName,
				source: "license",
				status: "active",
				storedId: null,
				vehicleId: null,
				vehicleRegistration: null,
				vin: null,
			});
			const classes = await db
				.select()
				.from(dlVehicleClasses)
				.where(eq(dlVehicleClasses.licenseId, license.id));
			for (const vc of classes) {
				items.push({
					createdAt: vc.createdAt,
					documentName: `Driving License — ${vc.vehicleClass}`,
					documentNumber: license.licenseNumber,
					driverId: driver.id,
					driverName: driver.name,
					expiryDate: vc.expiryDate,
					isCurrent: true,
					issueDate: license.issueDate,
					key: `license-${license.id}-class-${vc.id}`,
					kind: "dl_class",
					licenseClassId: vc.id,
					licenseId: license.id,
					licenseNumber: license.licenseNumber,
					notes: license.holderName,
					source: "license",
					status: "active",
					storedId: null,
					vehicleId: null,
					vehicleRegistration: null,
					vin: null,
				});
			}
		}
	}

	return items;
});

export const create = authorized
	.input(documentInputSchema)
	.handler(async ({ context, input }) => {
		let vehicleRegistration = input.vehicleRegistration;
		let vin = input.vin;
		if (input.vehicleId) {
			const vehicle = await verifyVehicleOwnership(
				input.vehicleId,
				context.user.id,
			);
			const [full] = await db
				.select()
				.from(vehicles)
				.where(eq(vehicles.id, vehicle.id));
			vehicleRegistration ??= full?.registrationNumber;
			vin ??= full?.vin ?? undefined;
		}

		let driverName = input.driverName;
		if (input.driverId) {
			const driver = await verifyDriverOwnership(
				input.driverId,
				context.user.id,
			);
			driverName ??= driver.name;
		}

		let licenseNumber = input.licenseNumber;
		if (input.licenseId) {
			const [license] = await db
				.select()
				.from(drivingLicenses)
				.where(eq(drivingLicenses.id, input.licenseId));
			if (!license) throw new Error("License not found");
			await verifyDriverOwnership(license.driverId, context.user.id);
			licenseNumber ??= license.licenseNumber;
		}

		const [doc] = await db
			.insert(documents)
			.values({
				documentName: input.documentName,
				documentNumber: input.documentNumber,
				driverId: input.driverId,
				driverName,
				expiryDate: input.expiryDate,
				isCurrent: true,
				issueDate: input.issueDate,
				kind: input.kind,
				licenseId: input.licenseId,
				licenseNumber,
				notes: input.notes,
				status: "active",
				userId: context.user.id,
				vehicleId: input.vehicleId,
				vehicleRegistration,
				vin,
			})
			.returning();
		return doc;
	});

/**
 * Renew a vault document: the old row is kept as `superseded` history
 * and a new `active` row carries the fresh issue/expiry dates.
 * Old rows are never deleted or modified again.
 */
export const renew = authorized
	.input(
		z.object({
			documentNumber: z.string().optional(),
			expiryDate: z.coerce.date().optional(),
			id: z.number().int(),
			issueDate: z.coerce.date().optional(),
			notes: z.string().optional(),
		}),
	)
	.handler(async ({ context, input }) => {
		const [old] = await db
			.select()
			.from(documents)
			.where(
				and(eq(documents.id, input.id), eq(documents.userId, context.user.id)),
			);
		if (!old) return null;

		await db
			.update(documents)
			.set({ isCurrent: false, status: "superseded", updatedAt: new Date() })
			.where(eq(documents.id, old.id));

		const [next] = await db
			.insert(documents)
			.values({
				documentName: old.documentName,
				documentNumber: input.documentNumber ?? old.documentNumber,
				driverId: old.driverId,
				driverName: old.driverName,
				expiryDate: input.expiryDate ?? old.expiryDate,
				isCurrent: true,
				issueDate: input.issueDate ?? old.issueDate,
				kind: old.kind,
				licenseId: old.licenseId,
				licenseNumber: old.licenseNumber,
				notes: input.notes ?? old.notes,
				status: "active",
				userId: context.user.id,
				vehicleId: old.vehicleId,
				vehicleRegistration: old.vehicleRegistration,
				vin: old.vin,
			})
			.returning();
		return next;
	});

/**
 * Archive hides a document from the current view but keeps the row —
 * there is deliberately no delete procedure for documents.
 */
export const archive = authorized
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [doc] = await db
			.update(documents)
			.set({ isCurrent: false, status: "archived", updatedAt: new Date() })
			.where(
				and(eq(documents.id, input.id), eq(documents.userId, context.user.id)),
			)
			.returning();
		return doc ?? null;
	});
