---
title: "Data Plane — Medallion & Intelligence"
subtitle: "Heph — events, the medallion pipeline, reporting, and proactive intelligence"
author: "Platform Architecture · Heph"
date: "June 2026"
---

## 1. Purpose and ownership

The Data Plane owns everything that happens to a business fact after it is true. It captures domain
events from the backbone, lands them, refines them through the medallion progression, serves reporting
and MIS, and produces the proactive intelligence that turns a distribution platform into a system that
can anticipate. It is the plane that makes the platform observable as a business, not just as software.

## 2. The shape of the plane

![Figure 1 — The event-driven backbone feeding the medallion pipeline, with the transactional DB as a CDC source and reporting off the gold layer.](05-event-medallion-dataflow.png){width=100%}

Two cooperating spines run through this plane: an **event backbone** that moves facts between services
in near real time, and a **medallion pipeline** that progressively refines those facts for analytics.
The transactional database is a source, not the destination; the data platform is fed by events and by
change-data-capture from the transactional store.

## 3. The event backbone

Services publish versioned domain events — `case.initiated`, `quote.received`, `consent.received`,
`policy.issued`, and the rest of the taxonomy in A01 §5. The backbone is schema-contract-driven with a
schema registry, and delivery is at-least-once, which makes idempotent consumers mandatory (ADR-0003).
Consumers are stateless and independently scalable: a state projector rebuilds case state, a
notification service drives SMS/email/in-app, an audit consumer writes the immutable log, and a CDC
consumer streams into the landing layer.

> Because state is rebuilt from events, any service instance can serve any tenant, and the case state
> machine (A00, Figure 5) is a projection — not a value held in one service's memory.

## 4. The medallion pipeline

| Layer | Contents | Consumer |
|-------|----------|----------|
| Landing | Raw events and raw LOS / insurer payloads, exactly as received | ingestion only |
| Bronze | Typed, validated, deduplicated records | data engineering |
| Silver | Conformed and joined entities (case, loan, quote, consent, policy) | analysts, marts |
| Gold | Business marts: the distribution funnel, MIS aggregates, premium and policy counts | reporting, finance |
| Proactive intelligence | Signals derived from gold: stuck-case risk, drop-off prediction, cross-sell propensity | ops, product |

Each layer is a contract: a downstream consumer depends on the shape of the layer it reads, never on the
raw upstream. This is what lets the platform evolve insurer integrations without breaking reporting.

## 5. Reporting and MIS

The Gold layer is the source for the day-wise distribution funnel (segmented by tenant, RM, parent
product, and insurer), the insurer- and product-wise breakdowns, and the daily MIS mail to the internal
business team. The funnel stages mirror the case states exactly — Total Initiated, Loan Data Fetched,
Suitability Selected, Quote Generated, Cart Created, Proposal Completed, Medical Completed, Consent Sent
and Received, Payment/Disbursement Completed, Policy Issued, and Failed/Cancelled — so the funnel always
reconciles to the case ledger. RM-facing pages carry click-stream tracking for drop-off analysis.

## 6. Proactive intelligence

The intelligence layer is where the platform earns the "proactive" in its data strategy. From the gold
marts it derives signals the rest of the platform can act on: which cases are likely to stick before
they cross the 48-hour threshold, where in the funnel a tenant or RM is losing cases, and which
borrowers are strong cross-sell candidates for add-on products. These signals are projections, computed
from governed data, and surfaced to Operations and Product rather than acting autonomously in V1.

## 7. Data quality, lineage, and governance

- **Quality gates** between bronze and silver reject or quarantine malformed records rather than poisoning marts.
- **Lineage** is traceable from any gold metric back through silver and bronze to the landing payload and the originating event.
- **Tenant scoping** persists through every layer; a tenant's analytics never co-mingle with another's in a shared mart without explicit, governed aggregation.
- **Retention** follows the Compliance Plane's per-tenant policy (A02).

## 8. How the plane serves the journey

Every journey step emits events that this plane captures, so the plane serves the journey mostly after
the fact — but two effects are felt live: the Cases dashboard and stuck-case alerts (P0) are projections
this plane maintains, and the suitability and cross-sell signals that inform P2 originate here.

## 9. Non-functional requirements

- Near-real-time event propagation; bounded consumer lag with alerting.
- Idempotent, replayable consumers; the pipeline can be rebuilt from landing.
- Schema-registry enforcement on every event and layer boundary.
- Reconciliation between the gold funnel and the transactional case ledger.

## 10. Risks and open questions

- **At-least-once duplicates.** Every consumer must dedupe on event id; this is a correctness requirement, not an optimisation.
- **Residency of analytics.** Gold marts inherit the residency obligations of their source tenants (A02).
- **Intelligence governance.** As signals begin to drive action (nudges), they move from reporting into the governed change surface (A03).

## 11. Engineering handoff checklist

A team touching this plane must: consume events idempotently keyed on event id; respect the layer
contracts (never read raw upstream from a downstream job); keep tenant scope through every layer; and
reconcile gold against the case ledger. Binding decisions: ADR-0003 (events), ADR-0004 (medallion).
