---
title: "Architecture Decision Records — Compendium"
subtitle: "Heph — the nine decisions that bind the platform"
author: "Platform Architecture · Heph"
date: "June 2026"
---

## Index of decisions

- ADR-0001 — Multi-tenant isolation via shared services with row-level scoping
- ADR-0002 — BFF-mediated auth trust boundary; no tokens in the browser
- ADR-0003 — Event-driven backend with versioned schema contracts
- ADR-0004 — Medallion data strategy (Landing → Bronze → Silver → Gold → Intelligence)
- ADR-0005 — Payment establishment & receipt; idempotent settlement coupled to issuance
- ADR-0006 — Insurer onboarding as a React Flow node studio
- ADR-0007 — Schema-driven, centrally governed product catalogue
- ADR-0008 — Centralised observability and audit across tenants
- ADR-0009 — PII vault with field-level encryption and configurable residency

# ADR-0001 — Multi-tenant isolation via shared services with row-level scoping

**Status:** Accepted · **Plane:** Tenancy · **Date:** June 2026

## Context

Heph serves many lenders (NBFCs) from one centralised platform. The product promise is reuse —
onboard once, configure many times, never fork — but the regulatory promise is isolation: no lender
may ever see another's cases or data. We need an isolation model that preserves both, at acceptable
operational cost, and that lets a tenant be resolved automatically on login.

## Decision

Use a single set of shared, tenant-agnostic services over shared managed data stores, with **row-level
tenant scoping** on every table and a **per-tenant configuration store** that parameterises behaviour.
The tenant is resolved from the SSO assertion at the BFF and threaded through every call. The data-access
layer refuses any query that does not constrain on the tenant key, so isolation is enforced by
construction. Cross-tenant access exists only for Heph-side roles and is always authorised and audited.

## Consequences

- One code base and one catalogue engine serve all lenders; a new lender is an onboarding exercise, not a development project.
- Isolation is structural, verified by automated tests, not left to developer discipline.
- Shared infrastructure introduces noisy-neighbour risk, mitigated by per-tenant rate limits and quotas (ADR-0008, A07).
- Full in-country data residency for a tenant may require a regional deployment, partially breaking the single-base model — an explicit governance decision (ADR-0009, A03).

## Alternatives considered

- **Database-per-tenant** — maximal isolation, but defeats reuse, multiplies operational cost, and slows onboarding. Rejected for V1.
- **Fully pooled, no row-level enforcement** — cheapest, but isolation depends on every query being written correctly. Rejected as too easy to get wrong.



# ADR-0002 — BFF-mediated auth trust boundary; no tokens in the browser

**Status:** Accepted · **Plane:** Foundational-Capabilities · **Date:** June 2026

## Context

RMs reach Heph through their lender's portal via SSO; there is no separate Heph login. The platform is
the meeting point of two regulated domains (lender and insurer) and the custodian of borrower PII in
flight. The front end must therefore hold as little trust as possible, and the tenant must be
established before any business call runs.

## Decision

Introduce a **Backend-for-Frontend (BFF)** middleware as the platform's primary trust boundary. The BFF
terminates the user session (httpOnly cookie; the browser never holds a token), performs the OIDC code
exchange with the lender IdP, resolves the tenant from the assertion, and mints short-lived,
tenant-scoped tokens for the private core, which is reachable only over mTLS. The BFF also aggregates
core responses into screen-shaped payloads so no business logic leaks to the client.

## Consequences

- Token theft from the browser is impossible; the attack surface on the client collapses to a session cookie.
- Tenant resolution and authorisation happen once, at the edge, and are threaded everywhere behind it.
- The BFF must be stateless (session in a shared store) and horizontally scaled, or it becomes a bottleneck and SPOF (A07).
- The front end stays thin; screen composition is a server concern.

## Alternatives considered

- **SPA holds OIDC tokens directly** — simpler to build, but puts tokens and refresh logic in the browser and leaks the trust boundary to the client. Rejected.
- **API gateway only, no BFF** — adequate for authZ but offers no session custody or response shaping, and pushes tenant/token handling to the client. Rejected.



# ADR-0003 — Event-driven backend with versioned schema contracts

**Status:** Accepted · **Plane:** Foundational-Capabilities / Data · **Date:** June 2026

## Context

The journey spans many capabilities (loan hydration, quoting, consent, payments, fulfilment) and several
external systems with different latencies and failure modes. Services must evolve independently, state
must be auditable and resumable, and the data platform must be fed without coupling it to service
internals.

## Decision

Make the backend **event-driven** and **schema-contract-driven**. Every business fact is published as a
**versioned domain event** through a schema registry; every interface (LOS payload, insurer quote/proposal/COI,
catalogue entry, event) is a versioned contract. Delivery is **at-least-once**, so every consumer is
**idempotent**, deduping on event id, and every externally-visible effect is guarded by an idempotency
key. Case state is a projection rebuilt from events, not a value held in service memory.

## Consequences

- Producers and consumers are decoupled by contract, not by deployment timing; services scale and deploy independently.
- State is resumable and auditable; the case state machine is a projection (A05).
- At-least-once delivery makes idempotency mandatory platform-wide — a default, not a per-service choice (A07).
- Contract evolution must be governed: additive changes only, breaking changes are new versions, retirement is telemetry-driven (A03).

## Alternatives considered

- **Synchronous orchestration only** — simpler mental model, but couples services temporally, makes long-running insurer/LOS waits fragile, and complicates audit/resumption. Rejected.
- **Exactly-once delivery** — removes the dedupe burden but is costly and brittle across heterogeneous systems. Rejected in favour of at-least-once + idempotency.



# ADR-0004 — Medallion data strategy (Landing → Bronze → Silver → Gold → Intelligence)

**Status:** Accepted · **Plane:** Data · **Date:** June 2026

## Context

The platform must serve operational reporting (the distribution funnel, MIS, insurer/product breakdowns)
and proactive intelligence (stuck-case risk, drop-off, cross-sell), across many tenants, without
coupling analytics to the transactional store or to insurer integration internals, and while preserving
tenant isolation and data lineage.

## Decision

Adopt a **medallion** progression on a data lake fed by the event backbone and by change-data-capture
from the transactional store: **Landing** (raw events and raw LOS/insurer payloads) → **Bronze** (typed,
validated, deduplicated) → **Silver** (conformed, joined entities) → **Gold** (business marts: funnel,
MIS, counts) → **Proactive Intelligence** (signals derived from gold). Each layer is a contract; a
downstream consumer depends on the layer it reads, never on raw upstream. Tenant scope and lineage
persist through every layer.

## Consequences

- Reporting and intelligence evolve without breaking when insurer integrations change.
- The pipeline is replayable from landing; quality gates between bronze and silver quarantine bad records.
- The gold funnel reconciles to the case ledger because funnel stages mirror case states (A05).
- Retention and residency follow the Compliance Plane per tenant (ADR-0009).

## Alternatives considered

- **Report straight off the transactional DB** — fast to start, but couples analytics to operational schema and load, and cannot host raw insurer payloads or lineage. Rejected.
- **Single warehouse, no layering** — loses the raw-landing audit trail and the clean contract boundaries between refinement stages. Rejected.



# ADR-0005 — Payment establishment & receipt; idempotent settlement coupled to issuance

**Status:** Accepted · **Plane:** Capabilities · **Date:** June 2026

## Context

Premiums are single-premium, paid once at loan disbursement, and collected two ways: Mode A (bank-funded,
folded into the LOS disbursement via a charge code) and Mode B (customer-paid via a payment gateway). A
case may hold a parent product and several child add-ons, each with independent consent. Money movement
and policy issuance must be correct under retries and partial failure.

## Decision

Model settlement as an **establishment → receipt** journey that is **idempotent** end to end and
**couples certificate issuance to confirmed settlement**. In Mode A, the cart total is posted once to
the LOS (idempotency key) and issuance is triggered by the disbursement webhook (transaction id). In
Mode B, a payment intent is created with an idempotency key, the customer pays, and a signature-verified
gateway callback triggers issuance. Issuance obeys the **parent-first partial-issuance rule**: nothing
issues without parent consent; each child issues independently as its own consent and settlement allow.
A COI is requested exactly once per insurer and written back to the LOS.

## Consequences

- Retries never double-charge or double-issue; receipts are persisted and auditable (A02).
- A failed child never blocks a consented, settled parent; partial outcomes are legally coherent.
- Settlement depends on LOS/gateway availability; failures keep the case recoverable (Failed → retry).

## Alternatives considered

- **Issue on consent, settle later** — simpler UX, but risks issuing policies that are never funded. Rejected.
- **All-or-nothing issuance** — easier to reason about, but forces a whole case to fail when one add-on's consent lapses. Rejected in favour of parent-first partial issuance.



# ADR-0006 — Insurer onboarding as a React Flow node studio

**Status:** Accepted · **Plane:** Governance / Capabilities · **Date:** June 2026

## Context

Each insurer exposes different quote, proposal, and COI contracts, underwriting rules, and health
questionnaires. New insurers and new products must be added centrally, safely, and repeatedly, and the
same machinery should serve product extensibility — without a code change per integration and without
risking live multi-tenant behaviour.

## Decision

Build insurer (and product) onboarding as a **node-driven React Flow studio** in the admin layer. The
canvas is a governed pipeline: insurer profile → auth & endpoints → map quote/proposal/COI contracts →
bind fields & schemas → encode underwriting & health rules → run a sandbox contract-test harness →
**approval gate** → **versioned publish** to the catalogue. Onboarding produces configuration and
contract bindings, not bespoke code, and nothing reaches a tenant's RM without passing the gate.

## Consequences

- Adding an insurer or product is a configuration exercise with a governance gate, not a deployment (A03).
- The contract-test harness verifies an integration before it can be promoted (A08 CI/CD).
- Every publish is versioned and reversible; in-flight cases keep the version they began with.
- The same node model is reused for product extensibility, satisfying the catalogue-extensibility goal (ADR-0007).

## Alternatives considered

- **Hand-coded adapter per insurer** — maximal flexibility, but slow, risky, and unscalable across many insurers. Rejected as the default path (a code adapter remains the escape hatch for genuinely non-standard insurers).
- **Static config forms** — simpler UI, but cannot express the branching mapping/underwriting flow or carry a visual, governed pipeline. Rejected.



# ADR-0007 — Schema-driven, centrally governed product catalogue

**Status:** Accepted · **Plane:** Capabilities / Governance · **Date:** June 2026

## Context

The platform offers four product types today (Credit Life, EMI Protect, PACI, Wellness) and must add
more over time. Each tenant offers a configured subset, with tenant-overridable presentation
(recommendation tag, context blurb, coverage range) and platform-fixed semantics. Products must be added
without code changes and without divergence between tenants.

## Decision

Model the catalogue as a **schema-driven, centrally governed inventory**. A product is a versioned
catalogue entry conforming to a product schema, with explicit fields for type semantics (platform-fixed),
insurer/contract bindings, suitability rules, and tenant-overridable presentation. catalogue-svc resolves
the tenant's subset and applies suitability against the loan and risk profile at runtime. Catalogue
changes flow through the onboarding studio's governance gate (ADR-0006).

## Consequences

- New products and insurer mappings are added centrally as governed data, not code (A06).
- Tenants share one catalogue engine; per-tenant variation is configuration, preserving reuse (ADR-0001).
- Versioning lets in-flight cases keep their catalogue version while new cases get the latest.
- Suitability is consistent and centrally maintained across all tenants.

## Alternatives considered

- **Per-tenant hard-coded product lists** — simplest initially, but forks behaviour and breaks central governance. Rejected.
- **Free-form catalogue without a schema** — flexible, but loses validation, contract binding, and safe extensibility. Rejected.



# ADR-0008 — Centralised observability and audit across tenants

**Status:** Accepted · **Plane:** Infra-Core / Compliance · **Date:** June 2026

## Context

Heph Operations must keep one platform healthy across many lenders and insurers, resolve stuck and
failed cases within SLA, and prove what happened for compliance. The backend is distributed and
event-driven, so a single case crosses many services and consumers. Without end-to-end observability,
neither operability nor auditability is achievable.

## Decision

Make **centralised observability** a first-class platform capability. Thread a single **correlation id**
from the BFF through the gateway, services, and event consumers. Emit three signals everywhere —
**tracing** (follow any case across the backend), **metrics** (per service and per tenant, including
business KPIs like funnel conversion and stuck-case counts), and **structured, tenant-tagged logging**.
Maintain an **immutable, append-only audit log** of every state transition and PII access, retained per
the Compliance Plane's per-tenant policy.

## Consequences

- Any case is traceable end to end; stuck cases (>48h) surface automatically for Operations (A03).
- Business and system health are observable per tenant from the same backbone.
- Audit is provable and retained consistently with compliance obligations (A02).
- Observability cost grows with cardinality; per-tenant tagging needs sensible limits.

## Alternatives considered

- **Per-service, uncorrelated logs** — cheap, but cannot follow a case across the distributed backend. Rejected.
- **Sampling-only traces** — lower cost, but loses the ability to audit a specific case end to end. Rejected for the audit path; sampling is acceptable for high-volume non-audit traces.



# ADR-0009 — PII vault with field-level encryption and configurable residency

**Status:** Accepted · **Plane:** Compliance / Foundational-Capabilities · **Date:** June 2026

## Context

The platform handles borrower personal data — DOB, PAN, mobile, address — in flight between the lender
and insurers. Some fields (DOB, PAN) must be usable for eligibility and underwriting without being shown
to the RM. Tenants may have data-residency obligations. The trust boundary across NBFC × insurer means
the platform is the custodian at the point the two domains meet.

## Decision

Introduce a **PII vault** performing **field-level envelope encryption** with keys in the platform KMS.
Sensitive fields are stored encrypted at rest and decrypted only for a role and step entitled to them;
the default is masked. DOB is used to compute age without being displayed; PAN is validated and stored
encrypted. The Compliance Plane owns the decryption **policy**; the Foundational plane owns the
**mechanism**. Storage region is **configurable per tenant**, providing a path to localisation.

## Consequences

- PII crosses the BFF boundary only as far as a step requires, only for an entitled role, and every decryption is logged (A02).
- Insurer-bound proposals make the insurer a joint custodian; data-processing terms are encoded per onboarding (A03).
- Per-tenant residency may require regional data-plane isolation, partially breaking the single-base model (ADR-0001) — an explicit governance trade-off.

## Alternatives considered

- **Whole-database encryption only** — protects at rest but not field-by-field by role, and still exposes PII to any service that reads the row. Rejected as insufficient.
- **Tokenisation service for all PII** — strong, but heavier to operate for V1; envelope encryption with role-gated decryption is the pragmatic balance, with tokenisation a future option.



