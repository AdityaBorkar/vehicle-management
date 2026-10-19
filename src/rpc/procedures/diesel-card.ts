import { eq } from "drizzle-orm";
import { z } from "zod";

import { dieselCards } from "#/db-schema";
import { db } from "#/lib/db/server";
import { authorized } from "../base";

const dieselCardInputSchema = z.object({
	balance: z.string().optional(),
	cardNumber: z.string().min(1),
	isActive: z.boolean().optional(),
	provider: z.string().optional(),
	vehicleId: z.number().int(),
});

export const list = authorized
	.input(z.object({ vehicleId: z.number().int() }))
	.handler(async ({ input }) => {
		return db
			.select()
			.from(dieselCards)
			.where(eq(dieselCards.vehicleId, input.vehicleId));
	});

export const create = authorized
	.input(dieselCardInputSchema)
	.handler(async ({ input }) => {
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
	.handler(async ({ input }) => {
		const { id, ...data } = input;
		const [card] = await db
			.update(dieselCards)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(dieselCards.id, id))
			.returning();
		return card ?? null;
	});

export const remove = authorized
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ input }) => {
		const [card] = await db
			.delete(dieselCards)
			.where(eq(dieselCards.id, input.id))
			.returning();
		return card ?? null;
	});
