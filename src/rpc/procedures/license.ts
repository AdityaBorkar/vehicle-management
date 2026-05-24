import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { drivingLicenses } from "@/db-schema";
import { db } from "@/lib/db/server";

import { authorized } from "../base";

const licenseInputSchema = z.object({
  address: z.string().optional(),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional(),
  dateOfBirth: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  holderName: z.string().min(1),
  issueDate: z.coerce.date().optional(),
  licenseNumber: z.string().min(1),
  vehicleClasses: z.string().optional(),
});

const licenseUpdateSchema = z.object({
  address: z.string().optional(),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  holderName: z.string().min(1).optional(),
  id: z.number().int(),
  issueDate: z.coerce.date().optional().nullable(),
  licenseNumber: z.string().min(1).optional(),
  vehicleClasses: z.string().optional(),
});

export const list = authorized.handler(async ({ context }) => {
  return db
    .select()
    .from(drivingLicenses)
    .where(eq(drivingLicenses.userId, context.user.id))
    .orderBy(drivingLicenses.createdAt);
});

export const getById = authorized
  .input(z.object({ id: z.number().int() }))
  .handler(async ({ context, input }) => {
    const [license] = await db
      .select()
      .from(drivingLicenses)
      .where(
        and(
          eq(drivingLicenses.id, input.id),
          eq(drivingLicenses.userId, context.user.id),
        ),
      );
    return license ?? null;
  });

export const create = authorized
  .input(licenseInputSchema)
  .handler(async ({ context, input }) => {
    const [license] = await db
      .insert(drivingLicenses)
      .values({
        ...input,
        userId: context.user.id,
      })
      .returning();
    return license;
  });

export const update = authorized
  .input(licenseUpdateSchema)
  .handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const [license] = await db
      .update(drivingLicenses)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(drivingLicenses.id, id),
          eq(drivingLicenses.userId, context.user.id),
        ),
      )
      .returning();
    return license ?? null;
  });

export const remove = authorized
  .input(z.object({ id: z.number().int() }))
  .handler(async ({ context, input }) => {
    const [license] = await db
      .delete(drivingLicenses)
      .where(
        and(
          eq(drivingLicenses.id, input.id),
          eq(drivingLicenses.userId, context.user.id),
        ),
      )
      .returning();
    return license ?? null;
  });
