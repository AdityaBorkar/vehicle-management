export const DOCUMENT_KINDS = [
	"insurance",
	"fitness",
	"pollution",
	"registration",
	"permit",
	"tax",
	"driving_license",
	"dl_class",
	"aadhar",
	"other",
	"goods_permit",
	"speed_governor",
	"purchase_order",
	"form20",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const MANUAL_DOCUMENT_KINDS = [
	"goods_permit",
	"speed_governor",
	"purchase_order",
	"form20",
] as const;

export const NO_EXPIRY_KINDS = ["goods_permit", "speed_governor"] as const;

export const ALLOWED_DOCUMENT_MIMES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
] as const;

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function validateDocumentFile(input: {
	fileKey?: string | undefined;
	fileMime?: string | undefined;
	fileSizeBytes?: number | undefined;
}): string | null {
	if (!input.fileKey) return null;
	if (!input.fileKey.startsWith("uploads/documents/")) {
		return "Invalid file key.";
	}
	if (
		input.fileMime &&
		!(ALLOWED_DOCUMENT_MIMES as readonly string[]).includes(input.fileMime)
	) {
		return "Only PDF, JPEG or PNG files are allowed.";
	}
	if (
		typeof input.fileSizeBytes === "number" &&
		input.fileSizeBytes > MAX_DOCUMENT_BYTES
	) {
		return "File exceeds the 10 MB limit.";
	}
	return null;
}

export function validateManualDocument(input: {
	expiryDate?: Date | undefined;
	fileKey?: string | undefined;
	fileMime?: string | undefined;
	fileSizeBytes?: number | undefined;
	issueDate?: Date | undefined;
	kind: string;
	vehicleId?: number | undefined;
}): string | null {
	if (!(MANUAL_DOCUMENT_KINDS as readonly string[]).includes(input.kind)) {
		return null;
	}
	if (!input.vehicleId) return "Vehicle is required for this document kind.";
	if (!input.issueDate) return "Valid-from date is required.";
	if ((NO_EXPIRY_KINDS as readonly string[]).includes(input.kind)) {
		if (input.expiryDate)
			return "This document kind has no expiry — leave Valid-till empty.";
	}
	if (!input.fileKey)
		return "A file upload is required for this document kind.";
	return validateDocumentFile({
		fileKey: input.fileKey,
		fileMime: input.fileMime,
		fileSizeBytes: input.fileSizeBytes,
	});
}
