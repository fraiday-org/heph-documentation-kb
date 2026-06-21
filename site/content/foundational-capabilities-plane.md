---
title: "Foundational-Capabilities Plane"
subtitle: "Heph — BFF, gateway, events, secrets, notifications, idempotency, audit"
author: "Platform Architecture · Heph"
date: "June 2026"
---

## 1. Purpose and ownership

The Foundational-Capabilities Plane provides the shared mechanisms every business capability depends on
but none should re-implement. It is the platform's standard library: the BFF and API gateway that move
requests safely, the event backbone that moves facts, the secrets and PII vault that protect data, the
notification fabric that reaches RMs and customers, and the cross-cutting concerns — idempotency,
audit, rate limiting — that make a multi-tenant system safe. If the Capabilities Plane is the verbs of
the platform, this plane is the grammar.

![Figure 1 — Foundational services sit between the BFF edge and the private core: gateway, event backbone, vault, secrets.](04-bff-multitenant-trust-boundary.png){width=100%}

## 2. What this plane owns

| Service | Responsibility |
|---------|----------------|
| BFF middleware | Terminates the user session, resolves tenant, exchanges OIDC code, mints scoped tokens, shapes screen responses |
| API gateway | mTLS entry to the private core; authZ, routing, quotas |
| event-bus + schema registry | Versioned domain events with at-least-once delivery |
| vault-svc | Field-level PII encryption/decryption, role-gated |
| secrets manager | Insurer and integration credentials, never in config or the browser |
| notify-svc | SMS, email, and in-app notifications, per-tenant templates |
| idempotency middleware | Idempotency keys and safe retries for all external effects |
| audit-log | Immutable, append-only record of transitions and access |

## 3. The BFF as the keystone

The BFF is the most important foundational service because it is where the trust boundary is drawn
(ADR-0002, detailed in P02). It is the only component that holds the user session; the browser holds an
httpOnly cookie and never a token. The BFF resolves the tenant from the SSO assertion, performs the OIDC
code exchange with the lender IdP, and mints short-lived tokens for the private core. It also aggregates
core responses into screen-shaped payloads so the front end stays thin and no business logic leaks to
the client.

## 4. Events, idempotency, and at-least-once

The event backbone is foundational because every plane rides on it: the data plane consumes it, the
capabilities plane emits to it, compliance audits through it. Delivery is at-least-once, so idempotency
is not optional — every consumer dedupes on event id, and every externally-visible effect (LOS premium
write, payment intent, COI request) is guarded by an idempotency key so a retry is a no-op. This single
discipline is what makes the distributed backend correct under failure.

## 5. Secrets, the vault, and notifications

- **Secrets manager** holds insurer API credentials and integration secrets. They are injected into services at runtime, never stored in tenant config, never sent to the front end.
- **PII vault** performs envelope encryption for DOB, PAN, and other sensitive fields; the Compliance Plane (A02) owns the decryption policy, this plane owns the mechanism.
- **Notification fabric** drives the communication triggers from the PRD — consent OTP, consent confirmation, payment and disbursement events, policy issued, stuck-case alerts — across SMS, email, and in-app, with per-tenant templates and recipients.

## 6. Cross-cutting concerns

| Concern | Mechanism |
|---------|-----------|
| Idempotency | keys on every external effect; dedupe on event id |
| Rate limiting & quotas | per-tenant limits to prevent noisy-neighbour impact |
| Resilience | timeouts, retries with backoff, circuit breakers on insurer/LOS/PG calls |
| Audit | append-only log, retention per Compliance policy |
| Observability hooks | correlation ids threaded from BFF through events to data plane |

## 7. How the plane serves the journey

This plane is felt at every step but owned by none of them. P1 depends on the BFF and gateway; P4 and
P5 depend on the vault, secure-link, and OTP fabric; P6 depends on idempotency and notifications;
P0 depends on the audit log and correlation ids. Its quality is invisible when it works and catastrophic
when it does not, which is why it is specified as a plane in its own right.

## 8. Non-functional requirements

- BFF fails closed: no tenant, no session, no token.
- All inter-service traffic mTLS inside the core.
- Every external effect idempotent and time-bounded.
- Correlation id threaded end to end for traceability.
- Per-tenant rate limits and quotas enforced at the gateway.

## 9. Risks and open questions

- **BFF as a single chokepoint.** It must be horizontally scaled and stateless (session in a shared store), or it becomes a bottleneck and a SPOF.
- **Notification provider dependence.** OTP and link delivery depend on third parties; failures must degrade safely (the case waits, never auto-advances).
- **Idempotency discipline.** It only works if every team applies it; it must be a platform default, not a per-service choice.

## 10. Engineering handoff checklist

A team touching this plane must: keep the BFF stateless with session in a shared store; enforce mTLS and
per-tenant quotas at the gateway; guard every external effect with an idempotency key; thread the
correlation id; and treat the audit log as append-only. Binding decisions: ADR-0002 (auth boundary),
ADR-0003 (events), ADR-0009 (PII vault).
