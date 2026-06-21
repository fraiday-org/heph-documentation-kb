---
title: "Payment Establishment & Receipt Journey"
subtitle: "Heph — Mode A and Mode B settlement, idempotency, receipts, and issuance coupling"
author: "Platform Engineering · Heph"
date: "June 2026"
---

## 1. Purpose

This document specifies the payment establishment and receipt journey — how the premium is settled and
how settlement is coupled to certificate issuance. It is the runtime detail behind ADR-0005. Premiums
are single-premium, paid once at loan disbursement, and collected two ways, and the whole flow must be
correct under retries and partial failure.

![Figure 1 — Mode A (bank-funded via the LOS charge code) and Mode B (customer-paid via the payment gateway), each ending in idempotent issuance and receipt.](06-payment-establishment-receipt.png){width=100%}

## 2. Two modes, one principle

Whatever the mode, the principle is the same: **establish** the obligation, **receive** confirmed
settlement, then **issue** — idempotently, and parent-first. The payment mode is per tenant; if both are
enabled, the RM picks the mode per case at the cart (A01, Step 6).

| | Mode A — bank-funded | Mode B — customer-paid |
|---|----------------------|------------------------|
| Who pays | lender settles with the insurer on the customer's behalf | customer pays the insurer directly |
| Mechanism | premium folded into the disbursement via an LOS charge code | payment gateway (UPI / card / net banking) |
| Establishment | cart total posted to the LOS | payment intent created at the gateway |
| Receipt trigger | LOS disbursement webhook (transaction id) | signature-verified gateway callback |
| Timing | premium settled at disbursement | before or after disbursement (tenant flag) |

## 3. Mode A — bank-funded establishment & receipt

1. **Establish.** When the RM proceeds from the cart, cart-svc posts the **total premium once** to the lender's LOS with an **idempotency key**; the LOS adds it to the disbursement charge code or reduces the disbursed amount. Case → *Awaiting Disbursement*.
2. **Receive.** On loan disbursement, the LOS sends a **disbursement webhook** carrying a transaction id. payment-svc verifies and records it as the receipt.
3. **Issue.** Receipt triggers fulfilment-svc to issue policies parent-first (Section 5). Case → *Policy in Issuance* → *Policy Issued*.

## 4. Mode B — customer-paid establishment & receipt

1. **Establish.** payment-svc creates a **payment intent / order** at the gateway with an **idempotency key**; a pay link (TTL, resend cap) is sent to the customer's LAN-registered mobile. Case → *Payment Pending*.
2. **Pay.** The customer pays via UPI, card, or net banking on the gateway's page — the customer's only money-movement action.
3. **Receive.** The gateway sends a callback; payment-svc **verifies the signature**, confirms the order, and persists the receipt. Late or duplicate callbacks are idempotent no-ops.
4. **Issue.** Confirmed receipt triggers issuance, parent-first. Case → *Policy in Issuance* → *Policy Issued*.

## 5. Issuance coupling and the parent-first rule

Issuance is coupled to confirmed settlement and obeys the **parent-first partial-issuance rule**
(ADR-0005, A02):

- the **parent** product's consent is the gating condition for the whole case — without it, nothing issues and the cart fails;
- with parent consent and settlement, each **child** product is issued independently as its own consent allows;
- a COI is requested **exactly once per insurer** (idempotency key) and, on receipt, written back to the LOS;
- a declined or expired child never blocks the consented, settled parent.

## 6. Idempotency and exactly-once effects

Every money-moving and issuance effect is idempotent:

| Effect | Idempotency basis |
|--------|-------------------|
| Premium post to LOS (Mode A) | idempotency key per case |
| Payment intent (Mode B) | idempotency key per case |
| Gateway callback handling | order id + signature; duplicates are no-ops |
| Disbursement webhook handling | transaction id; duplicates are no-ops |
| COI request per insurer | idempotency key per (case, insurer) |
| COI write-back to LOS | idempotent upsert |

The result is that retries — from networks, webhooks, or replays — never double-charge, double-issue, or
duplicate a certificate.

## 7. Reconciliation and receipts

Every receipt (LOS transaction id or gateway order) is persisted and auditable (A02). A reconciliation
job matches receipts to issued COIs and to the premium posted, surfacing any mismatch for Operations.
Because settlement and issuance both emit events (A01 §5, P03), the gold-layer funnel reconciles
payments and policies to the case ledger.

## 8. Failure handling

- **LOS unavailable (Mode A establish)** — case stays recoverable; retry the idempotent post; on repeated failure → *Failed* (retryable), never a silent double-post.
- **Gateway failure (Mode B)** — no receipt, no issuance; the pay link is resendable within the cap; the case waits, never auto-issues.
- **Webhook/callback lost** — reconciliation and replay recover it; idempotency makes recovery safe.
- **Partial insurer issuance failure** — the failed insurer's COI retries independently; other policies stand.

## 9. Engineering checklist

Establish with an idempotency key; receive only on a verified webhook/callback; persist every receipt;
issue only on confirmed settlement and parent-first; request each COI exactly once per insurer and write
it back to the LOS; reconcile receipts to issuance; and keep every effect idempotent so retries are
no-ops. Binding decision: ADR-0005.
