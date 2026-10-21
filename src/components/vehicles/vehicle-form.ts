/**
 * Vehicle add/edit form model (client-safe).
 *
 * The vehicles page maps three shapes in and out of one string-based form:
 * Cashfree/cache lookup payloads, stored vehicle rows, and the create/update
 * RPC input. Centralizing the mappers here keeps the page from
 * triplicating ~50 field assignments and hides the `unknown`-record casts
 * in one place.
 */

import { toDateInput } from "#/lib/dates";

export type VehicleForm = {
	bodyType: string;
	color: string;
	cubicCapacity: string;
	emissionNorms: string;
	fatherName: string;
	financer: string;
	fitnessNumber: string;
	fitnessValidFrom: string;
	fitnessValidTill: string;
	fuelType: string;
	grossVehicleWeightKg: string;
	hypothecatedTo: string;
	hypothecation: string;
	id?: number;
	insuranceCompany: string;
	insurancePolicyNo: string;
	insuranceValidFrom: string;
	insuranceValidTill: string;
	make: string;
	manufacturerModel: string;
	manufacturingMonthYear: string;
	mobileNumber: string;
	model: string;
	officeCode: string;
	ownerName: string;
	ownershipSrNo: string;
	ownershipType: string;
	permanentAddress: string;
	permitNumber: string;
	permitType: string;
	permitValidFrom: string;
	permitValidTill: string;
	pollutionValidTill: string;
	presentAddress: string;
	pucNumber: string;
	registrationAuthority: string;
	registrationDate: string;
	registrationNumber: string;
	rtoCode: string;
	rtoName: string;
	seatingCapacity: string;
	taxValidTill: string;
	unladenWeightKg: string;
	vehicleClass: string;
	vin: string;
	wheelbase: string;
	year: string;
};

export const EMPTY_FORM: VehicleForm = {
	bodyType: "",
	color: "",
	cubicCapacity: "",
	emissionNorms: "",
	fatherName: "",
	financer: "",
	fitnessNumber: "",
	fitnessValidFrom: "",
	fitnessValidTill: "",
	fuelType: "",
	grossVehicleWeightKg: "",
	hypothecatedTo: "",
	hypothecation: "",
	insuranceCompany: "",
	insurancePolicyNo: "",
	insuranceValidFrom: "",
	insuranceValidTill: "",
	make: "",
	manufacturerModel: "",
	manufacturingMonthYear: "",
	mobileNumber: "",
	model: "",
	officeCode: "",
	ownerName: "",
	ownershipSrNo: "",
	ownershipType: "",
	permanentAddress: "",
	permitNumber: "",
	permitType: "",
	permitValidFrom: "",
	permitValidTill: "",
	pollutionValidTill: "",
	presentAddress: "",
	pucNumber: "",
	registrationAuthority: "",
	registrationDate: "",
	registrationNumber: "",
	rtoCode: "",
	rtoName: "",
	seatingCapacity: "",
	taxValidTill: "",
	unladenWeightKg: "",
	vehicleClass: "",
	vin: "",
	wheelbase: "",
	year: "",
};

export function sourceLabel(source: string): string {
	switch (source) {
		case "database":
			return "your garage";
		case "cache":
			return "cache";
		case "apiexpress":
			return "APIExpress";
		case "cashfree":
			return "Cashfree";
		default:
			return source;
	}
}

type LookupRecord = Record<string, string | number | null | undefined> & {
	registrationNumber: string;
	year?: number | null;
};

const str = (v: unknown) => (typeof v === "string" ? v : ((v ?? "") as string));

/** Map an autofill lookup payload onto the string form. */
export function lookupRecordToForm(
	d: LookupRecord,
	previous: VehicleForm,
): VehicleForm {
	return {
		...previous,
		bodyType: str(d["bodyType"]),
		color: str(d["color"]),
		cubicCapacity: str(d["cubicCapacity"]),
		emissionNorms: str(d["emissionNorms"]),
		fatherName: str(d["fatherName"]),
		financer: str(d["financer"]),
		fitnessNumber: str(d["fitnessNumber"]),
		fitnessValidFrom: str(d["fitnessValidFrom"]),
		fitnessValidTill: str(d["fitnessValidTill"]),
		fuelType: str(d["fuelType"]),
		grossVehicleWeightKg: str(d["grossVehicleWeightKg"]),
		hypothecatedTo: str(d["hypothecatedTo"]),
		hypothecation: str(d["hypothecation"]),
		insuranceCompany: str(d["insuranceCompany"]),
		insurancePolicyNo: str(d["insurancePolicyNo"]),
		insuranceValidFrom: str(d["insuranceValidFrom"]),
		insuranceValidTill: str(d["insuranceValidTill"]),
		make: str(d["make"]),
		manufacturerModel: str(d["manufacturerModel"]),
		manufacturingMonthYear: str(d["manufacturingMonthYear"]),
		mobileNumber: str(d["mobileNumber"]),
		model: str(d["model"]),
		officeCode: str(d["officeCode"]),
		ownerName: str(d["ownerName"]),
		ownershipSrNo: str(d["ownershipSrNo"]),
		ownershipType: str(d["ownershipType"]),
		permanentAddress: str(d["permanentAddress"]),
		permitNumber: str(d["permitNumber"]),
		permitType: str(d["permitType"]),
		permitValidFrom: str(d["permitValidFrom"]),
		permitValidTill: str(d["permitValidTill"]),
		pollutionValidTill: str(d["pollutionValidTill"]),
		presentAddress: str(d["presentAddress"]),
		pucNumber: str(d["pucNumber"]),
		registrationAuthority: str(d["registrationAuthority"]),
		registrationDate: str(d["registrationDate"]),
		registrationNumber: d.registrationNumber,
		rtoCode: str(d["rtoCode"]),
		rtoName: str(d["rtoName"]),
		seatingCapacity: str(d["seatingCapacity"]),
		taxValidTill: str(d["taxValidTill"]),
		unladenWeightKg: str(d["unladenWeightKg"]),
		vehicleClass: str(d["vehicleClass"]),
		vin: str(d["vin"]),
		wheelbase: str(d["wheelbase"]),
		year: d.year?.toString() ?? "",
	};
}

type VehicleRecord = Record<
	string,
	string | number | Date | null | undefined
> & {
	id: number;
	registrationNumber: string;
};

const s = (x: unknown) => (typeof x === "string" ? x : "");
const d = (x: unknown) => (x ? toDateInput(x as Date) : "");

/** Map a stored vehicle row onto the string form (edit mode). */
export function vehicleRecordToForm(vehicle: VehicleRecord): VehicleForm {
	const v = vehicle;
	return {
		...EMPTY_FORM,
		bodyType: s(v["bodyType"]),
		color: s(v["color"]),
		cubicCapacity: s(v["cubicCapacity"]),
		emissionNorms: s(v["emissionNorms"]),
		fatherName: s(v["fatherName"]),
		financer: s(v["financer"]),
		fitnessNumber: s(v["fitnessNumber"]),
		fitnessValidFrom: d(v["fitnessValidFrom"]),
		fitnessValidTill: d(v["fitnessValidTill"]),
		fuelType: s(v["fuelType"]),
		grossVehicleWeightKg: s(v["grossVehicleWeightKg"]),
		hypothecatedTo: s(v["hypothecatedTo"]),
		hypothecation: s(v["hypothecation"]),
		id: v.id,
		insuranceCompany: s(v["insuranceCompany"]),
		insurancePolicyNo: s(v["insurancePolicyNo"]),
		insuranceValidFrom: d(v["insuranceValidFrom"]),
		insuranceValidTill: d(v["insuranceValidTill"]),
		make: s(v["make"]),
		manufacturerModel: s(v["manufacturerModel"]),
		manufacturingMonthYear: s(v["manufacturingMonthYear"]),
		mobileNumber: s(v["mobileNumber"]),
		model: s(v["model"]),
		officeCode: s(v["officeCode"]),
		ownerName: s(v["ownerName"]),
		ownershipSrNo: s(v["ownershipSrNo"]),
		ownershipType: s(v["ownershipType"]),
		permanentAddress: s(v["permanentAddress"]),
		permitNumber: s(v["permitNumber"]),
		permitType: s(v["permitType"]),
		permitValidFrom: d(v["permitValidFrom"]),
		permitValidTill: d(v["permitValidTill"]),
		pollutionValidTill: d(v["pollutionValidTill"]),
		presentAddress: s(v["presentAddress"]),
		pucNumber: s(v["pucNumber"]),
		registrationAuthority: s(v["registrationAuthority"]),
		registrationDate: d(v["registrationDate"]),
		registrationNumber: v.registrationNumber,
		rtoCode: s(v["rtoCode"]),
		rtoName: s(v["rtoName"]),
		seatingCapacity: s(v["seatingCapacity"]),
		taxValidTill: d(v["taxValidTill"]),
		unladenWeightKg: s(v["unladenWeightKg"]),
		vehicleClass: s(v["vehicleClass"]),
		vin: s(v["vin"]),
		wheelbase: s(v["wheelbase"]),
		year: (v["year"] as number | null | undefined)?.toString() ?? "",
	};
}

/** Map the string form onto the create/update RPC input. */
export function formToCreateInput(draft: VehicleForm) {
	const opt = (v: string) => v || undefined;
	const optDate = (v: string) => (v ? new Date(v) : undefined);
	return {
		bodyType: opt(draft.bodyType),
		color: opt(draft.color),
		cubicCapacity: opt(draft.cubicCapacity),
		emissionNorms: opt(draft.emissionNorms),
		fatherName: opt(draft.fatherName),
		financer: opt(draft.financer),
		fitnessNumber: opt(draft.fitnessNumber),
		fitnessValidFrom: optDate(draft.fitnessValidFrom),
		fitnessValidTill: optDate(draft.fitnessValidTill),
		fuelType: (draft.fuelType || undefined) as
			| "Diesel"
			| "Petrol"
			| "CNG"
			| "EV"
			| "Other"
			| undefined,
		grossVehicleWeightKg: opt(draft.grossVehicleWeightKg),
		hypothecatedTo: opt(draft.hypothecatedTo),
		hypothecation: opt(draft.hypothecation),
		insuranceCompany: opt(draft.insuranceCompany),
		insurancePolicyNo: opt(draft.insurancePolicyNo),
		insuranceValidFrom: optDate(draft.insuranceValidFrom),
		insuranceValidTill: optDate(draft.insuranceValidTill),
		make: opt(draft.make),
		manufacturerModel: opt(draft.manufacturerModel),
		manufacturingMonthYear: opt(draft.manufacturingMonthYear),
		mobileNumber: opt(draft.mobileNumber),
		model: opt(draft.model),
		officeCode: opt(draft.officeCode),
		ownerName: opt(draft.ownerName),
		ownershipSrNo: opt(draft.ownershipSrNo),
		ownershipType: opt(draft.ownershipType),
		permanentAddress: opt(draft.permanentAddress),
		permitNumber: opt(draft.permitNumber),
		permitType: opt(draft.permitType),
		permitValidFrom: optDate(draft.permitValidFrom),
		permitValidTill: optDate(draft.permitValidTill),
		pollutionValidTill: optDate(draft.pollutionValidTill),
		presentAddress: opt(draft.presentAddress),
		pucNumber: opt(draft.pucNumber),
		registrationAuthority: opt(draft.registrationAuthority),
		registrationDate: optDate(draft.registrationDate),
		registrationNumber: draft.registrationNumber.trim(),
		rtoCode: opt(draft.rtoCode),
		rtoName: opt(draft.rtoName),
		seatingCapacity: opt(draft.seatingCapacity),
		taxValidTill: optDate(draft.taxValidTill),
		unladenWeightKg: opt(draft.unladenWeightKg),
		vehicleClass: opt(draft.vehicleClass),
		vin: draft.vin.trim() || undefined,
		wheelbase: opt(draft.wheelbase),
		year: draft.year ? Number(draft.year) : undefined,
	};
}
