---
sidebar_position: 2
---

# ADR-002: Spark on ECS Fargate for batch processing

- **Status:** Proposed
- **Date:** 2026-10-09
- **Owner:** P2

## Context
F1 alone has about 167 million readings, and the daily close (validation, estimation, tariff bands, losses) must finish in **under 45 minutes**. The program requires Spark and reporting time and cost per run.

## Decision
Run **PySpark jobs as ECS Fargate tasks** (one task per run, image in ECR), triggered by Airflow. Each run logs its duration and estimated cost.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| Amazon EMR | Strong for very large clusters, but cluster startup and minimum cost are high for a daily job of this size, and it adds a platform the team has not used. |
| AWS Glue | Serverless Spark, but it hides the runtime (harder to run the same job locally) and per-DPU pricing makes cost per run harder to compare with the other options. |

## Consequences
- The same container image runs locally and in AWS.
- We pay only while the task runs.
- A single Fargate task has CPU and memory limits; if the projected volume does not fit, the job is split by partition or this ADR is revisited in favor of EMR.