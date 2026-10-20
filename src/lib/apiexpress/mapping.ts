import { asText, parseApiDate, parseApiYear, pick } from "#/lib/rc/mapping";
import type { RcLookupFields } from "#/lib/rc/types";

/**
 * Map an APIExpress RC response to vehicle lookup fields.
 * Unknown / missing fields stay null — never throws on shape drift.
 */
export function mapRcResponseToLookup(
	body: Record<string, unknown>,
): RcLookupFields {
	let make = asText(pick(body, "maker", "manufacturer", "make", "brand"));
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
			"registration_date",
			"regn_date",
			"reg_date",
			"date_of_registration",
			"regndate",
		),
	);

	return {
		color: asText(pick(body, "color", "colour")),
		fitnessValidTill: parseApiDate(
			pick(
				body,
				"fitness_valid",
				"fitness_upto",
				"fitness_validity",
				"fit_upto",
				"fitness",
			),
		),
		fuelType: asText(pick(body, "fuel", "fuel_type")),
		insuranceValidTill: parseApiDate(
			pick(
				body,
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
				"puc_valid",
				"puc_upto",
				"pucc_validity",
				"pollution_upto",
				"emission_valid",
				"puc",
			),
		),
		registrationDate,
		vin: asText(pick(body, "chassis_number", "chassis_no", "chassis", "vin")),
		year:
			parseApiYear(
				pick(
					body,
					"manufacture_year",
					"mfg_year",
					"year_of_manufacture",
					"model_year",
					"year",
				),
			) ?? (registrationDate ? Number(registrationDate.slice(0, 4)) : null),
	};
}
