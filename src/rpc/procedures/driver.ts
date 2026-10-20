import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { aadharCards, drivers, drivingLicenses } from "#/db-schema";
import { db } from "#/lib/db";
import { protectedProcedure } from "../base";

const driverInputSchema = z.object({
	name: z.string().min(1),
	phoneNumber: z.string().optional(),
});

const driverUpdateSchema = z.object({
	id: z.number().int(),
	name: z.string().min(1).optional(),
	phoneNumber: z.string().optional().nullable(),
});

export const list = protectedProcedure.handler(async ({ context }) => {
	return db
		.select()
		.from(drivers)
		.where(eq(drivers.userId, context.user.id))
		.orderBy(drivers.createdAt);
});

export const getById = protectedProcedure
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [driver] = await db
			.select()
			.from(drivers)
			.where(
				and(eq(drivers.id, input.id), eq(drivers.userId, context.user.id)),
			);

		if (!driver) return null;

		const [[aadharCard], licenses] = await Promise.all([
			db.select().from(aadharCards).where(eq(aadharCards.driverId, driver.id)),
			db
				.select()
				.from(drivingLicenses)
				.where(eq(drivingLicenses.driverId, driver.id)),
		]);

		return {
			...driver,
			aadharCard: aadharCard ?? null,
			drivingLicenses: licenses,
		};
	});

export const create = protectedProcedure
	.input(driverInputSchema)
	.handler(async ({ context, input }) => {
		const [driver] = await db
			.insert(drivers)
			.values({ ...input, userId: context.user.id })
			.returning();
		return driver ?? null;
	});

export const update = protectedProcedure
	.input(driverUpdateSchema)
	.handler(async ({ context, input }) => {
		const { id, ...data } = input;
		const [driver] = await db
			.update(drivers)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(drivers.id, id), eq(drivers.userId, context.user.id)))
			.returning();
		return driver ?? null;
	});

export const remove = protectedProcedure
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [driver] = await db
			.delete(drivers)
			.where(and(eq(drivers.id, input.id), eq(drivers.userId, context.user.id)))
			.returning();
		return driver ?? null;
	});
