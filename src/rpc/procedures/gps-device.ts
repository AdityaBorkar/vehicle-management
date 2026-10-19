import { eq } from "drizzle-orm";
import { z } from "zod";

import { gpsDevices } from "#/db-schema";
import { db } from "#/lib/db/server";
import { authorized } from "../base";

const gpsDeviceInputSchema = z.object({
	deviceId: z.string().min(1),
	isActive: z.boolean().optional(),
	provider: z.string().optional(),
	vehicleId: z.number().int(),
});

export const list = authorized
	.input(z.object({ vehicleId: z.number().int() }))
	.handler(async ({ input }) => {
		return db
			.select()
			.from(gpsDevices)
			.where(eq(gpsDevices.vehicleId, input.vehicleId));
	});

export const create = authorized
	.input(gpsDeviceInputSchema)
	.handler(async ({ input }) => {
		const [device] = await db.insert(gpsDevices).values(input).returning();
		return device;
	});

export const update = authorized
	.input(
		z.object({
			deviceId: z.string().min(1).optional(),
			id: z.number().int(),
			isActive: z.boolean().optional(),
			provider: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...data } = input;
		const [device] = await db
			.update(gpsDevices)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(gpsDevices.id, id))
			.returning();
		return device ?? null;
	});

export const remove = authorized
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ input }) => {
		const [device] = await db
			.delete(gpsDevices)
			.where(eq(gpsDevices.id, input.id))
			.returning();
		return device ?? null;
	});
