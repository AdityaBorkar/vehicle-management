import { asText, parseApiDate, parseApiYear, pick } from "#/lib/rc/mapping";
import type { RcLookupFields } from "#/lib/rc/types";

export interface EnrichedRcLookup extends RcLookupFields {
	bodyType: string | null;
	cubicCapacity: string | null;
	emissionNorms: string | null;
	fatherName: string | null;
	financer: string | null;
	fitnessNumber: string | null;
	fitnessValidFrom: string | null;
	fuelTypeRaw: string | null;
	grossVehicleWeightKg: string | null;
	hypothecatedTo: string | null;
	hypothecation: string | null;
	insuranceCompany: string | null;
	insurancePolicyNo: string | null;
	insuranceValidFrom: string | null;
	manufacturerModel: string | null;
	manufacturingMonthYear: string | null;
	mobileNumber: string | null;
	officeCode: string | null;
	ownerName: string | null;
	ownershipSrNo: string | null;
	ownershipType: string | null;
	permanentAddress: string | null;
	permitNumber: string | null;
	permitType: string | null;
	permitValidFrom: string | null;
	permitValidTill: string | null;
	presentAddress: string | null;
	pucNumber: string | null;
	rcRaw: Record<string, unknown>;
	rcStatus: string | null;
	registrationAuthority: string | null;
	rtoCode: string | null;
	rtoName: string | null;
	seatingCapacity: string | null;
	taxValidTill: string | null;
	unladenWeightKg: string | null;
	vehicleClass: string | null;
	verificationId: string | null;
	wheelbase: string | null;
}

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
	return mapEnrichedRcResponse(body);
}

const CONSUMED_KEYS = new Set(
	[
		"vehicle_manufacturer_name",
		"manufacturer_name",
		"maker",
		"manufacturer",
		"make",
		"brand",
		"model",
		"model_name",
		"variant",
		"vehicle",
		"reg_date",
		"registration_date",
		"regn_date",
		"regndate",
		"date_of_registration",
		"vehicle_colour",
		"vehicle_color",
		"color",
		"colour",
		"rc_expiry_date",
		"fitness_valid",
		"fitness_upto",
		"fitness_validity",
		"fit_upto",
		"fitness",
		"type",
		"fuel",
		"fuel_type",
		"vehicle_insurance_upto",
		"insurance_valid",
		"insurance_upto",
		"insurance_validity",
		"insurance_expiry",
		"insurance",
		"chassis",
		"chassis_number",
		"chassis_no",
		"vin",
		"vehicle_manufacturing_month_year",
		"manufacturing_month_year",
		"manufacture_year",
		"mfg_year",
		"year_of_manufacture",
		"model_year",
		"year",
		"pucc_upto",
		"puc_valid",
		"puc_upto",
		"pucc_validity",
		"pollution_upto",
		"emission_valid",
		"puc",
		"owner_name",
		"owner",
		"father_name",
		"father",
		"present_address",
		"permanent_address",
		"mobile_number",
		"mobile",
		"phone",
		"vehicle_class",
		"class",
		"body_type",
		"manufacturer_model",
		"seating_capacity",
		"seating",
		"cubic_capacity",
		"wheelbase",
		"unladen_weight",
		"unladen_weight_kg",
		"gross_vehicle_weight",
		"gross_vehicle_weight_kg",
		"gvw",
		"rto_code",
		"rto",
		"rto_name",
		"office_code",
		"registration_authority",
		"registering_authority",
		"ownership_sr_no",
		"ownership",
		"ownership_type",
		"hypothecation",
		"hypothecated_to",
		"financer",
		"financed_by",
		"insurance_company",
		"insurance_policy_no",
		"policy_no",
		"insurance_valid_from",
		"insurance_from",
		"fitness_number",
		"fitness_valid_from",
		"fitness_from",
		"puc_number",
		"pucc_number",
		"permit_number",
		"permit_no",
		"permit_valid_from",
		"permit_from",
		"permit_valid_till",
		"permit_upto",
		"permit_validity",
		"permit_type",
		"tax_valid_till",
		"tax_upto",
		"road_tax_paid_till",
		"emission_norms",
		"fuel_norms",
		"norms",
		"status",
		"rc_status",
		"verification_id",
		"reference_id",
	].map((k) => k.toLowerCase()),
);

function remainderOf(body: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(body)) {
		if (!CONSUMED_KEYS.has(k.toLowerCase())) out[k] = v;
	}
	return out;
}

export function mapEnrichedRcResponse(
	body: Record<string, unknown>,
): EnrichedRcLookup {
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

	const fuelTypeRaw = asText(pick(body, "type", "fuel", "fuel_type"));

	return {
		bodyType: asText(pick(body, "body_type")),
		color: asText(
			pick(body, "vehicle_colour", "vehicle_color", "color", "colour"),
		),
		cubicCapacity: asText(pick(body, "cubic_capacity")),
		emissionNorms: asText(pick(body, "emission_norms", "fuel_norms", "norms")),
		fatherName: asText(pick(body, "father_name", "father")),
		financer: asText(pick(body, "financer", "financed_by")),
		fitnessNumber: asText(pick(body, "fitness_number")),
		fitnessValidFrom: parseApiDate(
			pick(body, "fitness_valid_from", "fitness_from"),
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
		fuelType: fuelTypeRaw,
		fuelTypeRaw,
		grossVehicleWeightKg: asText(
			pick(body, "gross_vehicle_weight_kg", "gross_vehicle_weight", "gvw"),
		),
		hypothecatedTo: asText(pick(body, "hypothecated_to")),
		hypothecation: asText(pick(body, "hypothecation")),
		insuranceCompany: asText(pick(body, "insurance_company")),
		insurancePolicyNo: asText(pick(body, "insurance_policy_no", "policy_no")),
		insuranceValidFrom: parseApiDate(
			pick(body, "insurance_valid_from", "insurance_from"),
		),
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
		manufacturerModel: asText(pick(body, "manufacturer_model")),
		manufacturingMonthYear: asText(
			pick(
				body,
				"vehicle_manufacturing_month_year",
				"manufacturing_month_year",
			),
		),
		mobileNumber: asText(pick(body, "mobile_number", "mobile", "phone")),
		model,
		officeCode: asText(pick(body, "office_code")),
		ownerName: asText(pick(body, "owner_name", "owner")),
		ownershipSrNo: asText(pick(body, "ownership_sr_no", "ownership")),
		ownershipType: asText(pick(body, "ownership_type")),
		permanentAddress: asText(pick(body, "permanent_address")),
		permitNumber: asText(pick(body, "permit_number", "permit_no")),
		permitType: asText(pick(body, "permit_type")),
		permitValidFrom: parseApiDate(
			pick(body, "permit_valid_from", "permit_from"),
		),
		permitValidTill: parseApiDate(
			pick(body, "permit_valid_till", "permit_upto", "permit_validity"),
		),
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
		presentAddress: asText(pick(body, "present_address")),
		pucNumber: asText(pick(body, "puc_number", "pucc_number")),
		rcRaw: remainderOf(body),
		rcStatus: asText(pick(body, "status", "rc_status")),
		registrationAuthority: asText(
			pick(body, "registration_authority", "registering_authority"),
		),
		registrationDate,
		rtoCode: asText(pick(body, "rto_code", "rto")),
		rtoName: asText(pick(body, "rto_name")),
		seatingCapacity: asText(pick(body, "seating_capacity", "seating")),
		taxValidTill: parseApiDate(
			pick(body, "tax_valid_till", "tax_upto", "road_tax_paid_till"),
		),
		unladenWeightKg: asText(pick(body, "unladen_weight_kg", "unladen_weight")),
		vehicleClass: asText(pick(body, "vehicle_class", "class")),
		verificationId: asText(pick(body, "verification_id", "reference_id")),
		vin: asText(pick(body, "chassis", "chassis_number", "chassis_no", "vin")),
		wheelbase: asText(pick(body, "wheelbase")),
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
