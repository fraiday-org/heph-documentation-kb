---
title: "Heph — Executive Architecture Overview"
subtitle: "Multi-Tenant Embedded Insurance Distribution Platform · Architecture & Platform Definition"
author: "Platform Architecture · Heph"
date: "June 2026"
---

## 1. Purpose of this document set

This is the anchor document for the Heph architecture and platform definition. It states what the
platform is, the operating model it runs under, the architectural planes it is organised into, and
the decisions that bind them together. Every other document in the set elaborates one slice of what
is summarised here.

The set is deliberately segregated so that product, engineering, compliance, and infrastructure
readers can each reach the depth they need without wading through the others. The map is:

| # | Document | Plane / theme | Primary reader |
|---|----------|---------------|----------------|
| A00 | Executive Architecture Overview | whole platform | everyone |
| A01 | Product Scope & RM Journey Pillars | journey ⇄ architecture | product + engineering |
| A02 | Compliance Plane | regulatory + trust boundary | compliance, security |
| A03 | Governance Plane | change, catalogue, approvals | platform owners |
| A04 | Tenancy Plane | multi-tenant identity & isolation | engineering |
| A05 | Data Plane (Medallion) | data, events, intelligence | data engineering |
| A06 | Capabilities Plane | the business capabilities | product + engineering |
| A07 | Foundational Capabilities Plane | shared platform services | engineering |
| A08 | Infra-Core Plane | AWS, IaC, networking, observability | infrastructure |
| ADRs | Architecture Decision Records | cross-cutting decisions | architects |
| P01–P04 | Platform Stack | BFF, events, payments | engineering |

> This document set is a product-to-engineering handoff artefact. It is written so that a feature can be
> traced from a screen in the RM journey, through the capability that powers it, down to the service,
> contract, event, and state transition that implement it.

## 2. What Heph is

Heph lets a lender — a bank or NBFC — offer insurance to its borrowers as an embedded step inside the
loan journey rather than as a separate, manual sale. A Relationship Manager (RM) at the lender runs
the entire insurance process on the customer's behalf from a single branded web workstation. The
customer's only mandatory action is approving the policy via a one-time password (OTP) on their
registered mobile.

The platform sits between four external systems and orchestrates a deterministic, multi-product
distribution journey across them:

- the lender's **loan origination system (LOS)** — the source of truth for loan and borrower data, and the destination for the premium charge and the issued certificate;
- the lender's **identity provider (IdP)** — single sign-on, which also establishes which tenant the session belongs to;
- one or more **insurer APIs** — the source of live quotes, proposals, and certificates of insurance (COI);
- a **payment gateway** — used when the premium is collected directly from the customer.

![Figure 1 — Platform context: Heph between lender LOS/IdP, insurer APIs, the payment gateway, and the customer.](01-platform-context.png){width=100%}

### 2.1 The shape of the product in one paragraph

A single, white-labelled, multi-tenant SaaS application serves every lender from one centralised code
and infrastructure base. On login the tenant is resolved automatically and the RM is dropped into a
fixed ten-step journey: enter a loan account number, hydrate borrower and loan data from the LOS,
choose the insured person, select a lead product, fetch and compare live quotes, build a cart, complete
the proposal, capture health declarations, collect per-product OTP consent, and — on disbursement or
payment — issue and deliver the certificate. The journey is deterministic: a case can only ever be in
one well-defined state, and it moves forward only when a step genuinely completes.

## 3. Operating model and multi-tenancy

The platform is multi-tenant by design. One deployment serves all lenders; a tenant is a lender, and
the tenant is identified on login from the SSO context — never selected by hand. Everything a lender
sees and can do is scoped to its tenant, and almost every behaviour is configurable per tenant on top
of a sensible platform default.

| Dimension | Platform default | Tenant-configurable? |
|-----------|------------------|----------------------|
| Primary user | Lender Relationship Manager | No |
| Customer-facing surface | OTP only (no portal) | Yes — subdomain / custom domain |
| Channel | Tenant-branded Heph web portal | Yes — branding, domain |
| Journey trigger | SSO + loan account number | Yes — trigger field, labels, validations |
| Source of loan truth | Tenant LOS | Yes — connection mode (API / webhook / SFTP) |
| Source of insurance truth | Heph orchestrator + insurer APIs | No |
| Funding | Bank-funded (premium in disbursement) | Yes — Mode A, Mode B, or both |
| Consent capture | OTP to LAN-registered mobile | Yes — TTL, resend cap, template |
| Medical authoring | RM-led | Yes — per product, switchable to customer-led |

The platform identity and isolation model — how a tenant is resolved, how data is partitioned, and how
reuse is achieved without leakage — is the subject of the Tenancy Plane (A04). The multi-tenant reuse
principle is what makes the economics work: one onboarding studio, one catalogue engine, one journey
engine, configured many times, never forked.

## 4. Architecture planes

The platform is organised into five horizontal capability layers and two cross-cutting governance
planes. A plane is an ownership and reasoning boundary: it groups capabilities that change together,
are operated by the same people, and share the same non-functional profile.

![Figure 2 — Architecture planes: five horizontal layers with governance and compliance cutting across all of them.](03-architecture-planes.png){width=92%}

| Plane | Owns | Document |
|-------|------|----------|
| Tenancy & identity | tenant resolution, white-labelling, RBAC, SSO, per-tenant config | A04 |
| Capabilities | orchestration, catalogue, quote, proposal, consent, payments, fulfilment | A06 |
| Data | medallion pipeline, event store, proactive intelligence, reporting | A05 |
| Foundational-capabilities | BFF, API gateway, notifications, secrets, audit, idempotency | A07 |
| Infra-core | AWS VPC, IaC, compute, networking, CI/CD, observability | A08 |
| Governance (cross-cutting) | policy, approvals, change management, catalogue governance, SLAs | A03 |
| Compliance (cross-cutting) | PII vault, consent audit, data residency, regulatory controls | A02 |

Governance and compliance are drawn as vertical bands because they are not a layer you pass through
once; they apply to every layer continuously. A catalogue change is a capability-plane action that is
only legal once it has passed governance; a quote response is a data-plane payload that is only legal
once compliance rules on PII and residency have been applied to it.

## 5. The backend in one picture

The backend is schema-contract-driven, stateless at the service tier, and event-driven between
services. Business facts are published as versioned domain events; consumers project state, notify,
audit, and feed the data platform. The data platform follows a medallion progression from raw landing
through to a proactive intelligence layer.

![Figure 3 — Event-driven backbone feeding the medallion data platform.](05-event-medallion-dataflow.png){width=100%}

Three properties make this tractable at multi-tenant scale:

- **Schema contracts first.** Every interface — LOS payload, insurer quote, domain event, catalogue entry — is a versioned contract. Producers and consumers are decoupled by the contract, not by deployment timing.
- **Stateless services.** Case state lives in the transactional store and is rebuilt from events, not held in service memory, so any instance can serve any tenant and the tier scales horizontally.
- **Determinism.** The case state machine is explicit (Section 7); transitions are driven by events, and the parent-first partial-issuance rule guarantees a legally coherent outcome even when some products fail.

## 6. The auth trust boundary

The front end never holds tokens. A Backend-for-Frontend (BFF) middleware terminates the user session,
performs the OIDC code exchange with the lender IdP, resolves the tenant, and mints short-lived,
tenant-scoped tokens for the private core, which is reached only over mTLS. This is the platform's
primary trust boundary and is detailed in P02 and ADR-0002.

![Figure 4 — The BFF auth trust boundary across the public edge, BFF/DMZ, private core, and data tiers.](04-bff-multitenant-trust-boundary.png){width=100%}

## 7. Determinism: the case state machine

Every insurance case moves through a fixed set of states. The state advances only when a step
completes and can be reset on recoverable failure. This determinism is what makes the platform
auditable and what lets the RM safely resume any case.

![Figure 5 — The case state machine, including the Mode A / Mode B branch and terminal states.](08-case-state-machine.png){width=92%}

## 8. Scope boundaries

Heph distributes insurance; it does not originate loans or adjudicate claims. The boundaries are firm
and load-bearing for the architecture:

- **In scope** — RM-led journey from loan context to policy issuance, LOS data import, real-time multi-insurer quotes, multi-product cart, two payment modes, OTP consent, RM- or customer-led medical declaration, certificate delivery, RM case tracking, and the lender admin console.
- **Out of scope** — loan approval/underwriting/disbursement decisions (owned by the LOS), claims (owned by each insurer), a customer-facing portal or app, renewals/endorsements/mid-term changes, and bulk backdated case upload.
- **Future scope** — bulk ingestion, an RM performance dashboard, a renewal-nudge engine, a customer self-serve portal, and MIS exports beyond Tableau.

## 9. Key architectural decisions

The decisions that shape the platform are recorded as ADRs and summarised here:

| ADR | Decision |
|-----|----------|
| 0001 | Multi-tenant isolation via shared services with row-level tenant scoping and per-tenant config |
| 0002 | BFF-mediated auth trust boundary; no tokens in the browser |
| 0003 | Event-driven backend with versioned schema contracts and at-least-once delivery |
| 0004 | Medallion data strategy (Landing → Bronze → Silver → Gold → Proactive Intelligence) |
| 0005 | Payment establishment & receipt via idempotent gateway integration; COI coupled to settlement |
| 0006 | Insurer onboarding as a React Flow node studio, reused for product extensibility |
| 0007 | Schema-driven, centrally governed product catalogue |
| 0008 | Centralised observability and audit across the NBFC × insurer boundary |
| 0009 | PII vault with field-level encryption and configurable data residency |

## 10. How to read on

Product and engineering readers should go to A01 next: it is the spine of the whole set, mapping every
journey step to the capability, service, contract, event, and state that implement it. Plane owners
should read their plane document (A02–A08). Engineers building the runtime should read the platform
stack documents (P01–P04). Architects evaluating a specific decision should read the relevant ADR.
