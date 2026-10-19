import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { vehicles } from "#/db-schema";
import { db } from "#/lib/db/server";

import { authorized } from "../base";

const vehicleInputSchema = z.object({
  color: z.string().optional(),
  fitnessValidTill: z.coerce.date().optional(),
  fuelType: z.enum(["Diesel", "Petrol", "CNG", "EV", "Other"]).optional(),
  insuranceValidTill: z.coerce.date().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  pollutionValidTill: z.coerce.date().optional(),
  registrationDate: z.coerce.date().optional(),
  registrationNumber: z.string().min(1),
  year: z.number().int().min(1900).max(2100).optional(),
});

const vehicleUpdateSchema = z.object({
  color: z.string().optional(),
  fitnessValidTill: z.coerce.date().optional().nullable(),
  fuelType: z.enum(["Diesel", "Petrol", "CNG", "EV", "Other"]).optional(),
  id: z.number().int(),
  insuranceValidTill: z.coerce.date().optional().nullable(),
  make: z.string().optional(),
  model: z.string().optional(),
  pollutionValidTill: z.coerce.date().optional().nullable(),
  registrationDate: z.coerce.date().optional().nullable(),
  registrationNumber: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
});

export const list = authorized.handler(async ({ context }) => {
  return db
    .select()
    .from(vehicles)
    .where(eq(vehicles.userId, context.user.id))
    .orderBy(vehicles.createdAt);
});

export const getById = authorized
  .input(z.object({ id: z.number().int() }))
  .handler(async ({ context, input }) => {
    const [vehicle] = await db
      .select()
      .from(vehicles)
      .where(
        and(eq(vehicles.id, input.id), eq(vehicles.userId, context.user.id)),
      );
    return vehicle ?? null;
  });

export const create = authorized
  .input(vehicleInputSchema)
  .handler(async ({ context, input }) => {
    const [vehicle] = await db
      .insert(vehicles)
      .values({
        ...input,
        userId: context.user.id,
      })
      .returning();
    return vehicle;
  });

export const update = authorized
  .input(vehicleUpdateSchema)
  .handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const [vehicle] = await db
      .update(vehicles)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(vehicles.id, id), eq(vehicles.userId, context.user.id)))
      .returning();
    return vehicle ?? null;
  });

export const remove = authorized
  .input(z.object({ id: z.number().int() }))
  .handler(async ({ context, input }) => {
    const [vehicle] = await db
      .delete(vehicles)
      .where(
        and(eq(vehicles.id, input.id), eq(vehicles.userId, context.user.id)),
      )
      .returning();
    return vehicle ?? null;
  });
