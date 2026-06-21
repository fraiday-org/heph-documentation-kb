---
title: "BFF Middleware & Auth Trust Boundary"
subtitle: "Heph — session custody, tenant resolution, token exchange, and the request lifecycle"
author: "Platform Engineering · Heph"
date: "June 2026"
---

## 1. Purpose

This document specifies the Backend-for-Frontend (BFF) middleware and the auth trust boundary it draws.
It is the runtime detail behind ADR-0002 and the Foundational-Capabilities plane (A07). The BFF is the
single most important service in the stack because it is where authentication, tenant scope, and the
client trust boundary are all decided.

![Figure 1 — The trust boundary: public edge, BFF/DMZ holding the session, private core over mTLS, and the data/secrets tier.](04-bff-multitenant-trust-boundary.png){width=100%}

## 2. The boundary in one sentence

The browser holds an httpOnly session cookie and nothing else; the BFF holds the session, performs the
OIDC exchange, resolves the tenant, and mints short-lived scoped tokens for a private core that is
reachable only over mTLS — so no token, no business logic, and no insurer credential ever reaches the
client.

## 3. Responsibilities of the BFF

| Responsibility | Detail |
|----------------|--------|
| Session custody | Create and validate an httpOnly, secure, SameSite session cookie; session state in a shared store, never in the browser |
| OIDC code exchange | Complete the authorization-code flow with the lender IdP; the BFF is the confidential client |
| Tenant resolution | Derive the tenant from the IdP assertion / SSO context and bind it to the session (ADR-0001) |
| Token mint | Issue short-lived, audience- and tenant-scoped tokens for the private core |
| RBAC pre-check | Attach role and tenant claims; reject out-of-scope requests at the edge |
| CSRF protection | Double-submit / SameSite defences on all state-changing calls |
| Response shaping | Aggregate core responses into screen-shaped payloads so the SPA stays thin |

## 4. The login lifecycle

1. The RM opens the lender portal and follows SSO to Heph; the browser hits the public edge and is routed to the BFF.
2. The BFF starts an OIDC authorization-code flow with the lender IdP (the BFF is the confidential client; the client secret lives in the secrets manager).
3. On callback, the BFF exchanges the code for tokens **server-side**, reads the assertion, and **resolves the tenant** from it.
4. The BFF creates a session (record in the shared store; httpOnly cookie to the browser) carrying the tenant and role claims.
5. The RM lands on the case-initiation screen; the browser now holds only the session cookie.

## 5. The per-request lifecycle

1. The browser sends a request with the session cookie (and a CSRF token for writes).
2. The BFF validates the session, loads the tenant and role, and runs the RBAC pre-check.
3. The BFF **mints a short-lived, scoped token** (tenant + audience + role) and calls the private core through the API gateway over **mTLS**.
4. The gateway verifies the token and routes to the capability service; the service runs stateless, scoped to the tenant, and emits events as needed.
5. The BFF **aggregates** the core responses into a single screen-shaped payload and returns it; no token or raw core response reaches the browser.

## 6. Tenant resolution and isolation

Tenant resolution happens once, in step 3 of login, and is then immutable for the session. Every token
the BFF mints carries the tenant claim; every core service threads it into every store query through the
`packages/tenancy` guards (P01), which refuse a query without a tenant predicate (ADR-0001). The RM never
chooses a tenant and can never act outside it.

## 7. Security controls

- **No tokens in the browser** — defeats token theft and XSS-based exfiltration of credentials.
- **httpOnly, secure, SameSite cookies** — the session is inaccessible to JavaScript.
- **CSRF defences** on every state-changing request.
- **Short-lived, scoped tokens** to the core — a leaked core token expires fast and is tenant- and audience-bound.
- **mTLS** inside the private core — services trust only the gateway and each other.
- **Secrets in the manager** — IdP client secret and insurer credentials are injected at runtime, never in config or the client.
- **Fail closed** — no valid session or no resolved tenant ⇒ no token minted, no core call.

## 8. Scaling and resilience

The BFF must be **stateless** with session state in a shared store, so it scales horizontally and is not
a single point of failure. It is latency-sensitive (it is on every request), so token minting and
session validation are fast and cached where safe. Per-tenant rate limits at the edge and gateway
contain noisy neighbours (A07).

## 9. Engineering checklist

Keep the BFF stateless with session in a shared store; complete OIDC server-side and never expose tokens
to the browser; resolve tenant once and thread it through every minted token; enforce CSRF on writes;
call the core only over mTLS with short-lived scoped tokens; and shape responses so the SPA holds no
business logic. Binding decision: ADR-0002.
