# Architecture

Central GitHub Pages documentation gateway for RM Native Digital enablement.

The repository participates in the Heph RM-led embedded-insurance platform. It is tenant-scoped, contract-driven, idempotent, observable, and built for an emulated V1 that can run without live lender, insurer, payment, OTP, or AWS dependencies.

## Trust Boundary

Browsers receive screen-shaped payloads only. Tokens and external credentials remain server-side. Services emit domain events with correlation IDs and idempotency keys.
