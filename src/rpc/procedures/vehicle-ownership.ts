import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { vehicles } from "#/db-schema";
import { db } from "#/lib/db";

/** Throws NOT_FOUND when the vehicle does not exist or belongs to another user. */
export async function verifyVehicleOwnership(
	vehicleId: number,
	userId: string,
) {
	const [vehicle] = await db
		.select({ id: vehicles.id })
		.from(vehicles)
		.where(and(eq(vehicles.id, vehicleId), eq(vehicles.userId, userId)));
	if (!vehicle)
		throw new ORPCError("NOT_FOUND", { message: "Vehicle not found" });
	return vehicle;
}
