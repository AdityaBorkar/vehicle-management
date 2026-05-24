import { and, eq, lte } from "drizzle-orm";
import { z } from "zod";

import { reminders } from "@/db-schema";
import { db } from "@/lib/db/server";

import { authorized } from "../base";

const reminderInputSchema = z.object({
  driverId: z.number().int().optional(),
  dueDate: z.coerce.date(),
  licenseId: z.number().int().optional(),
  notifyDays: z.array(z.number().int()).optional(),
  title: z.string().min(1),
  type: z.enum([
    "insurance",
    "fitness",
    "pollution",
    "license",
    "dl_class",
    "custom",
  ]),
  vehicleId: z.number().int().optional(),
});

export const list = authorized.handler(async ({ context }) => {
  return db
    .select()
    .from(reminders)
    .where(eq(reminders.userId, context.user.id))
    .orderBy(reminders.dueDate);
});

export const getUpcoming = authorized
  .input(z.object({ days: z.number().int().default(30) }).optional())
  .handler(async ({ context, input }) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + (input?.days ?? 30));
    return db
      .select()
      .from(reminders)
      .where(
        and(
          eq(reminders.userId, context.user.id),
          eq(reminders.status, "active"),
          lte(reminders.dueDate, futureDate),
        ),
      )
      .orderBy(reminders.dueDate);
  });

export const create = authorized
  .input(reminderInputSchema)
  .handler(async ({ context, input }) => {
    const [reminder] = await db
      .insert(reminders)
      .values({
        ...input,
        userId: context.user.id,
      })
      .returning();
    return reminder;
  });

export const update = authorized
  .input(
    z.object({
      dueDate: z.coerce.date().optional(),
      id: z.number().int(),
      notifyDays: z.array(z.number().int()).optional(),
      status: z.enum(["active", "dismissed"]).optional(),
      title: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const [reminder] = await db
      .update(reminders)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(reminders.id, id), eq(reminders.userId, context.user.id)))
      .returning();
    return reminder ?? null;
  });

export const dismiss = authorized
  .input(z.object({ id: z.number().int() }))
  .handler(async ({ context, input }) => {
    const [reminder] = await db
      .update(reminders)
      .set({ status: "dismissed", updatedAt: new Date() })
      .where(
        and(eq(reminders.id, input.id), eq(reminders.userId, context.user.id)),
      )
      .returning();
    return reminder ?? null;
  });

export const remove = authorized
  .input(z.object({ id: z.number().int() }))
  .handler(async ({ context, input }) => {
    const [reminder] = await db
      .delete(reminders)
      .where(
        and(eq(reminders.id, input.id), eq(reminders.userId, context.user.id)),
      )
      .returning();
    return reminder ?? null;
  });
