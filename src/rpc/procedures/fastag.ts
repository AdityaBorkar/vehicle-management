import { eq } from "drizzle-orm";
import { z } from "zod";

import { fastags } from "#/db-schema";
import { db } from "#/lib/db";
import { protectedProcedure } from "../base";
import { verifyVehicleOwnership } from "./vehicle-ownership";

const fastagInputSchema = z.object({
	balance: z.string().optional(),
	bankWallet: z.string().optional(),
	isActive: z.boolean().optional(),
	tagId: z.string().min(1),
	vehicleId: z.number().int(),
});

export const list = protectedProcedure
	.input(z.object({ vehicleId: z.number().int() }))
	.handler(async ({ context, input }) => {
		await verifyVehicleOwnership(input.vehicleId, context.user.id);
		return db
			.select()
			.from(fastags)
			.where(eq(fastags.vehicleId, input.vehicleId));
	});

export const create = protectedProcedure
	.input(fastagInputSchema)
	.handler(async ({ context, input }) => {
		await verifyVehicleOwnership(input.vehicleId, context.user.id);
		const [fastag] = await db.insert(fastags).values(input).returning();
		return fastag;
	});

export const update = protectedProcedure
	.input(
		z.object({
			balance: z.string().optional(),
			bankWallet: z.string().optional(),
			id: z.number().int(),
			isActive: z.boolean().optional(),
			tagId: z.string().min(1).optional(),
		}),
	)
	.handler(async ({ context, input }) => {
		const { id, ...data } = input;
		const [existing] = await db
			.select()
			.from(fastags)
			.where(eq(fastags.id, id));
		if (!existing) return null;
		await verifyVehicleOwnership(existing.vehicleId, context.user.id);
		const [fastag] = await db
			.update(fastags)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(fastags.id, id))
			.returning();
		return fastag ?? null;
	});

export const remove = protectedProcedure
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [existing] = await db
			.select()
			.from(fastags)
			.where(eq(fastags.id, input.id));
		if (!existing) return null;
		await verifyVehicleOwnership(existing.vehicleId, context.user.id);
		const [fastag] = await db
			.delete(fastags)
			.where(eq(fastags.id, input.id))
			.returning();
		return fastag ?? null;
	});
