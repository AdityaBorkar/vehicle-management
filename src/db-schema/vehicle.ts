import {
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const vehicles = pgTable(
	"vehicles",
	{
		color: text(),
		createdAt: timestamp("created_at", {
			mode: "date",
			withTimezone: true,
		}).defaultNow(),
		fitnessValidTill: timestamp("fitness_valid_till", {
			mode: "date",
			withTimezone: true,
		}),
		fuelType: text("fuel_type"),
		id: serial().primaryKey(),
		insuranceValidTill: timestamp("insurance_valid_till", {
			mode: "date",
			withTimezone: true,
		}),
		make: text(),
		model: text(),
		pollutionValidTill: timestamp("pollution_valid_till", {
			mode: "date",
			withTimezone: true,
		}),
		registrationDate: timestamp("registration_date", {
			mode: "date",
			withTimezone: true,
		}),
		registrationNumber: text("registration_number").notNull(),
		updatedAt: timestamp("updated_at", {
			mode: "date",
			withTimezone: true,
		}).defaultNow(),
		userId: text("user_id").notNull(),
		vin: text(),
		year: integer(),
	},
	(t) => [uniqueIndex("vehicles_reg_unique").on(t.registrationNumber)],
);
