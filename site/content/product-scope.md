---
title: "Product Scope & RM Journey Pillars"
subtitle: "Heph — the journey, mapped to capabilities, services, contracts, events, and states"
author: "Platform Architecture · Heph"
date: "June 2026"
---

## 1. Why this document is the spine

Everything Heph does exists to move one insurance case from a loan context to an issued policy. This
document is the priority artefact of the whole set because it is where product scope and engineering
reality are reconciled. It takes the ten-step RM journey, groups it into six pillars, and for every
step states the five things an engineer needs and the four things a product owner needs:

- *engineering*: which **systems and contracts** are touched, which **domain events** are emitted, which **case state** results, and the **acceptance criteria** that define done;
- *product*: **who acts**, **what happens**, **what is configurable per tenant**, and **what can go wrong**.

![Figure 1 — The RM journey end to end, as a product-to-engineering handoff: actor, step, systems & contracts, resulting state.](02-rm-journey-end-to-end.png){width=100%}

## 2. Product scope

Heph is an RM-led, lender-fronted, embedded-insurance distribution platform. The RM runs the journey;
the customer only consents. The scope is firm:

| | Scope |
|---|-------|
| In | RM journey from loan context to issuance; LOS data import; live multi-insurer quotes; insured = borrower or co-borrower; multi-product cart (one lead + add-ons); Mode A and Mode B funding; OTP consent; RM- or customer-led medical; COI download & share; RM case dashboard; lender admin console |
| Out | Loan approval / underwriting / disbursement decisions (LOS); claims (insurer); customer portal or app; renewals / endorsements / mid-term changes; bulk backdated upload |
| Products | Credit Life · EMI Protect · PACI (accident + critical illness) · Wellness — each tenant configures which it offers |
| Funding | Mode A bank-funded (premium folded into disbursement via a charge code) · Mode B customer-paid (payment gateway). Single-premium always, paid once at disbursement. |

## 3. Personas and access

Three classes of user — lender-side, Heph-side, and the customer (who never logs in). Access is
role-based and tenant-scoped; the matrix below is the product-level statement of intent that the
Tenancy (A04) and Compliance (A02) planes enforce technically.

| Role | View cases | Run journey | Configure tenant | Cross-tenant |
|------|-----------|-------------|------------------|--------------|
| Lender RM | Own only | Yes | No | No |
| Lender Admin | All in tenant | Configurable | Yes | No |
| Lender Compliance / Audit | All in tenant (read-only) | No | No | No |
| Heph Solutions Engineer | Assigned tenants | No | Yes (onboarding) | Assigned |
| Heph Operations | All (mostly read) | No | No | Yes |
| Heph Platform Admin | All | No | Yes (platform-wide) | Yes |
| Customer | — (out of platform) | — | — | OTP only |

## 4. The six journey pillars

The ten steps group into six pillars plus one cross-cutting pillar. A pillar is a unit of product
meaning and a natural service boundary.

| Pillar | Steps | What it secures | Primary capability owner |
|--------|-------|-----------------|--------------------------|
| P1 · Identity & context | 1–2 | the right RM, the right tenant, the right loan | Tenancy + Journey orchestration |
| P2 · Suitability & selection | 3–4 | the right insured person and a suitable product | Catalogue + suitability rules |
| P3 · Quote & compose | 5–6 | a priced, compared, confirmed cart | Quote + pricing |
| P4 · Proposal & underwriting | 7–8 | a complete, compliant application | Proposal + insurer UW |
| P5 · Consent & authorisation | 9 | informed, per-product customer consent | Consent service |
| P6 · Settlement & fulfilment | 10 | money settled, policy issued, COI delivered | Payments + fulfilment |
| P0 · Case management & observability | all | resumability, audit, MIS | Case store + data plane |

## 5. Pillar-by-pillar handoff

Each step below is stated as a handoff record. *State* is the case state on completion (see the state
machine in A00, Figure 5).

### P1 · Identity & context

**Step 1 — Entry / login.** The RM reaches Heph through the lender portal via SSO; no separate Heph
password. The tenant is resolved from the SSO context. The RM enters a Loan Account Number (LAN) to
open a case; Heph validates it against the LOS.

- Systems & contracts: Lender IdP (OIDC); LOS `validateLoan(LAN)` contract.
- Events: `case.initiated`.
- State: **Initiated**.
- Configurable: trigger field label, LAN validation pattern, legal disclosures.
- Failure: invalid / not-found LAN → inline error, re-enter; IdP failure → no session.
- Acceptance: a valid LAN under an authenticated, tenant-scoped session creates exactly one case in Initiated.

**Step 2 — Loan data.** Borrower and loan details are hydrated from the LOS and shown read-only.

- Systems & contracts: LOS loan contract (loan type, amount, tenure, EMI, rate; borrower name, DOB, gender, mobile, address; optional co-borrower and risk profile).
- Events: `case.loan_hydrated`.
- State: **Loan Data Fetched**.
- Configurable: which fields are editable (default none), masking of mobile, visibility of EMI/rate.
- Failure: LOS timeout/error → Failed (retryable).
- Acceptance: every field renders from the LOS payload; no field is writable unless the tenant config opens it.

### P2 · Suitability & selection

**Step 3 — Insured person.** If a co-borrower exists, the RM selects who is insured; otherwise the
borrower is auto-selected. Age is computed from DOB and gates product eligibility.

- Systems & contracts: case store; DOB read from PII vault to compute age (DOB itself never shown).
- Events: `case.insured_selected`.
- State: **Loan Data Fetched** (sub-state advances).
- Acceptance: age outside an insurer's accepted range disables that product downstream with a reason.

**Step 4 — Product selection (suitability).** Products valid for the loan type and profile render as
cards; the RM picks exactly one **lead (parent) product**. Selection triggers background quote fetch.

- Systems & contracts: Catalogue `listProducts(tenant, loanType, profile)`; suitability ruleset; on select, async `fetchQuotes`.
- Events: `case.product_selected`, `quote.requested`.
- State: **Suitability Selected**.
- Configurable: which products are shown, recommendation tags, context blurb, coverage ranges per product per insurer.
- Acceptance: exactly one lead product is selectable; hidden products never appear; quote fetch starts on select.

### P3 · Quote & compose

**Step 5 — Quote.** Live premiums from all enabled insurers for the lead product render as cards. The
RM filters, compares, and adds plans (including child add-ons) to the cart. The quote page renders once
the first insurer responds or a configurable timeout (default 10s) elapses.

- Systems & contracts: Insurer adapters `quote` contract (per insurer); pricing service for tax.
- Events: `quote.received` (per insurer), `cart.item_added`.
- State: **Quote Generated**.
- Configurable: sum-insured slabs, cover-period options, insurer set, quote timeout.
- Failure: insurer timeout → that insurer omitted, others shown; all fail → Failed (retryable).
- Acceptance: premiums are live, never cached as final; the coverage meter reflects cart contents.

**Step 6 — Cart.** A line-item breakdown (base premium, GST, final premium) with totals. The RM picks
the payment mode if the tenant has both enabled, then proceeds, which writes the total premium to the LOS.

- Systems & contracts: pricing; LOS `postPremium(LAN, amount, mode)`.
- Events: `cart.confirmed`, `premium.posted_to_los`.
- State: **Quote Generated** (cart confirmed).
- Configurable: payment mode availability and default.
- Acceptance: removing the lead product returns to Quote; totals always equal the sum of line items; the LOS receives the correct total exactly once.

### P4 · Proposal & underwriting

**Step 7 — Proposal.** The application form, pre-filled from the LOS. The RM completes the remainder —
PAN (mandatory for credit-linked), annual income (if coverage exceeds the income threshold), email,
occupation, and nominee (plus appointee if the nominee is a minor).

- Systems & contracts: Proposal contract per insurer; PII vault for PAN/DOB (encrypted at rest, not displayed).
- Events: `case.proposal_saved` (per insurer).
- State: **Proposal in Progress**.
- Configurable: editable vs locked fields, occupation master, pincode auto-fill.
- Acceptance: PAN passes regex and is stored encrypted; minor nominee forces an appointee; each insurer's form is saved before continuing.

**Step 8 — Health declaration.** Each insurer's questionnaire is completed one at a time, either RM-led
(Mode A, default) or customer-led via a secure mobile link (Mode B).

- Systems & contracts: insurer underwriting contract; secure-link service (TTL, resend cap) for customer-led.
- Events: `health.submitted` (per insurer), `health.link_sent` / `health.link_completed`.
- State: **Medical in Progress**.
- Configurable: authoring mode per product; link TTL and resend cap.
- Acceptance: all insurer forms submitted before consent; customer-led links expire and are resendable within the cap.

### P5 · Consent & authorisation

**Step 9 — Consent (OTP).** An OTP is sent per product to the customer's LAN-registered mobile. Consent
is **per product**, and the **parent-first partial-issuance rule** governs the outcome: if the parent
product's consent is not received, nothing is issued; with parent consent, each child product is issued
independently as its own consent arrives.

- Systems & contracts: Consent service; OTP/SMS provider; per-product consent ledger.
- Events: `consent.otp_sent`, `consent.received` / `consent.declined` / `consent.expired` (per product).
- State: **Awaiting Consent**.
- Configurable: OTP TTL, resend cap, message template.
- Failure: parent declined/expired → case Cancelled; child declined → that child dropped, others continue.
- Acceptance: every consent transition is audit-logged with timestamp and actor; partial issuance honours parent-first exactly.

### P6 · Settlement & fulfilment

**Step 10 — Disburse / pay → issue → deliver.** On loan disbursement (Mode A) or successful payment
(Mode B), certificates are generated per insurer and delivered. The RM downloads, combines, and shares.

- Systems & contracts: LOS disbursement webhook (Mode A); payment gateway (Mode B); insurer `COI` contract; notification service.
- Events: `disbursement.confirmed` / `payment.succeeded`, `policy.issued` (per insurer), `coi.delivered`.
- State: **Awaiting Disbursement** (A) / **Payment Pending** (B) → **Policy in Issuance** → **Policy Issued**.
- Configurable: share channel (SMS/email), combined-PDF option.
- Acceptance: settlement is idempotent; a COI is requested exactly once per insurer; the COI is written back to the LOS; Policy Issued is terminal.

### P0 · Case management & observability (cross-cutting)

The Cases dashboard is the RM's home: search and filter by name, mobile, or LAN; status tabs; resume
in place; and a stuck-case alert after 48 hours. Behind it, every state transition is an event, every
event feeds the data plane, and the daily MIS and Tableau funnel are projections of that event stream.

- Events: all of the above, plus `case.stuck` (>48h).
- Acceptance: any case is resumable to its exact last step; the funnel reconciles to the case ledger.

## 6. Journey → architecture plane map

This is the load-bearing table of the handoff: every pillar, the planes it leans on, and the services
that implement it.

| Pillar | Tenancy (A04) | Capabilities (A06) | Data (A05) | Foundational (A07) | Compliance (A02) | Governance (A03) |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| P1 Identity & context | tenant + SSO | orchestration, LOS adapter | landing of loan payload | BFF, gateway | session, audit | — |
| P2 Suitability | RBAC | catalogue, suitability | product analytics | config store | eligibility rules | catalogue governance |
| P3 Quote & compose | — | quote, pricing, cart | quote capture | insurer adapters | premium-to-LOS audit | — |
| P4 Proposal & UW | — | proposal | proposal capture | PII vault, secure link | PII encryption | — |
| P5 Consent | — | consent service | consent ledger | OTP/SMS | consent audit | — |
| P6 Settlement | — | payments, fulfilment | settlement + COI | PG, notifications, idempotency | receipt audit | reconciliation |
| P0 Observability | tenant rollups | case store | medallion, MIS | event backbone | audit retention | SLAs |

## 7. Comprehensive capability catalogue

The complete set of business capabilities the platform must provide, each owned by a plane and exposed
through a service. This is the master checklist for engineering scoping.

| Capability | Owner plane | Service | Key contract / event |
|------------|-------------|---------|----------------------|
| Tenant resolution & white-labelling | Tenancy | tenant-svc | SSO claim → tenant config |
| RBAC & data visibility | Tenancy / Compliance | policy-svc | role + tenant scope |
| Loan hydration | Capabilities | los-adapter | `validateLoan`, loan contract |
| Insured-person selection & age gating | Capabilities | journey-orch | `case.insured_selected` |
| Product catalogue & suitability | Capabilities | catalogue-svc | `listProducts`, ruleset |
| Live multi-insurer quoting | Capabilities | quote-svc + adapters | `quote` per insurer |
| Pricing & tax | Capabilities | pricing-svc | base + GST |
| Cart & premium write-back | Capabilities | cart-svc | `postPremium` to LOS |
| Proposal capture | Capabilities | proposal-svc | proposal per insurer |
| Health / underwriting | Capabilities | uw-svc + secure-link | `health.submitted` |
| Per-product consent (parent-first) | Capabilities | consent-svc | consent ledger events |
| Payment establishment & receipt | Capabilities | payment-svc | PG intent, callback |
| Policy issuance & COI | Capabilities | fulfilment-svc | `COI`, `policy.issued` |
| Notifications | Foundational | notify-svc | SMS/email/in-app |
| PII vault & field encryption | Foundational / Compliance | vault-svc | encrypt/decrypt by role |
| Idempotency & retries | Foundational | platform middleware | idempotency keys |
| Event backbone & schema registry | Foundational / Data | event-bus | versioned domain events |
| Medallion data & intelligence | Data | data-platform | landing→gold→signals |
| Reporting & MIS | Data | reporting | Tableau funnel, daily mail |
| Insurer onboarding studio | Governance / Capabilities | onboarding-studio | node graph → catalogue |
| Admin & configuration | Governance / Tenancy | admin-console | per-tenant config |
| Observability & audit | Infra-core / Compliance | telemetry + audit-log | traces, immutable audit |

## 8. Engineering handoff summary

A feature team picking up any pillar should leave this document knowing: the **services** it spans
(Section 7), the **contracts** it must honour (LOS, insurer, catalogue, consent), the **events** it must
emit or consume (Section 5), the **case states** it may move between (A00 §7), and the **acceptance
criteria** that define done (Section 5). Where a decision is non-obvious — isolation, auth, events,
medallion, payments, onboarding, catalogue — the binding rationale is in the ADRs, and the runtime
mechanics are in the platform-stack documents P01–P04.
