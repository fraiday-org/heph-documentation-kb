---
title: "Governance Plane"
subtitle: "Heph — catalogue governance, change management, approvals, and SLAs"
author: "Platform Architecture · Heph"
date: "June 2026"
---

## 1. Purpose and ownership

The Governance Plane is the second cross-cutting plane. Where Compliance asks "is this legal?",
Governance asks "is this authorised, versioned, and safe to release?". It owns the controls that decide
what enters the platform — which insurers, which products, which configuration — and how change moves
from a draft to live for a tenant without breaking the journey for anyone.

It is the plane that makes centralisation safe. Because one code base and one catalogue serve every
lender, an ungoverned change is a multi-tenant incident. Governance turns "centralised" from a risk
into the platform's main advantage.

## 2. What this plane owns

| Responsibility | What it means in Heph |
|----------------|------------------------|
| Catalogue governance | Controlled addition and change of products, insurers, and their mappings |
| Insurer onboarding approval | The approval gate in the onboarding studio before an insurer goes live |
| Change management | Versioned configuration with review, staged rollout, and rollback |
| Schema-contract versioning | Backward-compatible evolution of LOS, insurer, event, and catalogue contracts |
| Release governance | How code and config reach a tenant; environment promotion |
| SLAs & service ownership | Who owns each service, its targets, and its escalation path |

## 3. The insurer onboarding studio as a governed pipeline

New insurers and new products enter the platform through the React Flow node studio (A06, ADR-0006). It
is deliberately a pipeline with a governance gate rather than a config form, because everything that
flows through it becomes live behaviour for real cases.

![Figure 1 — Insurer onboarding as a governed, node-driven pipeline ending in an approval gate and a versioned catalogue publish.](07-insurer-onboarding-reactflow.png){width=100%}

The flow is: define the insurer profile and endpoints → map the quote, proposal, and COI contracts →
bind fields and schemas → encode underwriting and health rules → run the sandbox contract-test harness
→ pass the **approval gate** → publish a **versioned** entry to the catalogue. Nothing reaches a
tenant's RM without passing the gate, and every publish is a new version that can be rolled back.

## 4. Catalogue governance and product extensibility

The product catalogue is schema-driven and centrally governed (A06, ADR-0007). Adding a product is a
governed catalogue action, not a code change. The plane defines:

- who may propose, review, and approve a catalogue change (separation of duties);
- which fields are tenant-overridable (recommendation tag, context blurb, coverage range) and which are platform-fixed (product type semantics, contract bindings);
- how a change is staged: draft → review → publish to a pilot tenant → general availability;
- how versions coexist so an in-flight case keeps the catalogue version it started with.

## 5. Change management and schema contracts

Because the backend is schema-contract-driven (ADR-0003), governance of contract evolution is what
keeps producers and consumers decoupled safely. The rules:

- contracts are versioned; breaking changes require a new version, never a mutation of an existing one;
- producers may add optional fields; consumers must tolerate unknown fields;
- a contract is retired only after telemetry shows no consumer is on the old version;
- LOS and insurer integration changes are owned with the relevant tenant or insurer and staged through the same gate.

## 6. How the plane serves the journey

Governance is mostly invisible to a running case, which is the point — but it is the reason each step
behaves predictably. The catalogue the RM sees in P2, the insurer set quoted in P3, the proposal and
underwriting contracts in P4, and the issuance behaviour in P6 are all governed artefacts at known
versions. When a case is stuck (>48h) the Heph Operations role, operating under this plane's runbooks,
intervenes.

## 7. Non-functional requirements

- Every config and catalogue change is attributable, reviewable, and reversible.
- Staged rollout with per-tenant targeting; no global "big bang" changes.
- Documented SLAs and ownership per service; escalation paths for stuck and failed cases.
- Audit of approvals, kept in step with the Compliance Plane's retention policy.

## 8. Risks and open questions

- **Velocity vs control.** Heavy gates slow insurer onboarding; the studio mitigates this by making the safe path the fast path, but gate criteria need tuning per insurer maturity.
- **Version sprawl.** Many coexisting catalogue and contract versions raise operational load; a deprecation policy with telemetry-driven retirement is required.
- **Config drift.** Per-tenant overrides can diverge from platform defaults; periodic reconciliation reporting is needed.

## 9. Engineering handoff checklist

A team touching this plane must: treat catalogue and config as versioned, reviewable artefacts; route
all insurer and product changes through the onboarding studio and its approval gate; evolve contracts
additively and retire them on telemetry; and pin in-flight cases to the catalogue version they began
with. Binding decisions: ADR-0006 (onboarding studio), ADR-0007 (catalogue), ADR-0003 (contracts).
