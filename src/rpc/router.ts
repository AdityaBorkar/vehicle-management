import * as aadharCard from "./procedures/aadhar-card";
import * as debug from "./procedures/debug";
import * as document from "./procedures/document";
import * as driver from "./procedures/driver";
import * as fastag from "./procedures/fastag";
import * as gpsDevice from "./procedures/gps-device";
import * as license from "./procedures/license";
import * as reminder from "./procedures/reminder";
import * as vehicle from "./procedures/vehicle";
import * as vehicleTransaction from "./procedures/vehicle-transaction";
import * as workflow from "./procedures/workflow";

export const router = {
	aadharCard,
	debug,
	document,
	driver,
	fastag,
	gpsDevice,
	license,
	reminder,
	vehicle,
	vehicleTransaction,
	workflow,
};

export type Router = typeof router;
