---
sidebar_position: 8
---

# ADR-008: One repository per area plus a Docusaurus docs site

- **Status:** Accepted
- **Date:** 2026-10-09
- **Owner:** P4

## Context
Four people work in parallel on APIs, data jobs, analytics and documentation. CI/CD should not build and deploy everything on every change, and the documentation must be readable outside the code.

## Decision
Use a GitHub organization with **one repository per area** (`voltiagrid-api`, `voltiagrid-data`, `voltiagrid-analytics`) and a separate **`voltiagrid-docs`** repository published with **Docusaurus** on GitHub Pages. All repositories use `develop` as the integration branch and `main` for releases, both protected by rulesets.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| Monorepo | Simpler to clone, but every change would trigger every pipeline unless path filters are maintained, and permissions cannot be split by area. |
| Documentation as Markdown inside each code repo | No single place to read the architecture, ADRs and costs; harder for the PM and reviewers to navigate. |

## Consequences
- Each repository has its own CI and only deploys what changed.
- Cross-repository changes need coordinated PRs.
- The docs site is rebuilt and published automatically on every merge to `develop`.