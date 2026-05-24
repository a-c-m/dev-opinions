---
date: 2026-05-24
decision-makers: [Repo platform]
---

# ADR 0032: Runtime observability — OTel, metrics, tracing

## Context and Problem Statement

[ADR 0031](0031-structured-logging-contract.md) settles
logging. This ADR settles the rest: tracing, metrics, the
Collector, sampling, local dev stack, and prod backend
advice. App code stays vendor-neutral; backend swap is an
infra change. Local dev is first-class for humans and agents.

## Decision Outcome

### Instrumentation — OpenTelemetry, OTLP/HTTP

Each service runs the OTel Node SDK with
`@opentelemetry/auto-instrumentations-node` and the NestJS
+ pino contrib instrumentations. Exports go to a local OTel
Collector via OTLP/HTTP. The Collector is the fan-out point;
backend swap = Collector config change. Versions pinned in
each service's `package.json`.

### Boot order — `--import` flag

Bundlers reorder imports by graph, not source order. A
top-of-`main.ts` import of `./instrumentation` can be hoisted
*after* `@nestjs/core` — controller spans silently disappear.
Fix: load instrumentation via Node's `--import` flag, before
any application module is required.

```dockerfile
ENTRYPOINT ["node", "--import", "./dist/instrumentation.mjs"]
CMD ["dist/main.js"]
```

ESM-only (Node 22 + NX 22 default). Per-service
`src/instrumentation.ts` configures the SDK, resource attrs,
and the OTLP endpoint.

### Propagation — W3C `traceparent` only

`OTEL_PROPAGATORS=tracecontext,baggage`. B3 added only if a
mesh upstream still emits it. Proprietary vendor headers
translate at the Collector.

### Metrics — split by source

| Source | Tool | Path |
|---|---|---|
| Node runtime (event loop, GC, heap, handles) | `prom-client` `collectDefaultMetrics` | `GET /metrics` on a separate port (`9464`) |
| Application (RED: rate, errors, duration) | OTel Metrics SDK | OTLP/HTTP → Collector |

Convention: **never measure the same thing in both** — OTel
JS HTTP instrumentation owns `http_server_*`; custom
histograms go through `metrics.getMeter().createHistogram()`.
`/metrics` on port 9464 stays internal (Collector scrape).

### Sampling — 10% head-based in prod, 100% locally

Standard OTel env vars; no custom SDK code:

- Local (`.envrc.example`): `OTEL_TRACES_SAMPLER=parentbased_always_on`
- Prod (per-fork Tofu / CI): `parentbased_traceidratio` +
  `OTEL_TRACES_SAMPLER_ARG=0.1`

The 80%+ throughput hit in OTel JS is in span *creation*, not
export — head-based at the SDK is the only knob that reduces
it. Graduation: tail-based at the Collector when sampled data
is missing errors or slow traces.

### Local dev — two modes

| Command | What runs | When |
|---|---|---|
| `pnpm dev` | App only; logs → `.ai-wip/logs/` per [ADR 0031](0031-structured-logging-contract.md). OTLP exporter targets `localhost:4318` and harmlessly fails if nothing is listening. | Default. Most local work. |
| `pnpm dev:obs` | Above + `docker-compose.observability.yml` (Collector + Grafana + Tempo + Loki + Prometheus). | Debugging multi-service flows, demos, agent deep-dives. |

`docker-compose.observability.yml` at the repo root. ~6
containers, opt-in. Grafana datasources preprovisioned.

### Production backend — advised ladder, not prescribed

The Collector ships with exporter blocks for each rung,
env-var-driven, commented. Uncomment one, set the vars, deploy.

| Rung | When | Trade-off |
|---|---|---|
| **New Relic Free** | Zero infra, 100 GB/mo free, one product. | NRQL lock-in; per-user cost is the cliff. |
| **Grafana Cloud Free** | OTel-native; clean swap to self-host. | 14-day metric retention; dashboard lock-in. |
| **Self-host** (Grafana + VictoriaMetrics + Tempo + Loki) | Zero per-month cost; same stack as local. | ~0.5 FTE ops. |

Forks with an existing decision (Datadog, Honeycomb, …) plug
in the same way.

### Error / replay / analytics layer — opt-in SOP

Out of band from the OTel pipeline. Pick at most one per
service:

- **Default-advised: PostHog** — generous free tier, bundles
  feature flags + analytics + replay. SOP:
  [add-posthog.md](../sops/add-posthog.md).
- **Alternative: Sentry** — better backend-debug UX, mature
  NestJS integration. Prefer for no-end-user services
  (worker, batch) or async-debug-heavy incident patterns.
  SOP: [add-sentry.md](../sops/add-sentry.md).

### Frontend — no OTel web SDK in template

React ships without OTel browser instrumentation;
`traceparent` does not propagate from the browser. Backend
traces start at the NestJS handler. PostHog (when adopted)
covers Web Vitals, replay, and frontend errors. Cross-tier
trace correlation is a known gap — add OTel JS web + CORS
when the diagnostic need recurs.

## Consequences

### Positive

- **Vendor-neutral app code** — swap is a Collector edit.
- **Sane defaults** — sampling, propagation, metrics split,
  boot order, all settled.
- **Local dev parity with prod** — same OTel pipeline; same
  UI stack via `dev:obs` that a fork would self-host.

### Negative

- **Full auto-instrumentation is >80% throughput cost** on
  micro-benchmarks. Mitigated by 10% sampling; calibrate per
  service.
- **Collector is always one container**, even on managed
  backends — the fan-out point lives in-cluster.
- **OTel JS contrib (0.x) churns monthly.** Bumps need
  CHANGELOG review.

### Neutral

- `dev:obs` is opt-in; default `pnpm dev` has no extra cost.
- Frontend trace correlation is deferred, not foreclosed.

## Alternatives considered

1. **Prescribe a single prod backend** — biases forks for
   pricing reasons that age fast. Advice ages better.
2. **OTel JS web SDK in template** — ~30 KB bundle per fork
   for correlation most won't use. Graduation.
3. **`@sentry/nestjs` as the default error path** — leaves
   feature-flags orphaned; 1-user free-tier paywall.
4. **Vendor proprietary agents** (Datadog, NR agent) — locks
   app code to the vendor; breaks "swap = config".

## Related

- **[ADR 0010](0010-nestjs-backend.md)** — NestJS hooks for OTel.
- **[ADR 0011](0011-frontend-frameworks.md)** — frontend SOPs over OTel web.
- **[ADR 0015](0015-backend-config.md)** — OTel vars follow the config/secret split.
- **[ADR 0022](0022-opentofu-iac.md)** — prod env vars set in Tofu.
- **[ADR 0023](0023-container-conventions.md)** — runtime
  `ENTRYPOINT` adds `--import ./dist/instrumentation.mjs`.
- **[ADR 0031](0031-structured-logging-contract.md)** — log shape and capture.
- [OpenTelemetry JS](https://opentelemetry.io/docs/languages/js/)
- [OTel JS performance — Matteo Collina, Aug 2025](https://blog.platformatic.dev/the-hidden-cost-of-context)
- [PostHog vs Sentry comparison](https://posthog.com/blog/posthog-vs-sentry)
- [Grafana Cloud free tier](https://grafana.com/pricing/)
- [New Relic OTLP endpoint](https://docs.newrelic.com/docs/opentelemetry/best-practices/opentelemetry-otlp/)
