import { asText, parseApiDate, parseApiYear, pick } from "#/lib/rc/mapping";
import type { RcLookupFields } from "#/lib/rc/types";

/**
 * Map a Cashfree Vehicle RC response to vehicle lookup fields.
 * Unknown / missing fields stay null — never throws on shape drift.
 *
 * Cashfree key names differ from APIExpress (`vehicle_manufacturer_name`,
 * `type` for fuel, `reg_date`, `vehicle_insurance_upto`, `pucc_upto`,
 * `vehicle_colour`), so aliases from both providers are accepted — a cached
 * row from either provider maps correctly.
 */
export function mapRcResponseToLookup(
	body: Record<string, unknown>,
): RcLookupFields {
	let make = asText(
		pick(
			body,
			"vehicle_manufacturer_name",
			"manufacturer_name",
			"maker",
			"manufacturer",
			"make",
			"brand",
		),
	);
	let model = asText(pick(body, "model", "model_name", "variant"));
	const combined = asText(pick(body, "vehicle"));
	if ((!make || !model) && combined) {
		const [first, ...rest] = combined.split(" ");
		if (!make && first) make = first;
		if (!model && rest.length > 0) model = rest.join(" ");
	}

	const registrationDate = parseApiDate(
		pick(
			body,
			"reg_date",
			"registration_date",
			"regn_date",
			"regndate",
			"date_of_registration",
		),
	);

	return {
		color: asText(
			pick(body, "vehicle_colour", "vehicle_color", "color", "colour"),
		),
		fitnessValidTill: parseApiDate(
			pick(
				body,
				"rc_expiry_date",
				"fitness_valid",
				"fitness_upto",
				"fitness_validity",
				"fit_upto",
				"fitness",
			),
		),
		fuelType: asText(pick(body, "type", "fuel", "fuel_type")),
		insuranceValidTill: parseApiDate(
			pick(
				body,
				"vehicle_insurance_upto",
				"insurance_valid",
				"insurance_upto",
				"insurance_validity",
				"insurance_expiry",
				"insurance",
			),
		),
		make,
		model,
		pollutionValidTill: parseApiDate(
			pick(
				body,
				"pucc_upto",
				"puc_valid",
				"puc_upto",
				"pucc_validity",
				"pollution_upto",
				"emission_valid",
				"puc",
			),
		),
		registrationDate,
		vin: asText(pick(body, "chassis", "chassis_number", "chassis_no", "vin")),
		year:
			parseApiYear(
				pick(
					body,
					"vehicle_manufacturing_month_year",
					"manufacturing_month_year",
					"manufacture_year",
					"mfg_year",
					"year_of_manufacture",
					"model_year",
					"year",
				),
			) ?? (registrationDate ? Number(registrationDate.slice(0, 4)) : null),
	};
}

/** Alias kept for call-site clarity; identical to `mapRcResponseToLookup`. */
export const mapCashfreeResponseToLookup = mapRcResponseToLookup;
