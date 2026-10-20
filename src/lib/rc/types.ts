export interface RcLookupFields {
	color: string | null;
	fitnessValidTill: string | null;
	fuelType: string | null;
	insuranceValidTill: string | null;
	make: string | null;
	model: string | null;
	pollutionValidTill: string | null;
	registrationDate: string | null;
	vin: string | null;
	year: number | null;
}

export interface RcVerifySuccess {
	body: Record<string, unknown>;
	httpStatus: number;
}
