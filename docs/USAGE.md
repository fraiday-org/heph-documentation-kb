# Usage

## Local

1. Copy `.env.example` to `.env`.
2. Install dependencies if this repository has a package manager file.
3. Run tests and build checks.

## Contracts

All request and event payloads should align with the shared event envelope:

```json
{
  "eventId": "evt_...",
  "schemaVersion": "1.0.0",
  "type": "case.initiated",
  "occurredAt": "2026-06-21T00:00:00.000Z",
  "tenantId": "poonawalla",
  "caseId": "case_...",
  "correlationId": "corr_...",
  "actor": { "type": "rm", "id": "rm-poona-001" },
  "payload": {}
}
```
