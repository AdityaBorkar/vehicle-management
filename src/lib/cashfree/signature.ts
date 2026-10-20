/**
 * Cashfree 2FA request signature (`x-cf-signature` header).
 *
 * Required when "Public Key" is selected as the 2FA method in the Secure ID
 * dashboard. Scheme per Cashfree docs:
 *   1. data = `{clientId}.{unix timestamp in seconds}`
 *   2. RSA-encrypt with the Cashfree-issued public key (OAEP, SHA-1 —
 *      matches the PHP `OPENSSL_PKCS1_OAEP_PADDING` / Java
 *      `RSA/ECB/OAEPWithSHA-1AndMGF1Padding` examples)
 *   3. base64-encode the ciphertext
 *
 * Signatures are valid for 5 minutes — generate one per API call.
 */

import { constants, publicEncrypt } from "node:crypto";

import { CashfreeError } from "./errors";

/** `clientId.epochSeconds`, e.g. `CF12345.1729536000`. */
export function buildSignatureData(
	clientId: string,
	nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
	return `${clientId}.${nowSeconds}`;
}

/**
 * Encrypt `buildSignatureData(...)` with the PEM public key and return
 * base64 ciphertext for the `x-cf-signature` header. Throws
 * `CashfreeError` (`INVALID_PUBLIC_KEY`, 500) when the key does not parse
 * — a config problem, not a provider rejection.
 */
export function generateCfSignature(
	clientId: string,
	publicKeyPem: string,
	nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
	const data = buildSignatureData(clientId, nowSeconds);
	let encrypted: Buffer;
	try {
		encrypted = publicEncrypt(
			{
				key: publicKeyPem,
				oaepHash: "sha1",
				padding: constants.RSA_PKCS1_OAEP_PADDING,
			},
			Buffer.from(data, "utf8"),
		);
	} catch (err) {
		throw new CashfreeError(
			`CASHFREE_PUBLIC_KEY does not parse as an RSA public key: ${err instanceof Error ? err.message : String(err)}`,
			"INVALID_PUBLIC_KEY",
			500,
		);
	}
	return encrypted.toString("base64");
}
