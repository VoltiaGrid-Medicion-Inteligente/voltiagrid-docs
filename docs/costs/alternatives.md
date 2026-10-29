---
title: Alternatives compared
sidebar_position: 3
---

# Architecture alternatives and why ours is the cost-optimal one (US-24, T-24.3)

Same workload as the estimate (pilot, 24/7, `us-east-1`, on-demand prices of October 2026). Only the
architecture changes. Unit prices: *Monthly estimate*.

## The alternatives

| | A. Proposal (ours) | B. Fully managed, "textbook" | C. One EC2 server |
|---|---|---|---|
| APIs and simulators | Fargate, public subnets, inbound only from the ALB | Fargate in private subnets | Docker Compose on one `t3.large` |
| Broker | RabbitMQ on one EC2 `t3.large`, shared with Airflow, queues on EBS | Amazon MQ for RabbitMQ (`mq.m5.large`, single instance) | RabbitMQ container |
| Orchestration | Airflow on the same EC2 instance (CeleryExecutor) | Amazon MWAA (small environment) | Airflow container |
| Spark | Fargate on-demand (Spot only for the one-off historical load) | Fargate on-demand | Spark on the same server |
| Database | RDS `db.t4g.small` Single-AZ | RDS `db.t4g.small` **Multi-AZ** | RDS `db.t4g.small` Single-AZ (kept, US-25) |
| Network egress | Public IPs, no NAT | **2 NAT Gateways** (one per AZ) | One public IP |
| Load balancer | 1 ALB | 1 ALB | none (ports on the server) |

## Monthly cost (USD)

| Item | A. Proposal | B. Managed | C. One EC2 |
|---|---|---|---|
| Compute: APIs, simulators, consumer | 54.10 | 54.09 | — |
| Broker | 63.14 (EC2 + 30 GB, shared with Airflow) | 212.24 | — |
| Orchestration | included in the broker line | 357.70 | — |
| Spark | 19.24 | 19.24 | — |
| EC2 server + 50 GB disk | — | — | 64.74 |
| RDS | 25.66 | 51.32 | 25.66 |
| ALB | 19.34 | 19.34 | — |
| NAT Gateways (2 × 730 h + 20 GB) | — | 66.60 | — |
| Public IPv4 | 32.85 | 7.30 | 3.65 |
| S3, CloudWatch, Secrets Manager, ECR | 4.74 | 4.74 | 2.44 |
| **Total** | **219.07** | **792.57** | **96.49** |

How the numbers were computed:
- **A.** EC2 `t3.large` 0.0832 USD/h + 30 GB gp3; Spark 30-minute batches and daily close on Fargate on-demand.
- **B.** Amazon MQ `mq.m5.large` 0.288 USD/h + 20 GB; MWAA small about 0.49 USD/h; RDS Multi-AZ doubles the instance and the storage price.
- **C.** EC2 `t3.large` 0.0832 USD/h. The RDS line is kept so that the comparison isolates compute.

## Why A

1. **B costs 3.6 times more for the same workload.** Of its 792 USD, 570 USD (72%) pay for two managed services (Amazon MQ and MWAA) whose self-hosted versions cost 63 USD in A, on one EC2 instance. The rest of the gap is NAT Gateways and Multi-AZ. B gives high availability that a 5,500-meter pilot does not need, and our credits (about 110 USD) would not even cover a week of it.
2. **C is the cheapest (96 USD), but it fails requirements.** It puts everything on one server: APIs, ingestion consumers, Spark, broker and Airflow. If it stops, the APIs stop too and readings pile up with nowhere to go, against US-29. It cannot scale Spark for the 167 million historical readings (US-41) or for 200,000 meters (US-58) without a redesign. It does not meet ADR-006 (containers on ECS and one component on EKS). A also has one EC2 instance, but only for the broker and the orchestrator: the APIs keep answering from RDS if it stops, the queues survive a restart on the EBS volume, and Spark runs on Fargate with as much CPU as a job needs. The 123 USD difference buys that isolation and the scaling the business needs.
3. **A keeps managed services where they are cheap** (RDS, ALB, S3, Secrets Manager) and self-hosts where the managed service has a high fixed price (broker, Airflow). Broker and Airflow share an EC2 instance instead of Fargate tasks: it is cheaper, and RabbitMQ needs a disk that survives restarts, which a Fargate task does not have without adding EFS. Spark stays on Fargate on-demand for the scheduled jobs because the daily close must finish in 45 minutes (US-55) and a Spot interruption could break that; Spot is used only for the one-off historical load, which can simply be retried.

## Variants checked inside A

| Variant | Cost change | Decision |
|---|---|---|
| Airflow and RabbitMQ as Fargate tasks (4 tasks) instead of one EC2 instance | 72.12 + 4 public IPs 14.60 = 86.72 instead of 66.79 (+19.93) | Rejected (ADR-014). More expensive, and RabbitMQ would lose its durable queues whenever its task restarts. |
| Spark on Fargate Spot for the scheduled jobs | 5.77 instead of 19.24 (−13.47) | Rejected (ADR-014). A Spot interruption can push the daily close over 45 minutes. Spot only for the historical load. |
| NAT Gateway in 1 AZ + private tasks instead of public IPs | 32.85 + about 0.90 data + 7.30 ALB IPs = 41.05 instead of 32.85 (+8.20) | Kept public IPs. In dev windows 6 public IPs (0.03 USD/h) are also cheaper than a NAT (0.045 USD/h). To revisit for 200,000 meters (US-58). |
| RDS `db.t4g.micro` in prod | −11.68 | Rejected. 1 GB of RAM is not enough for 3 APIs, the consumer and Airflow's metadata at the same time. |
| ARM (Graviton): Fargate ARM and `t4g.large` | About −20% on Fargate (−15 USD) and −11.68 on the instance | Later. The images are built on x86 laptops; this needs multi-architecture builds in CI (US-46). |
| EKS for the US-50 component (F5 simulator, weeks 5 and 6) | +33.60 if the control plane stays on for two weeks (0.10 USD/h × 336 h) + about 4.15 for the pod | The cluster is created only during test windows (about 0.11 USD per window hour) and destroyed after each one (ADR-006, ADR-014). |
| Scale everything to zero outside office hours (12 h/day) | About −45% on Fargate | Not for prod (readings arrive 24/7). This is how dev works: windows only. |
