---
sidebar_position: 9
---

# ADR-009: IAM Identity Center for team access to AWS

- **Status:** Accepted
- **Date:** 2026-10-09
- **Owner:** P3

## Context
Four people need access to one AWS account from the console and the CLI. The project requires individual identities with MFA, nobody using the root user, least privilege and no credentials in repositories (CT-02).

## Decision
Use **AWS IAM Identity Center** with one user per member, MFA required at every sign-in, three groups mapped to permission sets (`VoltiaAdmin`, `VoltiaDeveloper`, `VoltiaAnalyst`) and AWS CLI v2 profiles configured with `aws configure sso`.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| IAM users with long-lived access keys | Keys live on laptops and can leak into a repository or a screenshot; MFA has to be enforced with a custom policy, and keys must be rotated by hand. |
| One shared user (or the root user) for the whole team | No individual traceability in CloudTrail, MFA cannot be personal and it violates the requirement that nobody uses root. |

## Consequences
- Temporary credentials only; nothing to rotate on laptops.
- AWS Organizations must be enabled on the account (no cost).
- CI/CD needs its own IAM role through GitHub OIDC, separate from human access.