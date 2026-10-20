import { eq } from "drizzle-orm";
import { z } from "zod";

import { dieselCards } from "#/db-schema";
import { db } from "#/lib/db";
import { authorized } from "../base";
import { verifyVehicleOwnership } from "./vehicle-ownership";

const dieselCardInputSchema = z.object({
	balance: z.string().optional(),
	cardNumber: z.string().min(1),
	isActive: z.boolean().optional(),
	provider: z.string().optional(),
	vehicleId: z.number().int(),
});

export const list = authorized
	.input(z.object({ vehicleId: z.number().int() }))
	.handler(async ({ context, input }) => {
		await verifyVehicleOwnership(input.vehicleId, context.user.id);
		return db
			.select()
			.from(dieselCards)
			.where(eq(dieselCards.vehicleId, input.vehicleId));
	});

export const create = authorized
	.input(dieselCardInputSchema)
	.handler(async ({ context, input }) => {
		await verifyVehicleOwnership(input.vehicleId, context.user.id);
		const [card] = await db.insert(dieselCards).values(input).returning();
		return card;
	});

export const update = authorized
	.input(
		z.object({
			balance: z.string().optional(),
			cardNumber: z.string().min(1).optional(),
			id: z.number().int(),
			isActive: z.boolean().optional(),
			provider: z.string().optional(),
		}),
	)
	.handler(async ({ context, input }) => {
		const { id, ...data } = input;
		const [existing] = await db
			.select()
			.from(dieselCards)
			.where(eq(dieselCards.id, id));
		if (!existing) return null;
		await verifyVehicleOwnership(existing.vehicleId, context.user.id);
		const [card] = await db
			.update(dieselCards)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(dieselCards.id, id))
			.returning();
		return card ?? null;
	});

export const remove = authorized
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [existing] = await db
			.select()
			.from(dieselCards)
			.where(eq(dieselCards.id, input.id));
		if (!existing) return null;
		await verifyVehicleOwnership(existing.vehicleId, context.user.id);
		const [card] = await db
			.delete(dieselCards)
			.where(eq(dieselCards.id, input.id))
			.returning();
		return card ?? null;
	});
