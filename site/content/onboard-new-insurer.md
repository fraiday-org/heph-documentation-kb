---
title: How do I onboard a new insurer?
subtitle: From profile registration to an approved, contract-tested integration
author: Heph Platform
date: 2026-06-22
---

# How do I onboard a new insurer?

Onboarding an insurer on Heph is a **UI-driven, contract-tested** workflow in the
Governance console. The platform ships with three reference insurers already
onboarded against faithful sandbox simulators of their real UAT contracts:

| Insurer | Auth | Products | Native flow |
|---------|------|----------|-------------|
| ICICI Prudential (`icici-pru`) | APIGEE Bearer JWT | Credit Life, EMI Protect (GP1) | SOAP Quote → Eligibility → Proposal → Payment → Status |
| HDFC Life (`hdfc-life`) | REST Bearer JWT | Credit Life, EMI Protect (GCP2) | Search → Premium → Onboard → Search(poll) |
| TATA AIG (`tata-aig`) | AWS Cognito client_credentials | PACI, Wellness (Criticare/Medicare 360) | Token → Quote360 → Proposal360 (OTP) → Payment → COI |

## Steps

1. **Register the insurer profile.** In the Governance console open **Insurer
   Onboarding Studio** and add the insurer. Each profile declares stage endpoints
   (`quote`, `proposal`, `underwriting`, `coi`) and a JSON schema per stage. The
   endpoints point at the canonical adapter facade
   (`/adapters/:insurerId/:stage`) served by the insurer-integrations service.

   ```bash
   curl -X POST localhost:3002/api/v1/insurers -H 'content-type: application/json' -d '{
     "insurerId": "new-insurer",
     "displayName": "New Insurer Ltd",
     "enabled": true,
     "endpoints": { "quote": {"url": "http://localhost:3001/adapters/new-insurer/quote", "method": "POST"} , ... },
     "schemas": { "quote": {"schemaId": "new-insurer-quote-v1", "schemaVersion": "1.0.0", "payloadShape": {}} , ... }
   }'
   ```

2. **Build the onboarding graph.** The studio renders a dependency DAG —
   `insurer → quote → proposal → underwriting → coi`.

3. **Run live contract tests.** Click **Run live tests**. The studio issues a
   *real* HTTP request to each stage endpoint and validates the canonical response.
   This exercises the actual wire path (in sandbox mode against the simulator;
   in `uat` mode against the insurer's real host).

   ```bash
   curl -X POST localhost:3002/api/v1/insurers/new-insurer/live-contract-tests
   # -> { "approved": true, "results": [ {stage:"quote", passed:true}, ... ] }
   ```

4. **Evidence + approval.** Each stage result is persisted as contract-test
   evidence. When all stages pass, the insurer is auto-approved and becomes
   eligible for tenant catalogues.

## Switching to real UAT

Set `INTEG_MODE=uat` on the insurer-integrations service and supply the insurer's
UAT base URL and credentials (`*_UAT_BASE_URL`, `*_JWT`, `TATA_CLIENT_ID/SECRET`).
The facade and contract tests are unchanged — only the transport target moves.
