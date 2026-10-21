import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { orpc } from "#/lib/rpc";

interface TransactionHistoryTabProps {
	registrationNumber: string;
	vehicleId: number;
}

function formatDate(value: Date | string | null | undefined): string {
	if (!value) return "—";
	const d = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleDateString();
}

function formatDateTime(value: Date | string | null | undefined): string {
	if (!value) return "—";
	const d = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleString();
}

/**
 * "Transaction History" tab content for the Vehicle page.
 *
 * Shows the stored Vahan "Know Your Application Status" snapshot with a
 * Refresh button. Refresh enqueues the `vahan-transaction-history`
 * background workflow (Vahan login → Status → Know Your Application
 * Status → Vehicle Number radio → registration number → CAPTCHA →
 * Submit → extract + store) and polls `workflow.getRun` until it lands.
 */
export function TransactionHistoryTab({
	registrationNumber,
	vehicleId,
}: TransactionHistoryTabProps) {
	const queryClient = useQueryClient();
	const [pendingRunId, setPendingRunId] = useState<number | null>(null);

	const historyQuery = useQuery(
		orpc.vehicleTransaction.list.queryOptions({ input: { vehicleId } }),
	);
	const runQuery = useQuery(
		orpc.workflow.getRun.queryOptions({
			input: pendingRunId === null ? skipToken : { id: pendingRunId },
			refetchInterval: pendingRunId === null ? false : 3000,
		}),
	);

	const busy = pendingRunId !== null;
	const refreshing = busy || historyQuery.isFetching;

	const handleRefresh = useCallback(() => {
		if (pendingRunId !== null) return;
		orpc.vehicleTransaction.refresh
			.call({ registrationNumber, vehicleId })
			.then((run) => {
				setPendingRunId(run.id);
				toast.info(
					"Fetching latest transaction history — this can take a minute.",
				);
			})
			.catch((err: unknown) => {
				toast.error(
					err instanceof Error ? err.message : "Failed to start refresh.",
				);
			});
	}, [pendingRunId, registrationNumber, vehicleId]);

	useEffect(() => {
		if (pendingRunId === null) return;
		if (runQuery.error) {
			setPendingRunId(null);
			toast.error("Transaction refresh failed. Please try again.");
			return;
		}
		const run = runQuery.data;
		if (!run) return;
		if (run.status === "succeeded") {
			setPendingRunId(null);
			void historyQuery.refetch();
			void queryClient.invalidateQueries({
				queryKey: orpc.workflow.listRuns.key(),
			});
			toast.success("Transaction history updated.");
		} else if (run.status === "failed") {
			setPendingRunId(null);
			toast.error(run.error || "Transaction refresh failed. Please try again.");
		}
	}, [pendingRunId, runQuery.data, runQuery.error, historyQuery, queryClient]);

	const rows = historyQuery.data ?? [];
	const lastFetched = rows.reduce<Date | null>((latest, r) => {
		const d = r.fetchedAt ? new Date(r.fetchedAt) : null;
		if (!d || Number.isNaN(d.getTime())) return latest;
		if (!latest || d > latest) return d;
		return latest;
	}, null);

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
						<History className="h-5 w-5 text-primary" />
					</div>
					<div>
						<CardTitle className="text-base">Transaction History</CardTitle>
						<p className="text-muted-foreground text-sm">
							Vahan · Know Your Application Status · {registrationNumber}
							{lastFetched
								? ` · Last fetched ${formatDateTime(lastFetched)}`
								: " · Never fetched"}
						</p>
					</div>
				</div>
				<Button
					disabled={refreshing}
					onClick={handleRefresh}
					size="sm"
					type="button"
					variant="outline"
				>
					{refreshing ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<RefreshCw className="mr-2 h-4 w-4" />
					)}
					{busy ? "Fetching…" : "Refresh"}
				</Button>
			</CardHeader>
			<CardContent>
				{historyQuery.isLoading ? (
					<p className="text-muted-foreground text-sm">Loading…</p>
				) : historyQuery.error ? (
					<p className="text-destructive text-sm">
						Failed to load transaction history.{" "}
						<button
							className="underline"
							onClick={() => void historyQuery.refetch()}
							type="button"
						>
							Retry
						</button>
					</p>
				) : rows.length === 0 ? (
					<div className="py-6 text-center">
						<p className="text-muted-foreground text-sm">
							No transaction history stored yet.
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							Click Refresh to fetch it from Vahan (login → Status → Know Your
							Application Status → CAPTCHA → Submit).
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{busy && (
							<p className="text-muted-foreground text-xs">
								Refresh in progress (run #{pendingRunId}) — the table below
								shows the last stored snapshot and will update automatically.
							</p>
						)}
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Application No</TableHead>
									<TableHead>Service / Transaction</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Date</TableHead>
									<TableHead>Remarks</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((row) => (
									<TableRow key={row.id}>
										<TableCell className="font-mono text-xs">
											{row.applicationNumber || "—"}
										</TableCell>
										<TableCell>{row.serviceType || "—"}</TableCell>
										<TableCell>
											{row.status ? (
												<Badge
													variant={
														/approv|success|complete|done/i.test(row.status)
															? "default"
															: /reject|fail|cancel/i.test(row.status)
																? "destructive"
																: "secondary"
													}
												>
													{row.status}
												</Badge>
											) : (
												"—"
											)}
										</TableCell>
										<TableCell>{formatDate(row.transactionDate)}</TableCell>
										<TableCell className="max-w-64 truncate">
											{row.remarks || "—"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
