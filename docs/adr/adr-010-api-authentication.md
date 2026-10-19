---
sidebar_position: 10
---

# ADR-010: JWT authentication and role-based access for the APIs

- **Status:** Accepted
- **Date:** 2026-10-15
- **Owner:** P1

## Context
ADR-005 chose JWT for the APIs; this ADR fixes the details. A customer must read only their own consumption (RN-11, CA-10), internal users (billing, control center, operations) read any customer, and every request without a valid token gets 401 (US-13). F4 has no users table and the project has no identity provider, but the demo must run locally and on AWS with the same code.

## Decision
- **Token:** JWT signed with **HS256**. Claims: `sub` (customer code such as `CU-MAC000002`, or `internal`), `role` (`customer` or `internal`), `iss` (`voltiagrid`), `iat` and `exp`. A token without one of them, with another issuer or another role is rejected.
- **Expiry:** 60 minutes by default (`JWT_EXPIRE_MINUTES`). There are no refresh tokens: the client logs in again.
- **Secret:** `JWT_SECRET`, at least 32 random characters, read from the environment. Locally it lives in `.env` (git-ignored); in AWS it is stored in Secrets Manager and injected into the ECS task. It never appears in the repository, the images or the logs.
- **Issuing:** `POST /auth/token` of the customer consumption API. For the demo it checks two shared passwords from the environment (`DEMO_CUSTOMER_PASSWORD` for any `CU-` customer code, `DEMO_INTERNAL_PASSWORD` for `internal`). If a password is not set, that login is disabled.
- **Validation:** all three APIs validate the same token with the same secret (`app/api/common.py`, `get_principal`). 401 for a missing, expired or invalid token; 403 when the role is not allowed.
- **Authorization:** the customer code comes from the token, never from the request. The rule "a customer reads only their own data" lives in the service layer (`ConsumptionService.can_read_consumption`), and it answers 403 before checking whether the requested customer exists, so a customer cannot probe other codes.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| Amazon Cognito user pool | The right choice for real customers, but adds cost, setup and a hosted login that the demo does not need. The validation side stays the same (a signed JWT with claims), so it can replace `POST /auth/token` later. |
| RS256 (key pair) | Lets services validate without holding the signing key. With three internal APIs owned by one team, one shared secret in Secrets Manager is simpler; worth it once an external issuer exists. |
| API keys per client | No expiry, no roles and no customer identity in the credential; isolation would depend on trusting a parameter. |
| Session cookies | Needs server-side session storage and does not fit API clients such as the test collection or the dashboard. |

## Consequences
- Every API needs `JWT_SECRET`; the same value in all of them. Rotating it invalidates every token at once (acceptable: tokens last one hour).
- The demo passwords are shared: anyone who knows `DEMO_CUSTOMER_PASSWORD` can log in as any customer. This is acceptable only for the simulated pilot; production must switch to Cognito or another identity provider (new ADR).
- Tests issue tokens with `issue_token` and a test-only secret; the Bruno collection logs in first and reuses the tokens.
- CA-10 is covered by an automated test in `voltiagrid-api` (`tests/test_ca10_isolation.py`).
