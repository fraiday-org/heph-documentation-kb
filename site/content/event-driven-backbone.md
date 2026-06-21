---
title: "Event-Driven Async Queue Backbone"
subtitle: "Heph — domain events, delivery guarantees, idempotency, and the outbox"
author: "Platform Engineering · Heph"
date: "June 2026"
---

## 1. Purpose

This document specifies the asynchronous event backbone that connects the capability services and feeds
the data platform. It is the runtime detail behind ADR-0003. The backbone is what lets services evolve
and scale independently while keeping the case state auditable, resumable, and correct under failure.

![Figure 1 — Producers publish versioned domain events to the backbone; stateless consumers project state, notify, audit, and feed the medallion pipeline.](05-event-medallion-dataflow.png){width=100%}

## 2. Domain event taxonomy

Every meaningful business fact is an event. The core taxonomy mirrors the journey (A01 §5):

| Event | Emitted by | Triggers |
|-------|-----------|----------|
| `case.initiated` | journey-orch | a new case |
| `case.loan_hydrated` | los-adapter | loan data fetched |
| `case.insured_selected` | journey-orch | insured person chosen |
| `case.product_selected` | catalogue-svc | lead product chosen |
| `quote.requested` / `quote.received` | quote-svc | live quoting |
| `cart.confirmed` / `premium.posted_to_los` | cart-svc | cart proceed |
| `case.proposal_saved` | proposal-svc | proposal per insurer |
| `health.submitted` / `health.link_*` | uw-svc | medical declaration |
| `consent.otp_sent` / `consent.received` / `consent.declined` / `consent.expired` | consent-svc | per-product consent |
| `disbursement.confirmed` / `payment.succeeded` | payment-svc | settlement |
| `policy.issued` / `coi.delivered` | fulfilment-svc | issuance |
| `case.stuck` | monitor | >48h without progress |

## 3. Schema registry and versioning

Every event conforms to a versioned schema in `packages/contracts`, enforced by a schema registry.
Evolution rules (governed under A03): producers may add optional fields; consumers must tolerate unknown
fields; breaking changes are a new version, never a mutation; an old version is retired only when
telemetry shows no consumer remains on it. This is what decouples producers from consumers in time.

## 4. Reliable publish: the transactional outbox

A service must never commit a state change to its database and then fail to publish the corresponding
event (or vice versa). The backbone uses the **transactional outbox** pattern: a service writes its
domain change and an outbox row in the **same database transaction**; a relay then publishes outbox rows
to the backbone and marks them sent. The effect is exactly-once *production* semantics on top of an
at-least-once *transport*, with no lost or phantom events.

## 5. Delivery guarantees and idempotency

Delivery is **at-least-once**: a consumer may see an event more than once. Therefore every consumer is
**idempotent**, deduping on the event id (and, where relevant, a business key). Every externally-visible
effect a consumer performs — writing premium to the LOS, creating a payment intent, requesting a COI —
is itself guarded by an **idempotency key** so a re-delivery is a no-op. Idempotency is a platform
default provided by `packages/events`, not a per-service afterthought.

## 6. Ordering and partitioning

Strict global ordering is neither available nor needed. The backbone partitions by **case id within
tenant**, which guarantees per-case ordering — all events for one case are processed in order — while
allowing cases (and tenants) to be processed in parallel for scale. Consumers that need cross-case
aggregation (the data plane) tolerate interleaving and reconcile in the medallion layers.

## 7. Consumers

| Consumer | Role | Idempotency basis |
|----------|------|-------------------|
| State projector | rebuilds the case state machine | event id + case version |
| Notification service | SMS / email / in-app triggers | event id (dedupe sends) |
| Audit log | immutable append of transitions and access | event id |
| CDC → Landing | streams events + payloads into the data lake | event id |

## 8. Failure handling

- **Retries with backoff** for transient consumer failures.
- **Dead-letter queue (DLQ)** for events that exhaust retries, with alerting and a replay tool.
- **Replay** from the DLQ or from landing once the defect is fixed — safe because consumers are idempotent.
- **Poison-message isolation** so one bad event never blocks a partition.

## 9. Feeding the medallion pipeline

The CDC consumer streams events and raw LOS/insurer payloads into the **Landing** layer; the medallion
jobs refine landing → bronze → silver → gold → intelligence (ADR-0004, A05). Because the pipeline is fed
from the same event stream that drives operational state, the gold funnel reconciles to the case ledger
by construction.

## 10. Engineering checklist

Publish via the transactional outbox; never commit state without the matching outbox row; consume
idempotently keyed on event id; guard every external effect with an idempotency key; partition by case
within tenant for per-case ordering; send exhausted events to the DLQ with replay; and evolve schemas
additively. Binding decision: ADR-0003.
