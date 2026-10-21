import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "#/components/page-header";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { orpc } from "#/lib/rpc";
import {
	normalizeChassisLast5,
	normalizeRegistrationNumber,
} from "#/lib/vehicle-registration";

export const Route = createFileRoute("/(app)/(debug)/workflows")({
	component: WorkflowsPage,
});

type Definition = {
	description: string;
	displayName: string;
	fields: {
		help?: string | undefined;
		label: string;
		name: string;
		placeholder?: string | undefined;
		required: boolean;
		type: string;
	}[];
	name: string;
};

export function validateField(
	defName: string,
	field: Definition["fields"][number],
	value: string,
): string | null {
	const v = value.trim();
	if (field.required && !v) return `${field.label} is required.`;
	if (!v) return null;
	if (field.type === "registrationNumber") {
		try {
			normalizeRegistrationNumber(v);
		} catch {
			return 'Invalid registration number. Expected format like "MH01CR7464".';
		}
	}
	if (field.type === "chassisLast5" || field.name === "chassisLast5") {
		try {
			normalizeChassisLast5(v);
		} catch {
			return "Enter exactly the last 5 characters of the chassis number.";
		}
	}
	if (field.type === "vehicleId" || field.name === "vehicleId") {
		if (!/^\d+$/.test(v)) return "Enter a numeric vehicle ID.";
	}
	if (defName === "pucc-fetch" && field.name === "vehicleId" && v) {
		if (!/^\d+$/.test(v)) return "Enter a numeric vehicle ID.";
	}
	return null;
}

function WorkflowCard({
	def,
	onQueued,
}: {
	def: Definition;
	onQueued?: ((id: number) => void) | undefined;
}) {
	const queryClient = useQueryClient();
	const formId = useId();
	const [values, setValues] = useState<Record<string, string>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});

	const startRun = useMutation(
		orpc.workflow.startRun.mutationOptions({
			onError: (err) => {
				const data = (
					err as { data?: { fieldErrors?: Record<string, string> } }
				).data;
				const fieldErrors = data?.fieldErrors;
				if (fieldErrors && Object.keys(fieldErrors).length > 0) {
					setErrors(fieldErrors);
				}
				toast.error(err.message);
			},
			onSuccess: (run) => {
				toast.success(`${def.displayName} run #${run.id} queued`);
				setValues({});
				setErrors({});
				void queryClient.invalidateQueries({
					queryKey: orpc.workflow.listRuns.key(),
				});
				void queryClient.invalidateQueries({
					queryKey: orpc.debug.listRecent.key(),
				});
				onQueued?.(run.id);
			},
		}),
	);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const nextErrors: Record<string, string> = {};
		for (const f of def.fields) {
			const err = validateField(def.name, f, values[f.name] ?? "");
			if (err) nextErrors[f.name] = err;
		}
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;
		const input: Record<string, unknown> = {};
		for (const f of def.fields) {
			const raw = (values[f.name] ?? "").trim();
			if (!raw) continue;
			if (f.type === "vehicleId" || f.name === "vehicleId") {
				input[f.name] = Number(raw);
			} else if (f.type === "number") {
				input[f.name] = Number(raw);
			} else {
				input[f.name] = raw;
			}
		}
		startRun.mutate({ input, workflowName: def.name });
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center gap-3">
				<div className="grid size-11 place-items-center rounded-full border border-border bg-muted/40">
					<FlaskConical className="size-5" strokeWidth={1.6} />
				</div>
				<div>
					<CardTitle className="text-base">{def.displayName}</CardTitle>
					<p className="text-muted-foreground text-sm">{def.description}</p>
					<p className="font-mono text-muted-foreground text-xs">{def.name}</p>
				</div>
			</CardHeader>
			<CardContent>
				<form className="flex flex-col gap-3" onSubmit={handleSubmit}>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
						{def.fields.map((f) => (
							<label
								className="grid flex-1 gap-1 text-sm"
								htmlFor={`${formId}-${f.name}`}
								key={f.name}
							>
								<span className="text-muted-foreground">
									{f.label}
									{f.required ? " *" : ""}
								</span>
								<Input
									id={`${formId}-${f.name}`}
									inputMode={
										f.type === "vehicleId" || f.type === "number"
											? "numeric"
											: undefined
									}
									maxLength={f.name === "chassisLast5" ? 5 : undefined}
									onChange={(e) =>
										setValues((v) => ({ ...v, [f.name]: e.target.value }))
									}
									placeholder={f.placeholder}
									value={values[f.name] ?? ""}
								/>
								{errors[f.name] ? (
									<span className="text-destructive text-xs">
										{errors[f.name]}
									</span>
								) : f.help ? (
									<span className="text-muted-foreground text-xs">
										{f.help}
									</span>
								) : null}
							</label>
						))}
						<Button disabled={startRun.isPending} type="submit">
							{startRun.isPending ? "Queueing…" : "Queue run"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

function WorkflowsPage() {
	const [filter, setFilter] = useState("");
	const [lastQueuedId, setLastQueuedId] = useState<number | null>(null);
	const { data: definitions } = useQuery(
		orpc.workflow.listDefinitions.queryOptions(),
	);
	const { data: runs, isLoading } = useQuery(
		orpc.workflow.listRuns.queryOptions({
			input: {},
			refetchInterval: 2000,
		}),
	);
	const { data: summaries } = useQuery(
		orpc.debug.listRecent.queryOptions({
			input: { limit: 20 },
			refetchInterval: 2000,
		}),
	);
	const summaryByRun = new Map((summaries ?? []).map((s) => [s.run.id, s]));

	const filtered = (runs ?? []).filter((r) =>
		filter ? r.workflowName === filter : true,
	);

	return (
		<div className="space-y-8">
			<PageHeader
				description="Trigger any registered workflow with validated inputs, then follow every run from queue to artifact. Built for debugging the browser automation layer."
				eyebrow="Debug / Workflows"
				meta={
					<>
						<span>{definitions?.length ?? 0} workflows registered</span>
						<span>Serial execution (concurrency 1)</span>
					</>
				}
				title="Workflows"
			/>

			{lastQueuedId !== null ? (
				<div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
					<span>Run #{lastQueuedId} queued.</span>
					<Link
						className="underline"
						params={{ runId: String(lastQueuedId) }}
						to="/runs/$runId"
					>
						View run detail →
					</Link>
				</div>
			) : null}
			{(definitions ?? []).map((def) => (
				<WorkflowCard
					def={def}
					key={def.name}
					onQueued={(id) => setLastQueuedId(id)}
				/>
			))}
			{!definitions || definitions.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					No workflow definitions registered.
				</p>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Recent runs</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="mb-3 flex gap-2 text-sm">
						<Button
							onClick={() => setFilter("")}
							size="sm"
							type="button"
							variant={filter === "" ? "default" : "outline"}
						>
							All
						</Button>
						{(definitions ?? []).map((d) => (
							<Button
								key={d.name}
								onClick={() => setFilter(d.name)}
								size="sm"
								type="button"
								variant={filter === d.name ? "default" : "outline"}
							>
								{d.name}
							</Button>
						))}
					</div>
					{isLoading ? (
						<p className="text-muted-foreground text-sm">Loading…</p>
					) : filtered.length === 0 ? (
						<p className="text-muted-foreground text-sm">No runs yet.</p>
					) : (
						<ul className="space-y-2 text-sm">
							{filtered.map((run) => (
								<li
									className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 p-3"
									key={run.id}
								>
									<Link
										className="font-mono text-xs underline"
										params={{ runId: String(run.id) }}
										to="/runs/$runId"
									>
										#{run.id}
									</Link>
									<span className="font-mono text-xs">{run.workflowName}</span>
									<StatusBadge status={run.status} />
									{(() => {
										const s = summaryByRun.get(run.id);
										if (!s) return null;
										return (
											<>
												{s.warningCount > 0 ? (
													<Badge variant="secondary">
														⚠ retried {s.warningCount}×
													</Badge>
												) : null}
												{s.errorCount > 0 ? (
													<Badge variant="destructive">
														{s.errorCount} errors
													</Badge>
												) : null}
												{s.hasVideo ? (
													<Badge variant="outline">▶ video</Badge>
												) : null}
												{s.hasConsole ? (
													<Badge variant="outline">console</Badge>
												) : null}
											</>
										);
									})()}
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
	if (status === "succeeded" || status === "ok" || status === "success")
		return <Badge variant="default">{status}</Badge>;
	if (status === "failed" || status === "error" || status === "rejected")
		return <Badge variant="destructive">{status}</Badge>;
	if (status === "warn" || status === "warning")
		return <Badge variant="secondary">⚠ {status}</Badge>;
	return <Badge variant="secondary">{status}</Badge>;
}
