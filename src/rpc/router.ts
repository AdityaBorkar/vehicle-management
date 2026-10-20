import * as aadharCard from "./procedures/aadhar-card";
import * as dieselCard from "./procedures/diesel-card";
import * as document from "./procedures/document";
import * as driver from "./procedures/driver";
import * as fastag from "./procedures/fastag";
import * as gpsDevice from "./procedures/gps-device";
import * as license from "./procedures/license";
import * as reminder from "./procedures/reminder";
import * as vehicle from "./procedures/vehicle";

export const router = {
	aadharCard,
	dieselCard,
	document,
	driver,
	fastag,
	gpsDevice,
	license,
	reminder,
	vehicle,
};

export type Router = typeof router;
