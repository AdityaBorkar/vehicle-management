import { eq } from "drizzle-orm";
import { z } from "zod";

import { gpsDevices } from "#/db-schema";
import { db } from "#/lib/db";
import { protectedProcedure } from "../base";
import { verifyVehicleOwnership } from "./vehicle-ownership";

const gpsDeviceInputSchema = z.object({
	deviceId: z.string().min(1),
	isActive: z.boolean().optional(),
	provider: z.string().optional(),
	vehicleId: z.number().int(),
});

export const list = protectedProcedure
	.input(z.object({ vehicleId: z.number().int() }))
	.handler(async ({ context, input }) => {
		await verifyVehicleOwnership(input.vehicleId, context.user.id);
		return db
			.select()
			.from(gpsDevices)
			.where(eq(gpsDevices.vehicleId, input.vehicleId));
	});

export const create = protectedProcedure
	.input(gpsDeviceInputSchema)
	.handler(async ({ context, input }) => {
		await verifyVehicleOwnership(input.vehicleId, context.user.id);
		const [device] = await db.insert(gpsDevices).values(input).returning();
		return device;
	});

export const update = protectedProcedure
	.input(
		z.object({
			deviceId: z.string().min(1).optional(),
			id: z.number().int(),
			isActive: z.boolean().optional(),
			provider: z.string().optional(),
		}),
	)
	.handler(async ({ context, input }) => {
		const { id, ...data } = input;
		const [existing] = await db
			.select()
			.from(gpsDevices)
			.where(eq(gpsDevices.id, id));
		if (!existing) return null;
		await verifyVehicleOwnership(existing.vehicleId, context.user.id);
		const [device] = await db
			.update(gpsDevices)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(gpsDevices.id, id))
			.returning();
		return device ?? null;
	});

export const remove = protectedProcedure
	.input(z.object({ id: z.number().int() }))
	.handler(async ({ context, input }) => {
		const [existing] = await db
			.select()
			.from(gpsDevices)
			.where(eq(gpsDevices.id, input.id));
		if (!existing) return null;
		await verifyVehicleOwnership(existing.vehicleId, context.user.id);
		const [device] = await db
			.delete(gpsDevices)
			.where(eq(gpsDevices.id, input.id))
			.returning();
		return device ?? null;
	});
