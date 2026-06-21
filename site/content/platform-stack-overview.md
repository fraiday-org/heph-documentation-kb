---
title: "Platform Stack — Overview"
subtitle: "Heph — runtime topology, principles, codebase management, and delivery"
author: "Platform Engineering · Heph"
date: "June 2026"
---

## 1. Purpose

This document describes the runtime platform stack: the tiers a request passes through, the principles
the backend obeys, the way the codebase is organised, and how it is delivered. It is the engineering
companion to the architecture-decisions set — where those documents say *what* and *why*, this one says
*how it runs*. The three deep mechanisms — the BFF auth trust boundary, the event async queue, and the
payment establishment/receipt journey — each have their own document (P02–P04); this overview ties them
together.

## 2. Runtime topology

![Figure 1 — Runtime tiers: public edge, BFF/DMZ, private core, and the data & secrets tier, inside a centralised multi-AZ VPC.](09-infra-core-topology.png){width=100%}

A request from an RM crosses four tiers. The browser talks only to the public edge; the edge forwards to
the BFF; the BFF — having resolved the tenant and minted a scoped token — calls the private core over
mTLS through the API gateway; the core services read and write the data and secrets tier and publish
events to the backbone. Nothing skips a tier, and no tier reaches past its next hop.

| Tier | Components | Responsibility |
|------|-----------|----------------|
| Public edge | CDN, WAF, load balancer | TLS, rate limiting, static delivery |
| BFF / DMZ | BFF middleware, session store | session custody, tenant resolution, token mint, response shaping |
| Private core | API gateway, capability services, event backbone | business logic, orchestration, events |
| Data & secrets | transactional DB, PII vault, secrets, data lake | state, PII, credentials, analytics |

## 3. Platform principles

The whole stack is built on five principles, each load-bearing and each traceable to an ADR:

- **Web-app-driven with a BFF trust boundary.** A thin front end holds no tokens; the BFF is the keystone of auth and tenant scope (ADR-0002, P02).
- **Stateless services.** No service holds case state in memory; state is rebuilt from events, so any instance serves any tenant and the tier autoscales (ADR-0003).
- **Schema-contract-driven.** Every interface — LOS, insurer, event, catalogue — is a versioned contract; producers and consumers couple to the contract, not to each other (ADR-0003, ADR-0007).
- **Event-driven, async, idempotent.** Services communicate through versioned domain events with at-least-once delivery; every external effect is idempotent (ADR-0003, P03).
- **Deterministic settlement & issuance.** Money movement and certificate issuance are idempotent and coupled, with parent-first partial issuance (ADR-0005, P04).

## 4. The web application stack

| Layer | Reference choice | Notes |
|-------|------------------|-------|
| Front end | React SPA, thin | renders BFF screen payloads; no business logic, no tokens |
| BFF | Node/TypeScript middleware | session, OIDC code exchange, tenant resolve, aggregation |
| API gateway | managed gateway | mTLS, authZ, routing, per-tenant quotas |
| Capability services | containerised (language per service) | stateless, idempotent, one capability each (A06) |
| Event backbone | managed streaming + schema registry | at-least-once, partitioned by case/tenant |
| Transactional store | managed relational DB | row-level tenant scoping (ADR-0001) |
| PII vault / secrets | KMS-backed vault + secrets manager | field encryption, credential injection (ADR-0009) |
| Data lake | object store + medallion jobs | landing → gold → intelligence (ADR-0004) |

Reference choices are illustrative of the intended shape, not a mandate; the IaC binds them to the
managed services of the chosen compliance boundary (A08).

## 5. Codebase management

The platform is a governed **monorepo** so that contracts, shared libraries, services, the BFF, the
front end, and the infrastructure evolve together with one source of truth for every schema contract.

```
heph/
├── apps/
│   ├── web/                 # thin React SPA (renders BFF screen payloads)
│   └── bff/                 # BFF middleware: session, OIDC, tenant resolve, aggregation
├── services/
│   ├── journey-orch/        # state machine + journey sequencing
│   ├── los-adapter/         # LAN validation + loan hydration
│   ├── catalogue-svc/       # schema-driven product catalogue + suitability
│   ├── quote-svc/           # live multi-insurer quoting
│   ├── pricing-svc/         # base premium + GST
│   ├── cart-svc/            # cart + premium write-back to LOS
│   ├── proposal-svc/        # applicant + nominee capture
│   ├── uw-svc/              # health / underwriting + secure link
│   ├── consent-svc/         # per-product, parent-first OTP consent
│   ├── payment-svc/         # establishment + receipt (Mode A/B)
│   └── fulfilment-svc/      # COI request + delivery
├── packages/
│   ├── contracts/           # versioned schemas: LOS, insurer, events, catalogue
│   ├── events/              # event SDK: publish/consume, idempotency, dedupe
│   ├── tenancy/             # tenant resolution + row-scope guards
│   ├── auth/                # token mint/verify, RBAC helpers
│   └── observability/       # correlation id, tracing, structured logging
├── studio/
│   └── insurer-onboarding/  # React Flow node studio (admin)
├── infra/                   # infrastructure-as-code (network, compute, data, CI/CD)
└── pipelines/               # CI/CD definitions + contract-test harness
```

The `packages/contracts` directory is the spine: every service depends on it, and a contract change is a
reviewed, versioned event (A03). The `packages/tenancy` guards make a tenant-less query a compile- or
test-time failure (ADR-0001).

## 6. Environments and delivery

Three environments — development, staging, production — are the same IaC with different parameters.
Delivery is pipeline-driven (A08): code and config are promoted, never hand-applied; releases are staged
and per-tenant targetable so a change pilots with one lender before general availability; and the same
pipeline runs the contract-test harness the insurer onboarding studio depends on (ADR-0006). Every
release is reversible.

## 7. How the three deep documents fit

| Mechanism | Document | One-line role |
|-----------|----------|---------------|
| Auth trust boundary | P02 | how the BFF holds the session and scopes every call |
| Event async queue | P03 | how facts move reliably and idempotently between services |
| Payments | P04 | how money is established, received, and coupled to issuance |

Read P02 next for the request lifecycle and the trust boundary in detail.
