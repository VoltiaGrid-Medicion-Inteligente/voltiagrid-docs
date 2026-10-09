---
sidebar_position: 5
---

# ADR-005: FastAPI with JWT for the APIs

- **Status:** Accepted
- **Date:** 2026-10-09
- **Owner:** P1

## Context
Two APIs are needed: daily consumption for the authenticated customer (p95 of 500 ms or less, never another customer's data, RN-11) and transformer load for the control center. The program requires an OpenAPI contract (E-05).

## Decision
Build the APIs with **FastAPI**, Pydantic schemas and **JWT** authentication with roles. The customer id comes from the token, not from the request, and isolation is enforced in the service layer.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| Flask | Lighter, but without built-in validation or automatic OpenAPI generation, which we would have to add and maintain. |
| Django REST Framework | Complete, but heavier than two read APIs need and brings its own ORM, while the project already uses SQLAlchemy. |

## Consequences
- OpenAPI is generated from the code and exported in CI.
- Typed request and response models catch errors early.
- JWT signing keys come from environment variables, never from the repository.