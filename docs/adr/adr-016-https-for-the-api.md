---
sidebar_position: 16
---

# ADR-016: HTTPS for the customer API, so the portal on CloudFront can call it

- **Status:** Proposed
- **Date:** 2026-11-09
- **Owner:** US-69 (Sharon Meriño)

## Context
The portal is served over HTTPS from CloudFront ([ADR-015](./adr-015-customer-portal-static-site.md)). The APIs
are behind the Application Load Balancer, which has a single listener on port 80 (HTTP, T-27.3). A page loaded
over HTTPS cannot call an HTTP address: the browser blocks it as mixed content before CORS is even checked. In the
window of 9 November the portal loaded from CloudFront but could not reach the API; PR #90 already adds the
CloudFront origin to `CORS_ORIGINS`, which is necessary but not enough.

## Decision (proposed)
Serve the API **through the same CloudFront distribution as the portal**: a second origin pointing to the ALB and a
cache behaviour for `/consumption/*` with caching disabled and the `Authorization` header forwarded. The portal is
then built with `VITE_API_URL=/consumption`, the browser sees one HTTPS origin, and CORS is no longer involved for the
portal.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| HTTPS listener on the ALB with an ACM certificate | ACM needs a domain the team controls (DNS validation); the project has none, and the default `*.elb.amazonaws.com` name cannot get a certificate. |
| Leave the portal only local for the demo | Works today, but CA-69.5 asks for the portal deployed; the evaluator would see a site that cannot load data. |
| Call the API over HTTP from an HTTP CloudFront URL | CloudFront would have to allow HTTP for the site, and the JWT would travel unencrypted. |

## Consequences
- No new domain or certificate: CloudFront's default certificate covers the whole path.
- Traffic between CloudFront and the ALB stays HTTP inside AWS; acceptable for dev, to be revisited for prod with a
  domain and an ACM certificate on the ALB.
- The ALB stays reachable directly over HTTP for the other APIs and for Airflow tasks.
- Work: a change in `infra/modules/portal` (second origin and behaviour) and in `deploy-portal.ps1`
  (`VITE_API_URL`), checked in the next AWS window. Until then the demo uses the portal locally.
