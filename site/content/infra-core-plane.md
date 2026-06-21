---
title: "Infra-Core Plane"
subtitle: "Heph — AWS, infrastructure-as-code, networking, compute, CI/CD, observability"
author: "Platform Architecture · Heph"
date: "June 2026"
---

## 1. Purpose and ownership

The Infra-Core Plane is the ground the whole platform stands on: the AWS account topology, the network,
the compute and data substrates, the delivery pipeline, and the observability backbone. It owns the
non-functional foundation — availability, scalability, security posture, and operability — and it is the
plane that turns "centralised across NBFC × insurers" into a concrete, reproducible deployment.

![Figure 1 — Infra-core topology: multi-AZ VPC, the BFF/DMZ and private core tiers, managed data and queue services, and the observability backbone.](09-infra-core-topology.png){width=100%}

## 2. Centralisation and infrastructure-as-code

The platform runs on a centralised AWS footprint shared across all lenders and insurers, defined
entirely as infrastructure-as-code. The IaC choice is deliberately tool-agnostic: the architecture
commits to "everything reproducible from code" rather than to a single vendor, so the same definitions
can target the curated, compliance-assured boundary today and a regionally-localised footprint later
(A02, A03). Nothing in production exists that is not in the IaC repository.

> Principle: every environment — development, staging, production — is the same code with different
> parameters. A new region or a new compliance boundary is a parameterisation, not a rebuild.

## 3. Network and trust tiers

The network mirrors the trust boundary (A07, P02). A multi-AZ VPC is divided into tiers:

| Tier | Contents | Exposure |
|------|----------|----------|
| Public edge | CDN, WAF, load balancer | internet-facing, TLS terminating |
| BFF / DMZ | BFF middleware, session store | reachable only from the edge |
| Private core | API gateway, capability services, event backbone | mTLS only, no internet route |
| Data & secrets | transactional DB, PII vault, secrets, data lake | reachable only from the core |

Each tier is a subnet boundary with security groups that allow only the next hop. The browser reaches
only the edge; the edge reaches only the BFF; the BFF reaches only the gateway; services reach data
stores only through the data tier.

## 4. Compute, data, and messaging substrates

| Concern | Substrate (reference) |
|---------|------------------------|
| Compute | Containerised services on a managed orchestrator, horizontally autoscaled, stateless |
| Transactional store | Managed relational DB, multi-AZ, with row-level tenant scoping |
| Event backbone | Managed streaming / queue with a schema registry, at-least-once delivery |
| Object storage | Managed object store for COIs, payloads, and the data-lake landing zone |
| Secrets & keys | Managed secrets manager and KMS for envelope encryption |
| Cache / session | Managed in-memory store for BFF sessions and hot config |

These are stated as reference substrates rather than exact products so the IaC can bind them to the
specific managed services the chosen cloud boundary provides, without changing the architecture.

## 5. CI/CD and environment promotion

Delivery is pipeline-driven and governed (A03). Code and configuration move through development →
staging → production by promotion, never by hand. Releases are staged and per-tenant targetable so a
change can pilot with one lender before general availability, and every release is reversible. The same
pipeline runs the contract-test harness that the insurer onboarding studio depends on, so an insurer
integration is verified against its contracts before it can be promoted.

## 6. Observability backbone

Centralised observability is a first-class platform capability, not an afterthought. Three signals are
threaded end to end with a single correlation id:

- **Tracing** from the BFF through the gateway, services, and event consumers, so any case can be followed across the distributed backend.
- **Metrics** per service and per tenant — latency, error rate, saturation, and business KPIs like funnel conversion and stuck-case counts.
- **Logging** structured and tenant-tagged, feeding the same audit and retention policy the Compliance Plane defines (A02).

This backbone is what lets Heph Operations keep the platform healthy across many lenders and resolve
stuck or failed cases within SLA (A03).

## 7. Availability, scale, and disaster recovery

- Multi-AZ by default for the compute, data, and messaging tiers.
- Stateless services autoscale horizontally; the transactional store scales with read replicas and the data plane absorbs analytical load (A05).
- Defined RPO/RTO targets with automated backups and tested restore.
- Per-tenant rate limits and quotas at the edge and gateway to contain noisy neighbours.

## 8. How the plane serves the journey

The journey never names this plane, yet every step runs on it. P1's SSO and BFF, P3's parallel insurer
calls, P5's OTP delivery, and P6's idempotent settlement all depend on the network tiers, compute
elasticity, and observability this plane provides. When a case sticks, it is this plane's telemetry that
surfaces it and this plane's runbooks that resolve it.

## 9. Risks and open questions

- **Localisation vs single footprint.** In-country residency for a tenant may require a regional deployment of this plane, partially breaking centralisation (A02, A03); the IaC-agnostic stance is the hedge.
- **Cost of multi-AZ everywhere.** High availability has a price; tiering by criticality keeps it proportionate.
- **Cloud-service binding.** Reference substrates must be bound to concrete managed services per boundary without leaking that choice into application code.

## 10. Engineering handoff checklist

A team touching this plane must: define everything in IaC with no manual production state; keep the
network tiers and security-group hops minimal and explicit; bind reference substrates to managed
services without coupling app code to them; thread the correlation id for observability; and keep
services stateless so autoscaling holds. Binding decisions: ADR-0001 (centralisation/isolation),
ADR-0008 (observability).
