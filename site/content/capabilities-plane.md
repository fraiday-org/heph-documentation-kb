---
title: "Capabilities Plane"
subtitle: "Heph — the business capability services that run the journey"
author: "Platform Architecture · Heph"
date: "June 2026"
---

## 1. Purpose and ownership

The Capabilities Plane is the business heart of the platform: the services that actually run the RM
journey. Where the foundational plane provides shared mechanism (BFF, events, secrets) and the data
plane provides memory and insight, the Capabilities Plane provides meaning — it is where "quote",
"consent", and "issue a policy" live. Each capability is a service with a clear contract, a clear set of
events, and a clear place in the journey.

![Figure 1 — Each journey step is powered by a capability service; this plane is the column of services behind the RM journey.](02-rm-journey-end-to-end.png){width=100%}

## 2. The capability services

| Service | Responsibility | Key inputs / contracts | Key events |
|---------|----------------|------------------------|------------|
| journey-orch | Drives the deterministic 10-step flow and the case state machine | case store, all services | `case.*` transitions |
| los-adapter | Validates the LAN and hydrates loan + borrower data | LOS `validateLoan`, loan contract | `case.loan_hydrated` |
| catalogue-svc | Serves the tenant's product set and suitability rules | catalogue, suitability ruleset | `case.product_selected` |
| quote-svc + insurer adapters | Fetches live premiums from all enabled insurers | insurer `quote` contracts | `quote.requested`, `quote.received` |
| pricing-svc | Computes base premium, GST, totals | tax rules | — |
| cart-svc | Builds the cart and writes the premium total to the LOS | LOS `postPremium` | `cart.confirmed`, `premium.posted_to_los` |
| proposal-svc | Captures applicant and nominee details per insurer | insurer proposal contract, PII vault | `case.proposal_saved` |
| uw-svc + secure-link | Runs per-insurer health questionnaires (RM- or customer-led) | insurer UW contract | `health.submitted`, `health.link_*` |
| consent-svc | Captures per-product, parent-first OTP consent | OTP provider, consent ledger | `consent.*` |
| payment-svc | Establishes payment and records receipt (Mode A/B) | LOS webhook, payment gateway | `disbursement.confirmed`, `payment.succeeded` |
| fulfilment-svc | Requests and delivers certificates of insurance | insurer `COI` contract, notify | `policy.issued`, `coi.delivered` |

## 3. The orchestrator and determinism

journey-orch is the conductor. It does not implement business rules so much as sequence the services
that do, and it owns the case state machine. Its contract with the rest of the plane is simple and
strict: a step is complete only when its service confirms completion, and only a complete step advances
the state. This is what makes the journey resumable — the orchestrator can rebuild any case to its exact
position from the event log and hand the RM back the screen they left.

## 4. The capability boundaries that matter

Three boundaries in this plane are load-bearing and worth stating explicitly:

- **Quote is live, pricing is derived.** quote-svc never returns a cached final premium; it fetches from insurers in real time (default 10-second timeout) and pricing-svc layers tax on top. A stale premium is a correctness bug, not a performance trade-off.
- **Cart writes to the LOS exactly once.** When the RM proceeds, cart-svc posts the total premium to the lender's LOS through an idempotent call; a retry must never double-charge.
- **Consent gates fulfilment, parent-first.** fulfilment-svc issues a product only when consent-svc confirms that product's consent, and never issues anything until the parent product is consented (ADR-0005).

## 5. Product catalogue and extensibility

catalogue-svc is schema-driven (ADR-0007). A product is a governed catalogue entry, not code; adding
Credit Life, EMI Protect, PACI, Wellness, or a future product is a catalogue and onboarding-studio
action (A03). The service resolves the tenant's configured subset, applies suitability rules against the
loan and risk profile, and renders the recommendation tags and coverage ranges the tenant configured —
all without a deployment.

## 6. How the plane serves the journey

This plane *is* the journey: each pillar in A01 maps directly to one or two services above. The mapping
is intentionally one-to-one where possible so that a feature team owns a capability end to end — its
service, its contract, its events, and its slice of the state machine.

| Pillar | Primary service(s) |
|--------|--------------------|
| P1 Identity & context | journey-orch, los-adapter |
| P2 Suitability | catalogue-svc |
| P3 Quote & compose | quote-svc, pricing-svc, cart-svc |
| P4 Proposal & UW | proposal-svc, uw-svc |
| P5 Consent | consent-svc |
| P6 Settlement | payment-svc, fulfilment-svc |

## 7. Non-functional requirements

- Stateless services; case state is rebuilt from events, never held in memory (A05).
- Every external call (LOS, insurer, gateway) is idempotent and time-bounded with a defined timeout and fallback.
- Insurer-facing calls degrade gracefully: one insurer's failure never blocks the others.
- Per-tenant configuration drives behaviour; no service branches on lender identity.

## 8. Risks and open questions

- **Insurer API variance.** Each insurer's quote/proposal/COI contract differs; the adapter layer and onboarding studio absorb this, but contract drift is an ongoing operational cost (A03).
- **Quote latency.** Live multi-insurer fetch within a 10-second budget needs parallelism and partial rendering.
- **Premium write-back coupling.** cart-svc depends on LOS availability; failure handling must keep the case recoverable.

## 9. Engineering handoff checklist

A team owning a capability must: keep its service stateless and idempotent; honour its insurer/LOS
contract version; emit the events in A01 §5; advance the state machine only on genuine completion; and
read all tenant behaviour from config. Binding decisions: ADR-0005 (payments/issuance), ADR-0007
(catalogue), ADR-0003 (events).
