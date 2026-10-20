/**
 * Server-only Cashfree entrypoint (barrel).
 *
 * Never import this module from client components — it reads the
 * `CASHFREE_CLIENT_ID` / `CASHFREE_CLIENT_SECRET` secrets (plus the
 * optional `CASHFREE_PUBLIC_KEY` for 2FA signing) from the server
 * environment. The implementation lives in `config.ts` / `errors.ts` /
 * `client.ts` / `mapping.ts` / `signature.ts`; shared retry, error and
 * field-parsing primitives live in `#/lib/rc/`.
 */

export type { RcLookupFields, RcVerifySuccess } from "#/lib/rc/types";
export { cashfreeProviderError, verifyRc } from "./client";
export type { CashfreeEnv } from "./config";
export {
	buildVerificationId,
	CASHFREE_ENDPOINT_PATH,
	CASHFREE_LOG_PREFIX,
	CASHFREE_PRODUCTION_BASE_URL,
	CASHFREE_SANDBOX_BASE_URL,
	getCashfreeBaseUrl,
	getCashfreeCredentials,
	getCashfreeEndpoint,
	getCashfreePublicKey,
} from "./config";
export { CashfreeError, isCashfreeError } from "./errors";
export {
	mapCashfreeResponseToLookup,
	mapRcResponseToLookup,
} from "./mapping";
export { buildSignatureData, generateCfSignature } from "./signature";
