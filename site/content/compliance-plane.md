---
title: "Compliance Plane"
subtitle: "Heph — regulatory controls, PII protection, consent audit, and the trust boundary"
author: "Platform Architecture · Heph"
date: "June 2026"
---

## 1. Purpose and ownership

The Compliance Plane is one of the two cross-cutting planes. It does not sit in the request path as a
single layer; it applies continuously to every layer beneath it. Its job is to make sure that every
action the platform takes on behalf of a lender and an insurer is legally coherent: that personal data
is protected, that consent is genuine and provable, that data stays where it is allowed to stay, and
that the boundary between the lender, the platform, and the insurer is a trust boundary rather than a
leak.

Heph distributes regulated insurance products on behalf of regulated lenders. The platform is the
custodian of borrower personal data in flight between the lender's loan system and the insurer. That
custodianship is the reason this plane exists and the reason it is drawn cutting across the whole
stack in the architecture-planes figure (A00, Figure 2).

## 2. What this plane owns

| Responsibility | What it means in Heph |
|----------------|------------------------|
| PII protection | Field-level encryption of sensitive borrower data (DOB, PAN, mobile, address) at rest, with decryption gated by role |
| Consent integrity | A per-product consent ledger; every OTP send, receipt, decline, and expiry is recorded immutably with timestamp and actor |
| Data residency | Configurable storage region per tenant; the path to localisation for tenants that require in-country data |
| Trust boundary | Cryptographic and contractual separation between the lender domain, the Heph core, and each insurer |
| Audit & retention | Immutable audit of every state transition and data access, retained per tenant policy |
| Regulatory mapping | Aligning journey steps to insurance-distribution and data-protection obligations |
| Disclosure & data minimisation | Showing only the data a role needs; never surfacing decrypted PII to the RM where the journey does not require it |

## 3. PII and the vault

Sensitive fields are never stored in the clear and never returned to the front end unless the role and
the step genuinely require them. DOB and PAN are the canonical examples: DOB is stored encrypted and is
used to compute age for eligibility without being displayed to the RM; PAN is captured, validated, and
stored encrypted for credit-linked products. The PII vault (a Foundational-Capabilities service, A07)
performs envelope encryption with keys held in the platform KMS; the Compliance Plane owns the policy
for who may decrypt what, and under which role and tenant scope.

> Design rule: PII crosses the BFF boundary only as much as the current journey step requires, and only
> for a role entitled to it. The default is masked; decryption is the exception, logged every time.

## 4. Consent: the legal heart of the journey

Consent is the one action the customer must take, and it is therefore the most heavily controlled part
of the platform. Three properties are non-negotiable:

- **Per-product.** Consent is captured for each product independently, not once for the case. A customer can consent to the lead product and decline an add-on.
- **Parent-first.** The lead (parent) product's consent is the gating condition for the entire case. Without it, nothing issues. With it, each child product is issued only as its own consent arrives.
- **Provable.** Every consent event — sent, received, declined, expired, resent — is written to the consent ledger with a timestamp and the acting identity (customer, RM, or system). The ledger is the evidence a compliance auditor reads.

This is why the Lender Compliance / Audit role has read access to all cases and consent logs in the
tenant, and why consent events are first-class on the event backbone rather than a side effect of the
UI.

## 5. The trust boundary across NBFC × insurer

Heph is centralised across many lenders and many insurers, which is efficient but means the platform is
the single point where two regulated domains meet. The plane treats this as a hard boundary:

- The lender domain reaches Heph only through the BFF, authenticated by the lender's own IdP (A07, ADR-0002). The lender never holds a Heph credential, and the browser never holds a token.
- The insurer domain is reached only through insurer adapters over server-to-server contracts; insurer credentials live in the secrets manager, never in tenant config or the front end.
- Tenant data is isolated (A04); one lender can never see another lender's cases, and an insurer sees only the proposals routed to it.

## 6. How the plane serves the journey

| Journey pillar | Compliance control applied |
|----------------|----------------------------|
| P1 Identity & context | tenant-scoped session; loan data access logged |
| P2 Suitability | eligibility rules applied without exposing DOB |
| P3 Quote & compose | premium written to LOS is audited; no PII in quote payloads beyond need |
| P4 Proposal & UW | PAN/DOB encrypted at rest; secure-link PII handled in the customer's own session |
| P5 Consent | per-product, parent-first, fully audited consent ledger |
| P6 Settlement | receipt and COI write-back audited; idempotent settlement prevents double charge |

## 7. Non-functional requirements

- Encryption in transit (TLS 1.2+) everywhere; mTLS inside the private core.
- Encryption at rest for all stores; field-level envelope encryption for PII.
- Immutable, append-only audit with per-tenant retention windows.
- Configurable data residency at the storage tier, with a localisation path for in-country mandates.
- Least-privilege access: every decryption and cross-tenant read is authorised and logged.

## 8. Risks and open questions

- **Residency vs centralisation.** Full in-country localisation for a tenant may require regional data-plane isolation; the trade-off against single-base reuse is an explicit governance decision (A03, ADR-0001).
- **Insurer PII handling.** Once a proposal leaves Heph for an insurer, the insurer becomes a joint custodian; data-processing terms must be encoded per insurer onboarding (A03).
- **Consent channel integrity.** OTP delivery depends on the SMS provider; provider failure must degrade safely (case waits, never auto-consents).

## 9. Engineering handoff checklist

A team touching this plane must: route all PII through the vault with role-gated decryption; emit
consent and access events to the audit log on the backbone; never place secrets or tokens in tenant
config or the browser; honour per-tenant residency configuration at the storage tier; and treat the
consent ledger as the system of record for issuance eligibility. Binding decisions: ADR-0002 (auth
boundary), ADR-0009 (PII vault & residency).
