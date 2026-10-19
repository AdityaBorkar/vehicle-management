import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { aadharCards, drivers } from "#/db-schema";
import { db } from "#/lib/db/server";
import { authorized } from "../base";

const aadharInputSchema = z.object({
	aadharNumber: z.string().min(1),
	address: z.string().optional(),
	dateOfBirth: z.coerce.date().optional(),
	driverId: z.number().int(),
	gender: z.enum(["Male", "Female", "Other"]).optional(),
});

const aadharUpdateSchema = z.object({
	aadharNumber: z.string().min(1).optional(),
	address: z.string().optional(),
	dateOfBirth: z.coerce.date().optional().nullable(),
	gender: z.enum(["Male", "Female", "Other"]).optional().nullable(),
	id: z.number().int(),
});

export const getByDriverId = authorized
	.input(z.object({ driverId: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [driver] = await db
			.select()
			.from(drivers)
			.where(
				and(
					eq(drivers.id, input.driverId),
					eq(drivers.userId, context.user.id),
				),
			);

		if (!driver) return null;

		const [card] = await db
			.select()
			.from(aadharCards)
			.where(eq(aadharCards.driverId, input.driverId));

		return card ?? null;
	});

export const create = authorized
	.input(aadharInputSchema)
	.handler(async ({ context, input }) => {
		const [driver] = await db
			.select()
			.from(drivers)
			.where(
				and(
					eq(drivers.id, input.driverId),
					eq(drivers.userId, context.user.id),
				),
			);

		if (!driver) throw new Error("Driver not found");

		const existing = await db
			.select()
			.from(aadharCards)
			.where(eq(aadharCards.driverId, input.driverId));

		if (existing.length > 0)
			throw new Error("Aadhar card already exists for this driver");

		const [card] = await db.insert(aadharCards).values(input).returning();
		return card;
	});

export const update = authorized
	.input(aadharUpdateSchema)
	.handler(async ({ context, input }) => {
		const { id, ...data } = input;

		const [card] = await db
			.select()
			.from(aadharCards)
			.where(eq(aadharCards.id, id));

		if (!card) return null;

		const [driver] = await db
			.select()
			.from(drivers)
			.where(
				and(eq(drivers.id, card.driverId), eq(drivers.userId, context.user.id)),
			);

		if (!driver) return null;

		const [updated] = await db
			.update(aadharCards)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(aadharCards.id, id))
			.returning();

		return updated ?? null;
	});

export const remove = authorized
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [card] = await db
			.select()
			.from(aadharCards)
			.where(eq(aadharCards.id, input.id));

		if (!card) return null;

		const [driver] = await db
			.select()
			.from(drivers)
			.where(
				and(eq(drivers.id, card.driverId), eq(drivers.userId, context.user.id)),
			);

		if (!driver) return null;

		const [deleted] = await db
			.delete(aadharCards)
			.where(eq(aadharCards.id, input.id))
			.returning();

		return deleted ?? null;
	});
