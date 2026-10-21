import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { orpc } from "#/lib/rpc";

export const Route = createFileRoute("/(app)/(debug)/workflows")({
	component: WorkflowsPage,
});

function WorkflowsPage() {
	const queryClient = useQueryClient();
	const [registrationNumber, setRegistrationNumber] = useState("");
	const [chassisLast5, setChassisLast5] = useState("");
	const [txReg, setTxReg] = useState("");
	const [txVehicleId, setTxVehicleId] = useState("");
	const puccRegId = useId();
	const puccChassisId = useId();
	const txRegId = useId();
	const txVehicleIdInput = useId();

	const { data: runs, isLoading } = useQuery(
		orpc.workflow.listRuns.queryOptions({ input: {} }),
	);

	const startPucc = useMutation(
		orpc.workflow.startPucc.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: (run) => {
				toast.success(`PUCC run #${run.id} queued`);
				setRegistrationNumber("");
				setChassisLast5("");
				void queryClient.invalidateQueries({
					queryKey: orpc.workflow.listRuns.key(),
				});
			},
		}),
	);

	const startTx = useMutation(
		orpc.vehicleTransaction.refresh.mutationOptions({
			onError: (err) => toast.error(err.message),
			onSuccess: (run) => {
				toast.success(`Transaction-history run #${run.id} queued`);
				setTxReg("");
				setTxVehicleId("");
				void queryClient.invalidateQueries({
					queryKey: orpc.workflow.listRuns.key(),
				});
			},
		}),
	);

	return (
		<div className="space-y-6">
			<h1 className="font-bold text-2xl">Workflows</h1>

			<Card>
				<CardHeader className="flex flex-row items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
						<FlaskConical className="h-5 w-5 text-primary" />
					</div>
					<div>
						<CardTitle className="text-base">PUC Certificate (async)</CardTitle>
						<p className="text-muted-foreground text-sm">
							Enqueues a background browser run: PUC portal + Meta AI CAPTCHA
							solve + PDF artifact
						</p>
					</div>
				</CardHeader>
				<CardContent>
					<form
						className="flex flex-col gap-3 sm:flex-row sm:items-end"
						onSubmit={(e) => {
							e.preventDefault();
							startPucc.mutate({ chassisLast5, registrationNumber });
						}}
					>
						<label className="grid flex-1 gap-1 text-sm" htmlFor={puccRegId}>
							<span className="text-muted-foreground">Registration number</span>
							<Input
								id={puccRegId}
								onChange={(e) => setRegistrationNumber(e.target.value)}
								placeholder="MH01CR7464"
								value={registrationNumber}
							/>
						</label>
						<label
							className="grid w-full gap-1 text-sm sm:w-48"
							htmlFor={puccChassisId}
						>
							<span className="text-muted-foreground">
								Chassis last 5 chars
							</span>
							<Input
								id={puccChassisId}
								maxLength={5}
								onChange={(e) => setChassisLast5(e.target.value)}
								placeholder="12345"
								value={chassisLast5}
							/>
						</label>
						<Button disabled={startPucc.isPending} type="submit">
							{startPucc.isPending ? "Queueing…" : "Fetch PUCC"}
						</Button>
					</form>
					<p className="mt-3 text-muted-foreground text-xs">
						Runs serially (concurrency 1 — the PUC portal blocks multiple tabs).
						Poll the list below or{" "}
						<code className="font-mono">bun run workflow -- pucc …</code> for
						CLI debugging. PDFs land in{" "}
						<code className="font-mono">.local/artifacts/pucc/</code> (or{" "}
						<code className="font-mono">$ARTIFACT_DIR</code>).
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
						<FlaskConical className="h-5 w-5 text-primary" />
					</div>
					<div>
						<CardTitle className="text-base">
							Transaction History (async)
						</CardTitle>
						<p className="text-muted-foreground text-sm">
							Enqueues a background run: Vahan login → Status → Know Your
							Application Status → Vehicle Number → CAPTCHA → Submit → store
						</p>
					</div>
				</CardHeader>
				<CardContent>
					<form
						className="flex flex-col gap-3 sm:flex-row sm:items-end"
						onSubmit={(e) => {
							e.preventDefault();
							const vehicleId = Number(txVehicleId);
							if (!Number.isInteger(vehicleId)) {
								toast.error("Enter a numeric vehicle ID.");
								return;
							}
							startTx.mutate({ registrationNumber: txReg, vehicleId });
						}}
					>
						<label className="grid flex-1 gap-1 text-sm" htmlFor={txRegId}>
							<span className="text-muted-foreground">Registration number</span>
							<Input
								id={txRegId}
								onChange={(e) => setTxReg(e.target.value)}
								placeholder="MH01CR7464"
								value={txReg}
							/>
						</label>
						<label
							className="grid w-full gap-1 text-sm sm:w-48"
							htmlFor={txVehicleIdInput}
						>
							<span className="text-muted-foreground">Vehicle ID</span>
							<Input
								id={txVehicleIdInput}
								inputMode="numeric"
								onChange={(e) => setTxVehicleId(e.target.value)}
								placeholder="1"
								value={txVehicleId}
							/>
						</label>
						<Button disabled={startTx.isPending} type="submit">
							{startTx.isPending ? "Queueing…" : "Fetch history"}
						</Button>
					</form>
					<p className="mt-3 text-muted-foreground text-xs">
						CLI equivalent:{" "}
						<code className="font-mono">
							bun run workflow -- transaction-history --reg MH01CR7464
						</code>
						. Results land in the Transaction History tab on the vehicle page.
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Recent runs</CardTitle>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<p className="text-muted-foreground text-sm">Loading…</p>
					) : !runs || runs.length === 0 ? (
						<p className="text-muted-foreground text-sm">No runs yet.</p>
					) : (
						<ul className="space-y-2 text-sm">
							{runs.map((run) => (
								<li
									className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
									key={run.id}
								>
									<span className="font-mono text-xs">#{run.id}</span>
									<span className="font-mono text-xs">{run.workflowName}</span>
									<StatusBadge status={run.status} />
									<span className="text-muted-foreground text-xs">
										{JSON.stringify(run.input)}
									</span>
									{run.artifactPath ? (
										<span className="font-mono text-xs">
											{run.artifactPath}
										</span>
									) : null}
									{run.error ? (
										<span className="text-destructive text-xs">
											{run.error}
										</span>
									) : null}
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	if (status === "succeeded") return <Badge variant="default">{status}</Badge>;
	if (status === "failed") return <Badge variant="destructive">{status}</Badge>;
	return <Badge variant="secondary">{status}</Badge>;
}
