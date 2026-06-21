---
title: How do I enable a product?
subtitle: Add a product to an insurer and publish it to a tenant catalogue
author: Heph Platform
date: 2026-06-22
---

# How do I enable a product?

Products are **config-driven** and versioned. The platform ships four product
archetypes mapped onto the three reference insurers:

| Product | Category | Offered by |
|---------|----------|------------|
| `credit-life` | Life (parent, mandatory) | ICICI Prudential, HDFC Life |
| `emi-protect` | Income protection | ICICI Prudential, HDFC Life |
| `paci` | Health (accident + critical illness) | TATA AIG (Criticare 360) |
| `wellness-health` | Wellness | TATA AIG (Medicare 360) |

## Steps

1. **Author the catalogue entry.** In the Governance console open **Catalogue**
   and create a product version. Each entry carries eligibility (age, loan types,
   sum-insured slabs, cover periods) and premium config. Entries start in `draft`.

2. **Map the product to insurers.** A product is offered by any insurer whose
   sandbox/UAT adapter supports it. The adapter facade enforces this: a quote for
   an unsupported `(insurer, product)` pair returns `product_not_supported`, and a
   seeded outage returns `timeout` — so discovery and partial-failure are faithful.

3. **Pass the approval gate.** Submit the version for approval. Once approved it
   can be published.

   ```bash
   curl -X POST localhost:3002/api/v1/catalogue/publish -H 'content-type: application/json' \
     -d '{ "tenantId": "poonawalla", "productId": "credit-life", "version": 2, "approvedBy": "compliance" }'
   ```

4. **Scope to a tenant.** In **Tenant Config**, add the product to the tenant's
   `catalogueSubset`. Only products in the subset surface in that tenant's RM
   discovery journey.

## What the RM sees

After enablement, the product appears on the **Product Selection** screen for
eligible loans, and the **Quote** screen fans out to every insurer that offers it —
so the RM can compare, for example, ICICI Prudential and HDFC Life Credit Life
side by side.
