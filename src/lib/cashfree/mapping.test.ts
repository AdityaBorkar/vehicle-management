import { describe, expect, it } from "vitest";

import {
	mapEnrichedRcResponse,
	mapRcResponseToLookup,
} from "#/lib/cashfree/mapping";

const CASHFREE_FIXTURE: Record<string, unknown> = {
	body_type: "TRUCK",
	chassis_number: "MAT12345678901234",
	cubic_capacity: "2500",
	emission_norms: "BS-IV",
	father_name: "RAMESH KUMAR",
	financer: "HDFC BANK",
	gross_vehicle_weight_kg: "7500",
	hypothecated_to: "HDFC BANK",
	hypothecation: "YES",
	insurance_company: "ICICI Lombard",
	insurance_policy_no: "3001/A/123",
	manufacturer_model: "TATA 407",
	mobile_number: "9820098200",
	office_code: "MH01",
	owner_name: "SURESH KUMAR",
	ownership_sr_no: "1",
	ownership_type: "INDIVIDUAL",
	permanent_address: "MUMBAI",
	permit_number: "MH01/2024/12345",
	permit_type: "GOODS",
	permit_valid_from: "01-Jan-2024",
	permit_valid_till: "31-Dec-2028",
	present_address: "ANDHERI MUMBAI",
	puc_number: "MH0123456789",
	reg_date: "15-Mar-2019",
	rto_code: "MH01",
	rto_name: "MUMBAI CENTRAL",
	seating_capacity: "3",
	status: "VALID",
	tax_valid_till: "14-Mar-2034",
	type: "Diesel",
	unladen_weight_kg: "2600",
	vehicle_class: "LMV",
	vehicle_colour: "WHITE",
	vehicle_insurance_upto: "14-Mar-2026",
	vehicle_manufacturer_name: "TATA",
	vehicle_manufacturing_month_year: "02/2019",
	verification_id: "vm-MH01CR7464-123",
	version: "v2",
	wheelbase: "2900",
};

describe("mapRcResponseToLookup (back-compat subset)", () => {
	it("maps the original ten fields", () => {
		const fields = mapRcResponseToLookup(CASHFREE_FIXTURE);
		expect(fields.make).toBe("TATA");
		expect(fields.color).toBe("WHITE");
		expect(fields.registrationDate).toBe("2019-03-15");
		expect(fields.insuranceValidTill).toBe("2026-03-14");
		expect(fields.vin).toBe("MAT12345678901234");
		expect(fields.year).toBe(2019);
	});
});

describe("mapEnrichedRcResponse", () => {
	it("maps every vehicle column and preserves unmapped keys in rc_raw", () => {
		const fields = mapEnrichedRcResponse(CASHFREE_FIXTURE);
		expect(fields.ownerName).toBe("SURESH KUMAR");
		expect(fields.fatherName).toBe("RAMESH KUMAR");
		expect(fields.hypothecation).toBe("YES");
		expect(fields.hypothecatedTo).toBe("HDFC BANK");
		expect(fields.financer).toBe("HDFC BANK");
		expect(fields.vehicleClass).toBe("LMV");
		expect(fields.permitNumber).toBe("MH01/2024/12345");
		expect(fields.permitValidTill).toBe("2028-12-31");
		expect(fields.pucNumber).toBe("MH0123456789");
		expect(fields.taxValidTill).toBe("2034-03-14");
		expect(fields.rcStatus).toBe("VALID");
		expect(fields.verificationId).toBe("vm-MH01CR7464-123");
		expect(fields.rcRaw).toEqual({ version: "v2" });
	});

	it("accepts APIExpress-style aliases too", () => {
		const fields = mapEnrichedRcResponse({
			color: "RED",
			fuel: "Petrol",
			maker: "MARUTI",
			regn_date: "2020-05-01",
		});
		expect(fields.make).toBe("MARUTI");
		expect(fields.color).toBe("RED");
		expect(fields.fuelTypeRaw).toBe("Petrol");
		expect(fields.registrationDate).toBe("2020-05-01");
	});

	it("never throws on shape drift; unparseable dates stay null", () => {
		const fields = mapEnrichedRcResponse({
			owner_name: 12345,
			reg_date: "not-a-date",
			status: "VALID",
		});
		expect(fields.ownerName).toBe("12345");
		expect(fields.registrationDate).toBeNull();
		expect(fields.rcRaw).toEqual({});
	});
});

describe("remainder rule (Spec 04)", () => {
	it("preserves sleeper/standing capacities in rc_raw instead of dropping them", async () => {
		const { mapEnrichedRcResponse } = await import("#/lib/cashfree/mapping");
		const fields = mapEnrichedRcResponse({
			sleeper_capacity: "2",
			standing_capacity: "10",
			status: "VALID",
		});
		expect(fields.rcRaw).toMatchObject({
			sleeper_capacity: "2",
			standing_capacity: "10",
		});
	});
});
