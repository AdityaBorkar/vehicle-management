import type { RouterClient } from "@orpc/server";

import type { Router } from "#/rpc/router";

export type DocItem = Awaited<
	ReturnType<RouterClient<Router>["document"]["list"]>
>[number];

export const KIND_LABELS: Record<string, string> = {
	aadhar: "Aadhar",
	dl_class: "DL Class",
	driving_license: "Driving License",
	fitness: "Fitness",
	form20: "Form 20 (Sale/Purchase)",
	goods_permit: "Goods Permit",
	insurance: "Insurance",
	other: "Other",
	permit: "Permit",
	pollution: "Pollution (PUC)",
	purchase_order: "Purchase Order",
	registration: "Registration (RC)",
	speed_governor: "Speed Governor",
	tax: "Tax",
};

export const KIND_HELP: Record<string, string> = {
	form20: "Proof of sale/purchase. Valid-from required, Valid-till optional.",
	goods_permit:
		"Goods Permit has no expiry \u2014 Valid-till stays empty and is excluded from overdue.",
	purchase_order:
		"Optional document \u2014 never blocks compliance. Valid-till optional.",
	speed_governor:
		"Speed Governor Certificate has no expiry. Store the certificate no. in Policy/Cert No.",
};

export const VEHICLE_EXPIRY_FIELDS = {
	fitness: "fitnessValidTill",
	insurance: "insuranceValidTill",
	pollution: "pollutionValidTill",
} as const;
