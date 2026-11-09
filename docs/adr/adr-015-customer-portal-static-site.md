---
sidebar_position: 15
---

# ADR-015: The customer portal as a static site on S3 + CloudFront

- **Status:** Accepted
- **Date:** 2026-11-09
- **Owner:** US-69 (Sharon Meriño)

## Context
US-69 adds a web portal where a customer sees their contract, their connection to the network and their consumption.
The portal is a React + TypeScript + Vite single-page application (`voltiagrid-portal`) that only calls the customer
consumption API (`/me/...`, [ADR-010](./adr-010-api-authentication.md)). It has no server-side logic and must be
destroyed with the dev stack after each window ([ADR-012](./adr-012-terraform.md)).

## Decision
The portal is built once (`npm run build`) and served as static files from a **private S3 bucket behind CloudFront**:

- Terraform module `infra/modules/portal` in `voltiagrid-api` (KAN-354, PR #88): bucket with public access blocked and
  encryption, CloudFront with **origin access control** (only CloudFront reads the bucket), HTTPS with the default
  CloudFront certificate, and a fallback to `index.html` so the routes of the single-page app work on reload.
- `infra/scripts/deploy-portal.ps1` builds the portal with `VITE_API_URL` set to the API, uploads `dist/` and
  invalidates the CloudFront cache.
- The bucket has `force_destroy = true`, so `destroy.ps1` removes it with the rest of the dev stack (CA-69.5, checked
  in the window of 9 November: bucket and distribution destroyed, nothing left).

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| Serve the portal from a container (nginx on ECS Fargate) | A task running 24/7 for files that never change; it costs per hour and adds an image to build and patch. |
| S3 static website hosting, public bucket | Only HTTP, and the bucket would be public. CloudFront gives HTTPS and keeps the bucket private. |
| AWS Amplify Hosting | Another service and its own build pipeline outside Terraform and our GitHub Actions; less control over destroy. |

## Consequences
- Almost free in dev: storage of a few hundred kB and CloudFront requests; nothing billed per hour.
- The portal is served over HTTPS, but the API behind the ALB answers over HTTP. Browsers block those calls from an
  HTTPS page (mixed content), so **the portal on CloudFront cannot call the API yet**; locally (`npm run dev`) it
  works through the Vite proxy. The API also needs the CloudFront origin in `CORS_ORIGINS` (PR #90). The HTTPS
  decision for the API is [ADR-016](./adr-016-https-for-the-api.md).
- `deploy-portal.ps1` reads the bucket and the distribution from the Terraform outputs, so it only works after a dev
  apply that includes the portal module.
