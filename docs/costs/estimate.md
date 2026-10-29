---
title: Monthly estimate
sidebar_position: 2
---

# Monthly estimate per environment (US-24, T-24.2)

Built in the **AWS Pricing Calculator** with the assumptions of *Services and usage assumptions* (codes D1–D12 and P1–P15; the one-off costs O1 and O2 are listed there).
Prices: `us-east-1`, on-demand, USD, October 2026, before credits.

- **Calculator estimate (public link):** not saved; the exported CSV attached to the pull request of T-24.2 has every line of the estimate.
- **Exported file:** `estimate-2026-10.csv` attached to the pull request of T-24.2

## Summary

| Environment | Monthly cost (USD) | Notes |
|---|---|---|
| dev | **2.85** | 16 hours of test windows + persistent S3. About **0.16 USD per window hour**. |
| prod | **219.07** | Full pilot architecture 24/7 |

With about 110 USD of credits left, dev can run for the rest of the project. One month of prod would cost twice the credits, which is why prod is never left running: it is only deployed for the final demo (a few hours).

## dev

| Line | Service | Configuration and usage | USD per month |
|---|---|---|---|
| D2 | ECS Fargate | 4 tasks × 0.25 vCPU / 0.5 GB × 16 h | 0.79 |
| D3 | RDS PostgreSQL | db.t4g.micro Single-AZ × 16 h + 20 GB gp3 prorated | 0.31 |
| D4 | Application Load Balancer | 16 h × (0.0225 + 0.5 LCU × 0.008) | 0.42 |
| D5 | Public IPv4 addresses | 6 addresses × 0.005 × 16 h | 0.48 |
| D6 | EC2 | t4g.nano × 16 h + 8 GB gp3 | 0.08 |
| D7 | VPC interface endpoints | 3 × 0.01 × 16 h | 0.48 |
| D9 | Secrets Manager | 2 secrets × 0.40, prorated | 0.02 |
| D10 | CloudWatch Logs | 0.2 GB ingested × 0.50 | 0.10 |
| D11 | ECR | 2 GB × 0.10, prorated | 0.00 |
| D12 | S3 | 7.6 GB Standard × 0.023 | 0.17 |
| | **Total dev** | | **2.85** |

> The AWS Pricing Calculator shows 45.44 USD for the dev group instead of 2.85 USD. It does not accept a fraction of a resource and charges these lines for the whole month: the RDS disk (minimum 20 GB, D3), the Application Load Balancer (D4) and the interface endpoints (D7). This table prorates them to the 16 hours that dev exists each month (unit prices × 16 h), which is what the account really pays because the dev stack is destroyed after every test window.

## prod

| Line | Service | Configuration and usage | USD per month |
|---|---|---|---|
| P1 | ECS Fargate | 3 API tasks × 0.25 vCPU / 0.5 GB × 730 h | 27.05 |
| P2 | ECS Fargate | 2 simulator tasks × 0.25 vCPU / 0.5 GB × 730 h | 18.03 |
| P3 | EC2 | t3.large × 730 h + 30 GB gp3 (RabbitMQ + Airflow) | 63.14 |
| P4 | ECS Fargate | Consumer, 0.25 vCPU / 0.5 GB × 730 h | 9.02 |
| P5 | — | Airflow runs on the P3 instance | 0.00 |
| P6 | ECS Fargate | Spark 30-min batches, 2 vCPU / 8 GB × 120 h | 13.99 |
| P7 | ECS Fargate | Spark daily close, 4 vCPU / 16 GB × 22.5 h | 5.25 |
| P8 | RDS PostgreSQL | db.t4g.small Single-AZ × 730 h + 20 GB gp3 | 25.66 |
| P9 | Application Load Balancer | 730 h × 0.0225 + 0.5 LCU × 0.008 × 730 h | 19.34 |
| P10 | Public IPv4 addresses | 9 × 0.005 × 730 h | 32.85 |
| P11 | S3 | 10 GB Standard + 150k PUT + 1M GET | 1.38 |
| P12 | CloudWatch | 2 GB logs ingested and stored + 10 alarms | 2.06 |
| P13 | Secrets Manager | 2 secrets | 0.80 |
| P14 | ECR | 5 GB | 0.50 |
| P15 | Data transfer out | under 100 GB | 0.00 |
| | **Total prod** | | **219.07** |

> In the AWS Pricing Calculator the prod group shows 218.98 USD, within 0.09 USD of this table. Two lines are entered differently: P6 as 120 tasks of 1 hour (the calculator rounds 5 minutes up to 0.09 hours, which would add 8%), and P12 shows 2.01 USD because the calculator estimates stored logs as 15% of the ingested volume (compressed).

**Where the money goes in prod:** compute on Fargate is 33%, the EC2 instance for RabbitMQ and Airflow 29%, public IPv4 addresses 15%, RDS 12%, the ALB 9%. Storage, logs and secrets are under 3%.

## Unit prices used

| Item | Price (USD) |
|---|---|
| Fargate Linux/x86 | 0.0405 per vCPU-hour, 0.00445 per GB-hour; Spot about 70% less |
| RDS db.t4g.micro / db.t4g.small (PostgreSQL, Single-AZ) | 0.016 / 0.032 per hour |
| RDS gp3 storage | 0.115 per GB-month |
| ALB | 0.0225 per hour + 0.008 per LCU-hour |
| Public IPv4 address | 0.005 per hour |
| EC2 t4g.nano / t3.large | 0.0042 / 0.0832 per hour; gp3 0.08 per GB-month |
| VPC interface endpoint | 0.01 per hour per AZ |
| Secrets Manager | 0.40 per secret-month |
| CloudWatch Logs | 0.50 per GB ingested, 0.03 per GB-month stored; alarm 0.10 per month |
| S3 Standard | 0.023 per GB-month; PUT 0.005 per 1,000; GET 0.0004 per 1,000 |
| ECR | 0.10 per GB-month |

## How to rebuild it in the calculator

1. Open [calculator.aws](https://calculator.aws/) → **Create estimate**.
2. **Add group** `dev` and **Add group** `prod`.
3. In each group, **Add service** for each line of the tables above, region **US East (N. Virginia)**, with the same configuration and usage. For partial-month lines (dev), use hours per month (16) where the calculator asks for usage.
4. Check that each group's monthly total matches this page (± 1 USD for rounding).
5. **Save and share** → copy the public link into the first lines of this page. **Export** → CSV, attach it to the pull request.