---
title: Services and usage assumptions
sidebar_position: 1
---

# Services and usage assumptions (US-24, T-24.1)

Every line of the estimate (*Monthly estimate*) comes from one assumption on this page. Each assumption says
where it can be checked: a Terraform file, an ADR, a user story or a measurement.

## General assumptions

| # | Assumption | Value | How to verify |
|---|---|---|---|
| G1 | Region | `us-east-1` | ADR-011 |
| G2 | Hours in a month | 730 | AWS Pricing Calculator convention |
| G3 | Prices | On-demand list prices in USD, October 2026, no Free Tier, no Savings Plans, before credits | AWS Pricing Calculator |
| G4 | CPU architecture | Linux x86_64 for containers and the EC2 instance (images are built on the team's Windows laptops) | `runtime_platform` in the task definitions (T-27.2) |
| G5 | Pilot size | 5,500 meters, 264,000 readings per day | *Logical architecture* → Sizing |
| G6 | Historical data | F1 and F2: 7.5 GB of CSV | `docs/data/profile.md` in `voltiagrid-data` |
| G7 | API traffic | Under 100,000 requests per month (pilot users and evaluators) | — (pilot) |
| G8 | Runtime decisions | RabbitMQ and Airflow on one EC2 instance; Spark on-demand, Spot only for the historical load; one component (F5) on EKS | Architecture presentation (October 2026), recorded in ADR-014 |

## Environments

| Environment | What it is | When it exists |
|---|---|---|
| **dev** | The `infra/envs/dev` stack plus the persistent data lake. Used for test windows: US-21 review, data load, deployment, destroy and recreate test. | Only during test windows. Assumption D1: **4 windows of 4 hours per month = 16 hours**. Everything is destroyed after each window. |
| **prod** | The full pilot architecture running 24/7: APIs, simulators, ingestion, orchestration, batch processing. | 730 hours per month |

## dev: services and usage

| # | Service | Configuration | Usage | How to verify |
|---|---|---|---|---|
| D1 | Test windows | — | 16 h per month | Team agreement (cost rules in `infra/README.md`) |
| D2 | ECS Fargate | 4 tasks (3 APIs + F5), 0.25 vCPU / 0.5 GB each | 16 h | `infra/modules/ecs` (T-27.2) |
| D3 | RDS PostgreSQL | `db.t4g.micro`, Single-AZ, 20 GB gp3, 7-day backups | 16 h | `infra/modules/rds` (T-25.1) |
| D4 | Application Load Balancer | 1 ALB, about 0.5 LCU | 16 h | `infra/modules/alb` (T-27.3) |
| D5 | Public IPv4 addresses | 4 tasks + 2 ALB nodes | 16 h | ADR-011 (public subnets for Fargate) |
| D6 | EC2 | 1 `t4g.nano` + 8 GB gp3 (admin instance) | 16 h | `infra/modules/admin_instance` (T-22.1) |
| D7 | VPC interface endpoints | 3 endpoints (SSM) in 1 AZ | 16 h | `infra/modules/admin_instance` |
| D8 | NAT Gateway | none | — | `enable_nat_gateway = false` (ADR-011) |
| D9 | Secrets Manager | 2 secrets (RDS master, app secrets) | 16 h, prorated | `infra/modules/rds`, `infra/modules/secrets` (T-25.x) |
| D10 | CloudWatch Logs | 0.2 GB ingested, 7-day retention | per month | `infra/modules/logs` (T-27.4) |
| D11 | ECR | 2 GB of images | prorated | `infra/modules/ecr` (T-27.1) |
| D12 | S3 (persistent) | 7.5 GB in Standard + Terraform state | 730 h | `infra/envs/data`, `infra/bootstrap` |

## prod: services and usage

| # | Service | Configuration | Usage | How to verify |
|---|---|---|---|---|
| P1 | ECS Fargate, APIs | 3 tasks (customer, control center, inventory), 0.25 vCPU / 0.5 GB | 24/7 | Same task size as dev (T-27.2) |
| P2 | ECS Fargate, simulators | 2 tasks (F3, F5), 0.25 vCPU / 0.5 GB | 24/7 | US-11, US-15 |
| P3 | EC2, RabbitMQ + Airflow | 1 `t3.large` (2 vCPU, 8 GB) + 30 GB gp3, Docker Compose with RabbitMQ and Airflow; queues on the EBS volume | 24/7 | G8, ADR-001, *Alternatives* |
| P4 | ECS Fargate, ingestion consumer | 1 task, 0.25 vCPU / 0.5 GB | 24/7 | US-29 |
| P5 | Airflow | Scheduler, webserver and Celery worker on the P3 instance; metadata in RDS (P8) | included in P3 | G8, ADR-004 |
| P6 | ECS Fargate, Spark 30-minute batches | 2 vCPU / 8 GB, 5 min per run, 48 runs per day | 120 h per month, on-demand | G8, ADR-002; to be measured in US-42 |
| P7 | ECS Fargate, Spark daily close | 4 vCPU / 16 GB, 45 min per day (maximum allowed) | 22.5 h per month, on-demand: a Spot interruption could break the 45-minute limit | G8, US-55 (close under 45 minutes) |
| P8 | RDS PostgreSQL | `db.t4g.small` (2 GB RAM), Single-AZ, 20 GB gp3, 7-day backups | 24/7 | US-25; Multi-AZ left out on purpose (pilot) |
| P9 | Application Load Balancer | 1 ALB, about 0.5 LCU | 24/7 | G7 |
| P10 | Public IPv4 addresses | 6 long-running tasks + the EC2 instance + 2 ALB nodes = 9 | 24/7 | P1–P4 and ADR-011 |
| P11 | S3 | 10 GB Standard in the first month (F1 + one month of readings), 150,000 PUT, 1,000,000 GET | per month | G5, G6, lifecycle T-23.2 |
| P12 | CloudWatch | 2 GB of logs ingested and stored, 10 alarms | per month | US-63 |
| P13 | Secrets Manager | 2 secrets | per month | US-25 |
| P14 | ECR | 5 GB of images (lifecycle keeps the last 10 per repository) | per month | T-27.1 |
| P15 | Data transfer out | Under 100 GB per month | free tier of data transfer | G7 |

## One-off costs (not monthly)

| # | Service | Configuration | Usage | How to verify |
|---|---|---|---|---|
| O1 | ECS Fargate **Spot**, Spark historical load | 4 vCPU / 16 GB, about 3 h for F1 (167 million readings), Spot price (-70%): about 0.21 USD | once; it can be retried from scratch if Spot interrupts it | G8, US-41 |
| O2 | EKS, F5 simulator | Control plane 0.10 USD per hour + 1 pod of 0.25 vCPU / 0.5 GB, weeks 5 and 6, cluster created only during test windows | about 0.11 USD per window hour | G8, ADR-006, US-50; compared in *Alternatives* |

## What is not included

- **Admin instance in prod**: it is created only when an admin task needs it.
- **Taxes, support plans and AWS Marketplace**: not covered by credits.
