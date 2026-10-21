import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";

import { CenteredLoader } from "#/components/centered-loader";
import { PageHeader } from "#/components/page-header";
import { Badge } from "#/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { orpc } from "#/lib/rpc";

export const Route = createFileRoute("/(app)/(debug)/runs/$runId")({
	component: RunDetailPage,
});

function RunDetailPage() {
	const runId = Number(Route.useParams().runId);
	const [levelFilter, setLevelFilter] = useState<string>("all");
	const [sourceFilter, setSourceFilter] = useState<string>("all");
	const { data, isLoading } = useQuery(
		orpc.debug.getRunDetail.queryOptions({ input: { id: runId } }),
	);
	const filteredLogs = useMemo(() => {
		if (!data) return [];
		return data.logs.filter((l) => {
			const level = (l as { level?: string }).level ?? "info";
			const source = (l as { source?: string }).source ?? "workflow";
			if (levelFilter !== "all" && level !== levelFilter) return false;
			if (sourceFilter !== "all" && source !== sourceFilter) return false;
			return true;
		});
	}, [data, levelFilter, sourceFilter]);

	if (isLoading) return <CenteredLoader />;
	if (!data) {
		return (
			<div className="space-y-4">
				<Link className="eyebrow" to="/workflows">
					← Workflows
				</Link>
				<p>Run not found.</p>
			</div>
		);
	}
	const { debug, llm, logs, run, steps } = data;
	const warnings = debug?.warningCount ?? 0;
	const errors = debug?.errorCount ?? 0;

	return (
		<div className="space-y-8">
			<PageHeader
				description={`Workflow ${run.workflowName} · status ${run.status}`}
				eyebrow="Debug / Run detail"
				meta={
					<>
						<span>Run #{run.id}</span>
						<span>{run.workflowName}</span>
					</>
				}
				title={`Run #${run.id}`}
			/>
			<Link
				className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				to="/workflows"
			>
				<ArrowLeft className="size-4" /> Back to workflows
			</Link>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Status</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap items-center gap-2 text-sm">
					<StatusBadge status={run.status} />
					{warnings > 0 ? (
						<Badge variant="secondary">⚠ {warnings} retried</Badge>
					) : null}
					{errors > 0 ? (
						<Badge variant="destructive">{errors} errors</Badge>
					) : null}
					<span className="font-mono text-xs">
						attempts {run.attempts} ·{" "}
						{run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
					</span>
					{run.error ? (
						<span className="text-destructive text-xs">{run.error}</span>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Screen recording</CardTitle>
				</CardHeader>
				<CardContent>
					{debug?.videoKey ? (
						<video
							className="w-full rounded-xl border border-border"
							controls
							preload="metadata"
							src={`/api/debug-artifact/${run.id}?kind=video`}
						>
							<track kind="captions" />
						</video>
					) : (
						<p className="text-muted-foreground text-sm">
							No recording for this run (video unavailable or run predates
							recording).
						</p>
					)}
					<div className="mt-3 flex flex-wrap gap-2 text-xs">
						{debug?.consoleLogKey ? (
							<a
								className="underline"
								href={`/api/debug-artifact/${run.id}?kind=console`}
							>
								Download console log
							</a>
						) : null}
						{run.artifactPath ? (
							<a
								className="underline"
								href={`/api/debug-artifact/${run.id}?kind=artifact`}
							>
								Download artifact
							</a>
						) : null}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Steps ({steps.length})</CardTitle>
				</CardHeader>
				<CardContent>
					{steps.length === 0 ? (
						<p className="text-muted-foreground text-sm">No steps recorded.</p>
					) : (
						<ul className="space-y-2 text-sm">
							{steps.map((s) => (
								<li
									className="rounded-xl border border-border bg-muted/20 p-3"
									key={s.id}
								>
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-mono text-xs">#{s.seq}</span>
										<span className="font-mono text-xs">{s.kind}</span>
										<StatusBadge status={s.status ?? "ok"} />
										<span>{s.label}</span>
										{(() => {
											const attempt =
												(s as { attempt?: number | null }).attempt ?? 1;
											return attempt > 1 ? (
												<span className="font-mono text-muted-foreground text-xs">
													attempt {attempt}
												</span>
											) : null;
										})()}
									</div>
									{s.message ? (
										<p className="mt-1 text-muted-foreground text-xs">
											{s.message}
										</p>
									) : null}
									{s.screenshotKey ? (
										<a
											className="mt-1 inline-block text-xs underline"
											href={`/api/debug-artifact/${run.id}?kind=screenshot&stepId=${s.id}`}
										>
											View screenshot
										</a>
									) : null}
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Console logs ({filteredLogs.length}/{logs.length})
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="mb-3 flex flex-wrap gap-2 text-xs">
						<label className="flex items-center gap-1">
							Level{" "}
							<select
								className="rounded border border-border bg-background px-2 py-1"
								onChange={(e) => setLevelFilter(e.target.value)}
								value={levelFilter}
							>
								<option value="all">All</option>
								<option value="debug">debug</option>
								<option value="info">info</option>
								<option value="warn">warn</option>
								<option value="error">error</option>
							</select>
						</label>
						<label className="flex items-center gap-1">
							Source{" "}
							<select
								className="rounded border border-border bg-background px-2 py-1"
								onChange={(e) => setSourceFilter(e.target.value)}
								value={sourceFilter}
							>
								<option value="all">All</option>
								<option value="browser-console">browser-console</option>
								<option value="workflow">workflow</option>
								<option value="engine">engine</option>
								<option value="captcha">captcha</option>
							</select>
						</label>
					</div>
					{filteredLogs.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No logs for this filter.
						</p>
					) : (
						<ul className="max-h-96 space-y-1 overflow-y-auto font-mono text-xs">
							{filteredLogs.slice(0, 500).map((l) => (
								<li key={l.id}>
									<span className="text-muted-foreground">
										[{l.source}/{l.level}]
									</span>{" "}
									{l.message}
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">AI calls ({llm.length})</CardTitle>
				</CardHeader>
				<CardContent>
					{llm.length === 0 ? (
						<p className="text-muted-foreground text-sm">No AI calls.</p>
					) : (
						<ul className="space-y-2 text-sm">
							{llm.map((r) => (
								<li
									className="rounded-xl border border-border bg-muted/20 p-3"
									key={r.id}
								>
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-mono text-xs">{r.provider}</span>
										<span className="font-mono text-xs">{r.model}</span>
										<StatusBadge status={r.status ?? "success"} />
										{r.confidence !== null && r.confidence !== undefined ? (
											<span className="text-xs">confidence {r.confidence}</span>
										) : null}
										{r.latencyMs !== null && r.latencyMs !== undefined ? (
											<span className="text-muted-foreground text-xs">
												{r.latencyMs}ms
											</span>
										) : null}
									</div>
									<p className="mt-1 text-xs">
										code:{" "}
										<span className="font-mono">{r.parsedCode ?? "—"}</span> ·
										purpose: {r.purpose}
									</p>
									{(r as { prompt?: string }).prompt ? (
										<details className="mt-1 text-xs">
											<summary className="cursor-pointer underline">
												Prompt
											</summary>
											<pre className="mt-1 overflow-x-auto rounded bg-muted/40 p-2 font-mono text-[11px]">
												{(r as { prompt?: string }).prompt}
											</pre>
										</details>
									) : null}
									{(r as { request?: unknown }).request ? (
										<details className="mt-1 text-xs">
											<summary className="cursor-pointer underline">
												Request / response
											</summary>
											<pre className="mt-1 overflow-x-auto rounded bg-muted/40 p-2 font-mono text-[11px]">
												{JSON.stringify(
													{
														request: (r as { request?: unknown }).request,
														response:
															(r as { response?: unknown }).response ?? null,
													},
													null,
													2,
												)}
											</pre>
										</details>
									) : null}
									{r.error ? (
										<p className="text-destructive text-xs">{r.error}</p>
									) : null}
									{r.imageKey ? (
										<a
											className="text-xs underline"
											href={`/api/debug-artifact/${run.id}?kind=llm-image&stepId=${r.id}`}
										>
											View CAPTCHA image
										</a>
									) : null}
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Input / Output</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-4 md:grid-cols-2">
					<pre className="overflow-x-auto rounded-xl bg-muted/40 p-3 font-mono text-xs">
						{JSON.stringify(run.input, null, 2)}
					</pre>
					<pre className="overflow-x-auto rounded-xl bg-muted/40 p-3 font-mono text-xs">
						{JSON.stringify(run.output ?? null, null, 2)}
					</pre>
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
	return <Badge variant="secondary">{status}</Badge>;
}
