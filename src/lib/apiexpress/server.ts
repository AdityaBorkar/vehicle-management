/**
 * Server-only APIExpress entrypoint (barrel).
 *
 * Never import this module from client components — it reads the secret
 * API key from the server environment. The implementation lives in
 * `config.ts` / `errors.ts` / `client.ts` / `mapping.ts`; shared retry,
 * error and field-parsing primitives live in `#/lib/rc/`.
 */

export type { RcLookupFields, RcVerifySuccess } from "#/lib/rc/types";
export { verifyRc } from "./client";
export {
	APIEXPRESS_ENDPOINT_PATH,
	APIEXPRESS_LOG_PREFIX,
	APIEXPRESS_RC_VERIFY_ENDPOINT,
} from "./config";
export { ApiExpressError, isApiExpressError } from "./errors";
export { mapRcResponseToLookup } from "./mapping";
