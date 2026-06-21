---
title: Embedded Discovery → Payments Journey
subtitle: The RM-native flow from LAN entry to policy issuance
author: Heph Platform
date: 2026-06-22
---

# Embedded Discovery → Payments Journey

The RM (Relationship Manager) drives the entire journey from the lender's portal;
the customer only provides OTP consent. The journey is a state machine — each step
maps to a state transition in the embedded-insurance engine.

## The 10 steps

1. **LAN Entry** — RM enters the loan account number; a case is initiated.
2. **Loan Hydration** — the loan contract is fetched from the lender LOS.
3. **Insured Selection** — borrower or co-borrower is chosen.
4. **Product Selection** — eligible products surface for the loan.
5. **Quote (Discovery)** — the engine fans out to every insurer offering the
   product through the canonical adapter facade. Quotes return with real native
   pricing — e.g. ICICI Prudential (SOAP EBI), HDFC Life (GST-split premium), and
   TATA AIG (Criticare/Medicare 360 health).
6. **Cart** — selected quotes are added; premium is posted to the LOS.
7. **Proposal / KYC** — nominee, PAN, income and occupation are captured; PAN is
   encrypted; the proposal is submitted to the insurer.
8. **Health Declaration** — underwriting questions / eligibility checks.
9. **Consent (OTP)** — per-product OTP consent; the parent product (Credit Life)
   must be consented for issuance.
10. **Funding & Issuance** — settlement, then policy issuance (COI).

## Payments — two funding modes

- **Mode A — bank-funded (disbursement webhook).** The premium is added to the
  loan disbursement. A signed disbursement webhook confirms funding.
- **Mode B — customer-paid (payment callback).** The customer pays via a gateway;
  a signed payment callback confirms collection.

Both modes are **signature-verified** and **idempotent** — a replayed webhook/
callback returns the original result, and a tampered signature is rejected.

```text
Quote Generated → (cart) → Proposal in Progress → Medical in Progress
  → Awaiting Consent → Awaiting Disbursement | Payment Pending
  → Policy in Issuance → Policy Issued  (COI delivered)
```

## Verified end-to-end

The journey is exercised by an end-to-end live test across all three insurers,
both funding modes, idempotency replays, partial-failure, tampered-signature
rejection, and stuck-case detection — gated through the BFF trust boundary.
