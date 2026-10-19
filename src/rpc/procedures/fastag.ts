import { eq } from "drizzle-orm";
import { z } from "zod";

import { fastags } from "#/db-schema";
import { db } from "#/lib/db/server";
import { authorized } from "../base";

const fastagInputSchema = z.object({
	balance: z.string().optional(),
	bankWallet: z.string().optional(),
	isActive: z.boolean().optional(),
	tagId: z.string().min(1),
	vehicleId: z.number().int(),
});

export const list = authorized
	.input(z.object({ vehicleId: z.number().int() }))
	.handler(async ({ input }) => {
		return db
			.select()
			.from(fastags)
			.where(eq(fastags.vehicleId, input.vehicleId));
	});

export const create = authorized
	.input(fastagInputSchema)
	.handler(async ({ input }) => {
		const [fastag] = await db.insert(fastags).values(input).returning();
		return fastag;
	});

export const update = authorized
	.input(
		z.object({
			balance: z.string().optional(),
			bankWallet: z.string().optional(),
			id: z.number().int(),
			isActive: z.boolean().optional(),
			tagId: z.string().min(1).optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...data } = input;
		const [fastag] = await db
			.update(fastags)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(fastags.id, id))
			.returning();
		return fastag ?? null;
	});

export const remove = authorized
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ input }) => {
		const [fastag] = await db
			.delete(fastags)
			.where(eq(fastags.id, input.id))
			.returning();
		return fastag ?? null;
	});
