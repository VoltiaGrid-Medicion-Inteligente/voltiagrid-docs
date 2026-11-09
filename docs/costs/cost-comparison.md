---
title: Cost comparison with measured runs
sidebar_position: 7
---

# Cost comparison with measured runs (KAN-342)

This page compares the cost alternatives with the numbers measured in the dev window of 8-9 November 2026. It uses
three other pages and does not repeat their method:

- *Monthly estimate*: the assumed cost per environment (the pilot estimate, 219.07 USD/month).
- *Scaling to 200,000 meters*: resources and cost of the daily close, measured and extrapolated.
- *Analysis for 200,000 meters*: the four scenarios and the 3-year storage strategy.

All figures are USD per month in `us-east-1`, on-demand, unless they say otherwise.

## 1. What was measured

| Item | Estimate | Measured | Source |
|---|---|---|---|
| Daily close, pilot (about 5,500 meters) | 5.25 USD/month (line P7) | **0.0358 USD/day**, 12.2 min | KAN-317 |
| Daily close, pilot, per month | 5.25 USD/month | **1.07 USD/month** (0.0358 × 30) | KAN-317 |
| Full F1 history, `estimate_gaps` | not estimated | 24.7 min, 0.19 USD | KAN-356 |
| Full F1 history, `fact_consumption` | not estimated | 6.1 min, 0.05 USD | KAN-356 |

The measured daily close is about 80% cheaper than the estimate. The estimate's 5.25 USD was a planning figure, not a
measurement: the real cost is small compared with the always-on services.

## 2. Alternatives at 200,000 meters

| Line | A. Pilot today | B. 200,000, same layout | C. 200,000, recommended | D. 200,000, high availability |
|---|---|---|---|---|
| APIs (Fargate) | 27.05 | 54.10 | 54.10 | 54.10 |
| Daily close (Fargate) | 1.07 (measured) | 13.26 (extrapolated) | 13.26 (extrapolated) | 13.26 (extrapolated) |
| RDS PostgreSQL | 25.66 | 53.20 | 53.20 | 106.40 (Multi-AZ) |
| S3 (3-year average) | 1.38 | 36.01 | 1.98 | 1.98 |
| RabbitMQ cluster (3 nodes) | — | — | — | 98.30 |
| Second consumer task | — | — | — | 9.02 |
| Interface endpoints (4 × 2 AZ) | — | — | — | 58.40 |
| Public IPv4 | in the total above | in the total above | in the total above | −21.90 (tasks in private subnets) |
| Rest of the estimate, unchanged | 159.73 | 159.73 | 159.73 | 159.73 |
| **Total per month** | **214.89** | **316.30** | **282.27** | **479.29** |
| **Per meter per month** | 0.0391 | 0.0016 | **0.0014** | 0.0024 |

Each total is the sum of its lines. The pilot total replaces line P7 of the estimate with the measured close.

## 3. Comparison of two alternatives

### 3.1 Scenario C (recommended) against scenario D (high availability)

| | C. Recommended | D. High availability | Difference (D − C) |
|---|---|---|---|
| Total per month | 282.27 USD | 479.29 USD | **+197.02 USD** |
| What changes | — | RDS Multi-AZ (+53.20), RabbitMQ cluster (+98.30), second consumer (+9.02), interface endpoints (+58.40), public IPs removed (−21.90) | |

D costs about 70% more than C. It buys availability: a second database node, a three-node broker and a second consumer,
so one failure does not stop ingestion. C keeps a single broker and a single consumer, as today, and relies on the
queues surviving a restart on the EBS volume. The choice depends on the availability target of production, which is a
team decision.

### 3.2 Scenario B (same layout) against scenario C (recommended)

| | B. Same layout | C. Recommended | Difference (B − C) |
|---|---|---|---|
| Total per month | 316.30 USD | 282.27 USD | **+34.03 USD** |
| What changes | S3 at 36.01 USD: one raw JSON object per message, 4.5 M PUT per month and 22.50 USD of requests | S3 at 1.98 USD: one gzip object per batch of 50 messages | |

The difference is S3: about 22 USD of PUT requests and about 12 USD of storage, because raw objects of 6.7 KB never move
to cheaper classes and are not compressed. Changing the raw layout (one object per 50 messages, compressed) saves about
34 USD per month at 200,000 meters. It does not change the daily close, which needs `estimate_gaps` on 16 vCPU in both
scenarios to stay under 45 minutes.

## 4. Recommendation

- **Use scenario C** as the cost target for 200,000 meters: 282.27 USD/month, 0.0014 USD per meter.
- **Keep the raw layout change** (gzip, one object per batch): it is the largest saving after the always-on services.
- **Decide availability separately**: scenario D (479.29 USD/month) only when production needs the second database node
  and broker. This is not needed for the pilot.

## 5. What is not measured

- **APIs and RDS at 200,000 customers** are assumptions (lines P1 and P8 of scenarios B to D): no load test of the APIs
  at this size was run.
- **The daily close at 200,000 meters** (13.26 USD/month) is extrapolated. `estimate_gaps` on 16 vCPU assumes the job
  scales with the cores; it was not measured.
- **Prices** are on-demand. Savings Plans or Reserved Instances for the always-on services would lower C and D; they
  are not applied here.
