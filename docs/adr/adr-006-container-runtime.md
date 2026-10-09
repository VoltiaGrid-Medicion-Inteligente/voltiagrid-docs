---
sidebar_position: 6
---

# ADR-006: ECS Fargate as main runtime, one component on EKS

- **Status:** Accepted
- **Date:** 2026-10-09
- **Owner:** P3

## Context
Every component runs in a container. The program requires at least one component on Kubernetes and a comparison between ECS and EKS for this case.

## Decision
Run the APIs, simulators, consumers and Spark tasks on **ECS Fargate**. Deploy **one component on EKS** (candidate: the control center API) to meet the requirement and compare both runtimes with real numbers.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| Everything on EKS | The EKS control plane has a fixed hourly cost and Kubernetes adds operational work that a 4-person team does not need for every component. |
| EC2 instances with Docker | Servers to patch and scale by hand, and we pay for idle capacity. |

## Consequences
- Low operational effort for most components; pay per task.
- The EKS component gives real evidence for the ECS vs EKS comparison.
- Two deployment paths in CI/CD (ECS and EKS) must be maintained.