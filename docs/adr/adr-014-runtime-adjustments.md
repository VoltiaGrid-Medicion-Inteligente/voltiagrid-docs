---
sidebar_position: 14
---

# ADR-014: RabbitMQ and Airflow on one EC2 instance, on-demand Spark, F5 on EKS

- **Status:** Accepted
- **Date:** 2026-10-23
- **Owner:** P3

## Context
The architecture presentation (October 2026) reviewed the runtime of every component against the cost model and the
110 USD of credits left. It settled three points that earlier ADRs left open or decided differently:

- [ADR-004](./adr-004-orchestration.md) chose Airflow with CeleryExecutor but not where it runs, and the first cost
  estimate put Airflow and RabbitMQ on four Fargate tasks.
- [ADR-002](./adr-002-batch-processing.md) chose Spark on Fargate; the first estimate ran every Spark job on Fargate Spot.
- [ADR-006](./adr-006-container-runtime.md) named the control center API as the candidate for EKS.

## Decision

**1. RabbitMQ and Airflow share one EC2 instance.**
- One `t3.large` (2 vCPU, 8 GB, x86) with a 30 GB gp3 volume, running Docker Compose: RabbitMQ, the Airflow
  scheduler, the webserver and one Celery worker. Airflow's metadata database stays in RDS.
- RabbitMQ keeps its queues on the EBS volume, so durable queues and persistent messages survive a restart.
- The Celery worker only launches work: Spark jobs as Fargate tasks and the pull jobs. Heavy processing never runs on the instance.
- Network ([ADR-011](./adr-011-region-and-network.md)): public subnet with a public IP and no NAT. Its Security Group accepts AMQP (5672) only from the
  application Security Group; the Airflow UI and the RabbitMQ console are reached through Session Manager port forwarding.

**2. Spark runs on Fargate on-demand; Spot only for the historical load.**
- The 30-minute batches and the daily close use on-demand capacity: the close must finish in 45 minutes (US-55) and a Spot interruption could break that.
- The one-off historical load of F1 (US-41) uses Fargate Spot: if it is interrupted, Airflow retries it from scratch.

**3. The EKS component is the F5 transformer metering simulator.**
- It runs on EKS in weeks 5 and 6 for the ECS vs EKS comparison (US-50) and on ECS the rest of the time.
- The EKS cluster is created only during test windows and destroyed at the end of each one, like the dev stack.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| RabbitMQ and Airflow as Fargate tasks (first estimate) | 19.93 USD a month more (four tasks and four public IPs instead of one instance), and a Fargate task has no disk that survives a restart: RabbitMQ would lose its durable queues unless EFS is added. |
| Amazon MQ and Amazon MWAA | 570 USD a month for these two services alone (*Costs → Alternatives compared*, option B). |
| Spark on Fargate Spot for every job | 13.47 USD a month less, but an interruption can push the daily close over 45 minutes. |
| Control center API on EKS | It serves operators with JWT, so the comparison would put user-facing traffic on a temporary cluster. F5 is a simulator with no users and is already a container on ECS. |

## Consequences
- The prod estimate is **219.07 USD a month** (*Costs → Monthly estimate*). The dev windows of sprint 3 do not change, because the instance is created when ingestion and orchestration are deployed.
- The instance is a single point for the broker and the orchestrator. If it stops, ingestion pauses but no reading is lost: with publisher confirms ([ADR-001](./adr-001-ingestion-broker.md)) the simulator knows which batches were not stored and sends them again, as concentrators do after an outage. The APIs keep answering from RDS. A CloudWatch alarm on the instance status check and on queue depth is required.
- The team patches the instance (`sudo dnf upgrade` once a month, in a test window).
- At 200,000 meters RabbitMQ moves to a dedicated three-node cluster (US-58).
- ADR-002, ADR-004 and ADR-006 stay accepted and are marked as amended by this ADR.
