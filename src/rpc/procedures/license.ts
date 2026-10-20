import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
	dlVehicleClasses,
	drivers,
	drivingLicenses,
	reminders,
} from "#/db-schema";
import { db } from "#/lib/db";
import { protectedProcedure } from "../base";

const licenseInputSchema = z.object({
	address: z.string().optional(),
	bloodGroup: z
		.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
		.optional(),
	dateOfBirth: z.coerce.date().optional(),
	driverId: z.number().int(),
	holderName: z.string().min(1),
	issueDate: z.coerce.date().optional(),
	licenseNumber: z.string().min(1),
	vehicleClasses: z
		.array(
			z.object({
				expiryDate: z.coerce.date(),
				vehicleClass: z.string().min(1),
			}),
		)
		.optional(),
});

const licenseUpdateSchema = z.object({
	address: z.string().optional(),
	bloodGroup: z
		.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
		.optional()
		.nullable(),
	dateOfBirth: z.coerce.date().optional().nullable(),
	holderName: z.string().min(1).optional(),
	id: z.number().int(),
	issueDate: z.coerce.date().optional().nullable(),
	licenseNumber: z.string().min(1).optional(),
});

async function verifyDriverOwnership(driverId: number, userId: string) {
	const [driver] = await db
		.select()
		.from(drivers)
		.where(and(eq(drivers.id, driverId), eq(drivers.userId, userId)));
	if (!driver) throw new Error("Driver not found");
	return driver;
}

async function upsertReminderForClass(
	userId: string,
	driverId: number,
	licenseId: number,
	vehicleClass: string,
	expiryDate: Date,
) {
	const existing = await db
		.select()
		.from(reminders)
		.where(
			and(
				eq(reminders.licenseId, licenseId),
				eq(reminders.type, "dl_class"),
				eq(reminders.title, `DL ${vehicleClass} expiry`),
			),
		);

	if (existing.length > 0) {
		const existingReminder = existing[0];
		if (!existingReminder) return;
		await db
			.update(reminders)
			.set({ dueDate: expiryDate, status: "active", updatedAt: new Date() })
			.where(eq(reminders.id, existingReminder.id));
	} else {
		await db.insert(reminders).values({
			driverId,
			dueDate: expiryDate,
			licenseId,
			notifyDays: [0, 7, 15, 30],
			title: `DL ${vehicleClass} expiry`,
			type: "dl_class",
			userId,
		});
	}
}

async function dismissReminderForClass(
	licenseId: number,
	vehicleClass: string,
) {
	await db
		.update(reminders)
		.set({ status: "dismissed", updatedAt: new Date() })
		.where(
			and(
				eq(reminders.licenseId, licenseId),
				eq(reminders.type, "dl_class"),
				eq(reminders.title, `DL ${vehicleClass} expiry`),
			),
		);
}

export const list = protectedProcedure
	.input(z.object({ driverId: z.number().int() }))
	.handler(async ({ context, input }) => {
		await verifyDriverOwnership(input.driverId, context.user.id);

		const licenses = await db
			.select()
			.from(drivingLicenses)
			.where(eq(drivingLicenses.driverId, input.driverId));

		const result = [];
		for (const license of licenses) {
			const classes = await db
				.select()
				.from(dlVehicleClasses)
				.where(eq(dlVehicleClasses.licenseId, license.id));
			result.push({ ...license, vehicleClasses: classes });
		}

		return result;
	});

export const getById = protectedProcedure
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [license] = await db
			.select()
			.from(drivingLicenses)
			.where(eq(drivingLicenses.id, input.id));

		if (!license) return null;

		const [driver] = await db
			.select()
			.from(drivers)
			.where(
				and(
					eq(drivers.id, license.driverId),
					eq(drivers.userId, context.user.id),
				),
			);

		if (!driver) return null;

		const classes = await db
			.select()
			.from(dlVehicleClasses)
			.where(eq(dlVehicleClasses.licenseId, license.id));

		return { ...license, vehicleClasses: classes };
	});

export const create = protectedProcedure
	.input(licenseInputSchema)
	.handler(async ({ context, input }) => {
		const { vehicleClasses: classesInput, ...licenseData } = input;
		await verifyDriverOwnership(input.driverId, context.user.id);

		const inserted = await db
			.insert(drivingLicenses)
			.values(licenseData)
			.returning();

		const license = inserted[0];
		if (!license) throw new Error("Failed to create license");

		const classes: (typeof dlVehicleClasses.$inferSelect)[] = [];

		if (classesInput && classesInput.length > 0) {
			for (const cls of classesInput) {
				const vcInserted = await db
					.insert(dlVehicleClasses)
					.values({
						expiryDate: cls.expiryDate,
						licenseId: license.id,
						vehicleClass: cls.vehicleClass,
					})
					.returning();
				const vc = vcInserted[0];
				if (vc) classes.push(vc);

				await upsertReminderForClass(
					context.user.id,
					input.driverId,
					license.id,
					cls.vehicleClass,
					cls.expiryDate,
				);
			}
		}

		return { ...license, vehicleClasses: classes };
	});

export const update = protectedProcedure
	.input(licenseUpdateSchema)
	.handler(async ({ context, input }) => {
		const { id, ...data } = input;

		const [license] = await db
			.select()
			.from(drivingLicenses)
			.where(eq(drivingLicenses.id, id));

		if (!license) return null;

		const [driver] = await db
			.select()
			.from(drivers)
			.where(
				and(
					eq(drivers.id, license.driverId),
					eq(drivers.userId, context.user.id),
				),
			);

		if (!driver) return null;

		const [updated] = await db
			.update(drivingLicenses)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(drivingLicenses.id, id))
			.returning();

		return updated ?? null;
	});

export const remove = protectedProcedure
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [license] = await db
			.select()
			.from(drivingLicenses)
			.where(eq(drivingLicenses.id, input.id));

		if (!license) return null;

		const [driver] = await db
			.select()
			.from(drivers)
			.where(
				and(
					eq(drivers.id, license.driverId),
					eq(drivers.userId, context.user.id),
				),
			);

		if (!driver) return null;

		const [deleted] = await db
			.delete(drivingLicenses)
			.where(eq(drivingLicenses.id, input.id))
			.returning();

		return deleted ?? null;
	});

export const addClass = protectedProcedure
	.input(
		z.object({
			expiryDate: z.coerce.date(),
			licenseId: z.number().int(),
			vehicleClass: z.string().min(1),
		}),
	)
	.handler(async ({ context, input }) => {
		const [license] = await db
			.select()
			.from(drivingLicenses)
			.where(eq(drivingLicenses.id, input.licenseId));

		if (!license) throw new Error("License not found");

		const [driver] = await db
			.select()
			.from(drivers)
			.where(
				and(
					eq(drivers.id, license.driverId),
					eq(drivers.userId, context.user.id),
				),
			);

		if (!driver) throw new Error("Driver not found");

		const [vc] = await db
			.insert(dlVehicleClasses)
			.values({
				expiryDate: input.expiryDate,
				licenseId: input.licenseId,
				vehicleClass: input.vehicleClass,
			})
			.returning();

		await upsertReminderForClass(
			context.user.id,
			license.driverId,
			input.licenseId,
			input.vehicleClass,
			input.expiryDate,
		);

		return vc;
	});

export const updateClass = protectedProcedure
	.input(
		z.object({
			expiryDate: z.coerce.date().optional(),
			id: z.number().int(),
			vehicleClass: z.string().min(1).optional(),
		}),
	)
	.handler(async ({ context, input }) => {
		const { id, ...data } = input;

		const [vc] = await db
			.select()
			.from(dlVehicleClasses)
			.where(eq(dlVehicleClasses.id, id));

		if (!vc) return null;

		const [license] = await db
			.select()
			.from(drivingLicenses)
			.where(eq(drivingLicenses.id, vc.licenseId));

		if (!license) return null;

		const [driver] = await db
			.select()
			.from(drivers)
			.where(
				and(
					eq(drivers.id, license.driverId),
					eq(drivers.userId, context.user.id),
				),
			);

		if (!driver) return null;

		const [updated] = await db
			.update(dlVehicleClasses)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(dlVehicleClasses.id, id))
			.returning();

		// A renewal overwrites the live expiry — keep the replaced date in
		// the documents vault so old DL documents are never lost.
		if (
			updated &&
			input.expiryDate &&
			vc.expiryDate.getTime() !== input.expiryDate.getTime()
		) {
			const { snapshotSupersededDocument } = await import("./document-history");
			await snapshotSupersededDocument({
				documentName: `Driving License — ${vc.vehicleClass}`,
				driverId: driver.id,
				driverName: driver.name,
				expiryDate: vc.expiryDate,
				issueDate: license.issueDate,
				kind: "dl_class",
				licenseId: vc.licenseId,
				licenseNumber: license.licenseNumber,
				userId: context.user.id,
			});
		}

		if (updated && input.expiryDate && license) {
			await upsertReminderForClass(
				context.user.id,
				license.driverId,
				license.id,
				updated.vehicleClass,
				input.expiryDate,
			);
		}

		return updated ?? null;
	});

export const removeClass = protectedProcedure
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [vc] = await db
			.select()
			.from(dlVehicleClasses)
			.where(eq(dlVehicleClasses.id, input.id));

		if (!vc) return null;

		const [license] = await db
			.select()
			.from(drivingLicenses)
			.where(eq(drivingLicenses.id, vc.licenseId));

		if (!license) return null;

		const [driver] = await db
			.select()
			.from(drivers)
			.where(
				and(
					eq(drivers.id, license.driverId),
					eq(drivers.userId, context.user.id),
				),
			);

		if (!driver) return null;

		// The class row is deleted — keep its dates in the documents vault
		// so the old DL document is never lost.
		const { snapshotSupersededDocument } = await import("./document-history");
		await snapshotSupersededDocument({
			documentName: `Driving License — ${vc.vehicleClass}`,
			driverId: driver.id,
			driverName: driver.name,
			expiryDate: vc.expiryDate,
			issueDate: license.issueDate,
			kind: "dl_class",
			licenseId: vc.licenseId,
			licenseNumber: license.licenseNumber,
			notes: "Vehicle class removed",
			userId: context.user.id,
		});

		await dismissReminderForClass(license.id, vc.vehicleClass);

		const [deleted] = await db
			.delete(dlVehicleClasses)
			.where(eq(dlVehicleClasses.id, input.id))
			.returning();

		return deleted ?? null;
	});
