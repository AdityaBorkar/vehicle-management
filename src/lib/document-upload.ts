/**
 * Client-safe document upload helper (no Node imports — usable in components).
 *
 * Add/Edit and Renew dialogs both upload proof files through
 * `POST /api/documents/upload` before calling the vault procedures.
 * One helper keeps MIME/size checks, the vehicleReg+kind fields, and the
 * response parsing in a single place.
 */

export interface UploadedDocumentFile {
	fileKey: string;
	fileMime: string;
	fileName: string;
	fileSizeBytes: number;
}

const ALLOWED_MIMES = ["application/pdf", "image/jpeg", "image/png"] as const;
const MAX_BYTES = 10 * 1024 * 1024;

export function assertClientFileOk(file: File): void {
	if (!(ALLOWED_MIMES as readonly string[]).includes(file.type)) {
		throw new Error("Only PDF, JPEG or PNG files are allowed.");
	}
	if (file.size > MAX_BYTES) {
		throw new Error("File exceeds the 10 MB limit.");
	}
}

export async function uploadDocumentFile(
	file: File,
	opts: { vehicleReg?: string | undefined; kind?: string | undefined },
): Promise<UploadedDocumentFile> {
	assertClientFileOk(file);
	const form = new FormData();
	form.append("file", file);
	form.append("vehicleReg", opts.vehicleReg ?? "");
	form.append("kind", opts.kind ?? "document");
	const res = await fetch("/api/documents/upload", {
		body: form,
		method: "POST",
	});
	if (!res.ok) {
		throw new Error(`Upload failed: ${await res.text()}`);
	}
	return (await res.json()) as UploadedDocumentFile;
}
