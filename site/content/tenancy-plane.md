---
title: "Tenancy Plane"
subtitle: "Heph — multi-tenant identity, isolation, white-labelling, and reuse"
author: "Platform Architecture · Heph"
date: "June 2026"
---

## 1. Purpose and ownership

The Tenancy Plane is what makes Heph a multi-tenant product rather than many copies of an application.
It owns how a tenant is identified, how tenant data and behaviour are isolated, how each tenant gets a
branded experience, and how all of that is achieved through reuse of one centralised platform rather
than per-lender forks. The multi-tenant reuse principle is the platform's core economic claim: onboard
once, configure many times, fork never.

## 2. The defining rule: tenant resolved on login, never chosen

A tenant is a lender. The tenant is established automatically from the SSO context at login — the RM
arrives through their lender's portal, and the identity assertion carries the tenant claim. The user
never picks a tenant from a list. From that moment, every read, write, event, and config lookup is
scoped to the resolved tenant.

![Figure 1 — Tenant resolution happens in the BFF at the edge; the tenant claim scopes everything behind it.](04-bff-multitenant-trust-boundary.png){width=100%}

## 3. What this plane owns

| Responsibility | What it means in Heph |
|----------------|------------------------|
| Tenant resolution | Deriving the tenant from the SSO assertion at the BFF; binding it to the session |
| Isolation | Row-level tenant scoping on every store; no query runs without a tenant predicate |
| White-labelling | Per-tenant subdomain or custom domain, branding, journey labels |
| RBAC | Role + tenant scope on every capability; the access matrix from A01 §3 |
| Per-tenant configuration | The configuration store that drives journey, catalogue subset, funding mode, consent and medical settings |
| Reuse | One set of services and one catalogue engine, parameterised per tenant |

## 4. The isolation model

Heph uses shared services with row-level tenant scoping plus a per-tenant configuration store
(ADR-0001). Every domain table carries a tenant key; the data-access layer refuses any query that does
not constrain on it, so isolation is enforced by construction rather than by developer discipline.
Cross-tenant access exists only for Heph-side roles (Operations, Platform Admin, assigned Solutions
Engineers) and is always authorised and audited.

The alternative models were considered and rejected for V1: a database-per-tenant maximises isolation
but defeats the centralisation and reuse goals and multiplies operational cost; a fully pooled model
without row-level enforcement is too easy to get wrong. Shared-with-row-scoping is the balance that
keeps one base while making leakage structurally hard.

## 5. White-labelling and per-tenant configuration

Each lender gets its own branded surface — subdomain or custom domain — with its own logo, journey
labels, and legal disclosures. Behind the brand, a configuration store parameterises behaviour the
platform otherwise holds constant:

| Configurable per tenant | Examples |
|-------------------------|----------|
| Channel & branding | domain, logo, colours, RM banner |
| Journey | trigger field label, LAN validation, editable LOS fields, masking |
| Catalogue subset | which products and insurers are offered |
| Funding | Mode A, Mode B, or both, and the default |
| Consent | OTP TTL, resend cap, message template |
| Medical | RM-led vs customer-led, per product |
| Connection | LOS integration mode (API / webhook / SFTP) |

Configuration is itself a governed, versioned artefact (A03); the Tenancy Plane provides the store and
the resolution, Governance controls how it changes.

## 6. Identity verification and platform reuse

Platform identity verification spans three layers: the user (authenticated by the lender IdP), the
tenant (resolved from the assertion), and the service-to-service identity inside the core (mTLS, A07).
Reuse is achieved because none of the business services are tenant-specific — they read tenant config
and tenant-scoped data, but the code is identical for every lender. A new lender is an onboarding
exercise (branding, config, LOS integration, catalogue subset), not a development project.

## 7. How the plane serves the journey

Every pillar runs inside a tenant scope established before Step 1 even renders. P1 depends on this plane
most directly — tenant resolution and SSO — but P2–P6 each read tenant configuration (catalogue subset,
funding mode, consent settings) and write tenant-scoped data. The Cases dashboard (P0) shows only the
RM's own tenant, and only their own cases unless their role widens the scope.

## 8. Non-functional requirements

- No data path without a tenant predicate; isolation verified by automated tests, not convention.
- Tenant resolution adds negligible latency and fails closed (no tenant ⇒ no session).
- White-label domains terminate TLS correctly per tenant.
- Configuration changes propagate without redeploying services.

## 9. Risks and open questions

- **Noisy-neighbour.** Shared services mean one tenant's load can affect others; per-tenant rate limits and quotas are required (A07).
- **Residency pull.** A tenant requiring in-country data may need regional isolation, partially breaking the single-base model (A02, A03).
- **Config complexity.** Rich per-tenant config raises the test matrix; contract tests per tenant profile mitigate it.

## 10. Engineering handoff checklist

A team touching this plane must: resolve tenant at the BFF and thread the scope through every call;
never issue a store query without a tenant predicate; read behaviour from tenant config rather than
branching on lender identity in code; and keep all services tenant-agnostic so reuse holds. Binding
decision: ADR-0001 (multi-tenant isolation).
