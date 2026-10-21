import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { deriveChassisLast5, puccArtifactUrl } from "#/lib/pucc";
import { orpc } from "#/lib/rpc";

interface UsePuccCertificateInput {
	registrationNumber: string;
	vehicleId: number;
	vin?: string | null | undefined;
}

/**
 * "Stored first, fetch on demand" PUCC flow.
 *
 * - `open()`: opens the latest stored certificate in a new tab when one
 *   exists, otherwise enqueues `workflow.startPucc` (chassis suffix derived
 *   from the vehicle's VIN) and opens the fresh PDF once the run succeeds.
 * - `busy`: true while a fetch is in flight.
 */
export function usePuccCertificate({
	registrationNumber,
	vehicleId,
	vin,
}: UsePuccCertificateInput) {
	const queryClient = useQueryClient();
	const [pendingRunId, setPendingRunId] = useState<number | null>(null);
	const placeholderTab = useRef<Window | null>(null);

	const latestQuery = useQuery(
		orpc.workflow.getLatestPucc.queryOptions({ input: { vehicleId } }),
	);
	const runQuery = useQuery(
		orpc.workflow.getRun.queryOptions({
			input: pendingRunId === null ? skipToken : { id: pendingRunId },
			refetchInterval: pendingRunId === null ? false : 3000,
		}),
	);

	const closePlaceholder = useCallback(() => {
		const tab = placeholderTab.current;
		placeholderTab.current = null;
		try {
			tab?.close();
		} catch {
			// Already closed — nothing to do.
		}
	}, []);

	const startPucc = useCallback(
		(chassisLast5: string) => {
			orpc.workflow.startPucc
				.call({ chassisLast5, registrationNumber, vehicleId })
				.then((run) => {
					setPendingRunId(run.id);
					toast.info("Fetching PUCC certificate — it will open when ready.");
				})
				.catch((err: unknown) => {
					closePlaceholder();
					toast.error(
						err instanceof Error ? err.message : "Failed to start PUCC fetch.",
					);
				});
		},
		[closePlaceholder, registrationNumber, vehicleId],
	);

	useEffect(() => {
		if (pendingRunId === null) return;
		const run = runQuery.data;
		if (runQuery.error) {
			setPendingRunId(null);
			closePlaceholder();
			toast.error("PUCC fetch failed. Please try again.");
			return;
		}
		if (!run) return;
		if (run.status === "succeeded") {
			setPendingRunId(null);
			const url = puccArtifactUrl(run.id);
			const tab = placeholderTab.current;
			placeholderTab.current = null;
			if (tab && !tab.closed) {
				tab.location.href = url;
			} else {
				window.open(url, "_blank", "noopener");
			}
			void latestQuery.refetch();
			void queryClient.invalidateQueries({
				queryKey: orpc.workflow.listRuns.key(),
			});
			toast.success("PUCC certificate ready.");
		} else if (run.status === "failed") {
			setPendingRunId(null);
			closePlaceholder();
			toast.error(run.error || "PUCC fetch failed. Please try again.");
		}
	}, [
		closePlaceholder,
		pendingRunId,
		runQuery.data,
		runQuery.error,
		latestQuery,
		queryClient,
	]);

	const open = useCallback(() => {
		const latest = latestQuery.data;
		if (latest) {
			window.open(puccArtifactUrl(latest.id), "_blank", "noopener");
			return;
		}
		if (pendingRunId !== null) return;
		if (latestQuery.isLoading) return;
		const chassisLast5 = deriveChassisLast5(vin);
		if (!chassisLast5) {
			toast.error(
				"No stored certificate and no usable chassis number — add the full VIN/chassis to this vehicle first.",
			);
			return;
		}
		// Open synchronously (user gesture) so popup blockers let it through;
		// navigate it to the PDF once the background run succeeds.
		try {
			const tab = window.open("about:blank", "_blank");
			if (tab) {
				tab.document.write(
					`<!doctype html><title>Fetching PUCC…</title><p style="font-family:sans-serif;padding:2rem">Fetching PUCC certificate for ${registrationNumber} — this can take a minute…</p>`,
				);
				tab.document.close();
				placeholderTab.current = tab;
			}
		} catch {
			placeholderTab.current = null;
		}
		startPucc(chassisLast5);
	}, [
		latestQuery.data,
		latestQuery.isLoading,
		pendingRunId,
		registrationNumber,
		startPucc,
		vin,
	]);

	return { busy: pendingRunId !== null, open };
}
