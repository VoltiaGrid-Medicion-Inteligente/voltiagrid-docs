---
sidebar_position: 12
---

# ADR-012: Terraform in `voltiagrid-api/infra`, state in S3, two stacks

- **Status:** Accepted
- **Date:** 2026-10-23
- **Owner:** P3

## Context
Sprint 3 creates the AWS infrastructure (network, admin instance, data lake, RDS, ECR, ECS, ALB). It must be code reviewed in pull requests, recreatable with destroy and apply without manual steps (US-21, US-28), and tagged for cost allocation. Several people apply it from their own laptops, so the state must be shared and locked. The data lake must keep data for 3 years, while compute is created only for test windows to save credits.

## Decision

**Tool: Terraform** (HashiCorp AWS provider `~> 5.80`, Terraform `>= 1.10`).

**Location: `infra/` in the `voltiagrid-api` repository.**
- The images, the Dockerfiles and the ECS services live in the same repository.
- One pull request can change the code and the infrastructure that runs it, and the existing CI adds a `terraform` job (format and validate).

**State: S3 bucket with native locking.**
- A small `infra/bootstrap` stack creates the state bucket (versioned, encrypted, public access blocked). It is applied once and never destroyed with the environment.
- The other stacks use the `s3` backend with `use_lockfile = true`: no DynamoDB table is needed.

**Two stacks (roots), sharing modules in `infra/modules/`:**

| Stack | Folder | Contents | Life cycle |
|---|---|---|---|
| data | `infra/envs/data` | Data lake buckets (raw, clean, curated) and their policies | Persistent: holds 3 years of data. Destroyed only at the end of the project (US-56). |
| dev | `infra/envs/dev` | Network, Security Groups, endpoints, admin instance, RDS, secrets, ECR, logs, ECS, ALB | Ephemeral: created for a test window and destroyed after it (US-28). |

**Tags:** the provider's `default_tags` apply `Project`, `Environment`, `Owner` and `ManagedBy` to every resource; modules add `Component`. This follows the tagging policy in *AWS account and access*.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| CloudFormation or AWS CDK | Tied to AWS and slower feedback (stack events instead of a plan). Terraform's `plan` shows the exact change before applying it, which is what reviewers need. |
| A separate `voltiagrid-infra` repository | One more repository, CI and set of permissions; a change in an image and its task definition would need two coordinated pull requests. |
| Local state files | Two people applying at the same time could corrupt the environment, and the state would be lost with a laptop. |
| One single stack | Every destroy and recreate test would delete the data lake and force a reload of 7.5 GB of F1 files. |

## Consequences
- Whoever applies needs the `VoltiaAdmin` permission set (the stacks create IAM roles) and Terraform 1.10 or later.
- `terraform plan` must be attached to every infrastructure pull request.
- The bootstrap state is a local file on the laptop of the person who applied it. If it is lost, the bucket can be imported again.
- This refines ADR-008: infrastructure code lives with the application code it deploys.
