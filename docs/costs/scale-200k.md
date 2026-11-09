---
title: Scaling to 200,000 meters
sidebar_position: 5
---

# Scaling to 200,000 meters (US-58, T-58.2)

Resources and monthly cost of prod for two sizes: the **pilot** (5,500 meters, G5) and **200,000 meters**, extrapolated
from what was measured in the dev window of 8-9 November 2026. The analysis and the recommendation are in T-58.3; the
load test of the simulator at a higher scale is T-58.1.

Every number is marked **measured** (from a real run) or **extrapolated** (with the rule written next to it).
Prices: `us-east-1`, on-demand, as in *Monthly estimate*.

## What was measured

| Run (9 Nov) | Size | Input | Time | Fargate USD |
|---|---|---|---|---|
| Daily close `voltiagrid_readings`, F3 `2026-11-04` (KAN-317) | 2 vCPU / 8 GB per job | 793,528 readings (about 5,500 meters, 3 dates) | 12.2 min wall clock | 0.0358 |
| `clean_readings`, full F1 history | 8 vCPU / 32 GB, Spot | 167,817,209 readings | 26.0 min | — |
| `estimate_gaps`, full F1 history, with PR data #76 (KAN-356) | 8 vCPU / 32 GB, on-demand | 167.8 M clean rows → 174,362,736 filled rows | 24.7 min | 0.19 |
| `fact_consumption`, full F1 history | 8 vCPU / 32 GB, on-demand | 174.4 M filled rows | 6.1 min | 0.05 |

Measured rates on 8 vCPU: cleaning about **108,000 readings per second**, estimation about **120,000 rows per second**,
the monthly consumption fact about **476,000 rows per second**. Each Fargate task also spends about 2 minutes
starting (image pull, JVM, Spark): `clean_readings` worked 47 s of its 2.6 min in the daily close.

Storage in S3: raw F1 is 7.87 GB for 167.8 M readings (**47 bytes per reading**); clean Parquet is 1.02 GB
(**6.1 bytes per reading**).

## Volume

| | Pilot | 200,000 meters | Rule |
|---|---|---|---|
| Readings per day | 264,000 | 9,600,000 | meters × 48 (×36.4) |
| Concentrators (64 meters each, simulator) | 86 | 3,125 | meters / 64 |
| F3 messages per month (one raw object each) | 124,000 | 4,500,000 | concentrators × 48 × 30 |
| New raw data per month | 0.37 GB | 13.5 GB | readings × 30 × 47 B |
| New clean data per month | 0.05 GB | 1.8 GB | readings × 30 × 6.1 B |

## Daily close at 200,000 meters (extrapolated)

Each job processes one day (9.6 M readings), except `estimate_gaps`, which reads the day plus the 28 days before it
for the weekday profile (about 288 M clean rows, 1.7 times the whole F1 history), and `fact_consumption`, which
rebuilds the month (up to 288 M filled rows).

| Job | 8 vCPU / 32 GB | 16 vCPU / 64 GB | Rule |
|---|---|---|---|
| `clean_readings` | 3.3 min | — | 9.6 M / 108,000 per s + 2 min start |
| `estimate_gaps` | **30-41 min** | **about 20 min** | 1.7 × 24.7 min (less when only 3 days are gridded); 16 vCPU assumes it scales with the cores (not measured) |
| `fact_consumption` | 10 min | — | 288 M / 476,000 per s |
| `control_counts`, `circuit_load`, `transformer_losses`, `suspicious_meters` | about 3 min each, in parallel, on 2 vCPU / 8 GB | — | one day of data; mostly the start of the task |
| `billing` | about 2 min | — | as in the pilot |
| **Critical path** | **45-55 min: misses US-55** | **about 35 min: meets US-55** | clean → estimate → consumption → billing |

At 200,000 meters the daily close only fits in 45 minutes if `estimate_gaps` runs on 16 vCPU / 64 GB (the largest
Fargate task) or if the weekday profile is kept from one day to the next instead of being recomputed from 28 days.
Without the fix of PR data #76 the close would not finish at any size of task.

Cost of one close: estimate 20 min on 16 vCPU (0.31) + clean 3.3 min and consumption 10 min on 8 vCPU (0.10) + five
small jobs on 2 vCPU (0.03) = **about 0.44 USD per day, 13.26 USD per month**. The pilot measured **0.0358 USD per day,
1.07 USD per month** (the estimate assumed 5.25 USD, line P7).

## Monthly cost of prod

Lines of *Monthly estimate* that change with the number of meters; the rest stay as they are.

| Line | Service | Pilot (5,500) | 200,000 meters | Why it changes |
|---|---|---|---|---|
| P1 | Fargate, 3 API tasks | 27.05 | 54.10 | **assumed**: 0.5 vCPU / 1 GB per task for 36 times more customers in the portal |
| P7 | Fargate, daily close | 1.07 **measured** | 13.26 **extrapolated** | section above |
| P8 | RDS PostgreSQL | 25.66 | 53.20 | **assumed**: db.t4g.medium (0.065 per hour) and 50 GB gp3 for 200,000 meters and customers |
| P11 | S3 | 1.38 | 23.48 | 25 GB stored the first month (0.58) + 4.5 M PUT (22.50) + 1 M GET (0.40) |
| P2, P3, P4, P6, P9, P10, P12-P15 | rest | 159.73 | 159.73 | unchanged; P6 (30-minute batches) is not measured yet (US-42) |
| | **Total** | **214.89** | **303.77** | |

The pilot total is the 219.07 USD of *Monthly estimate* with line P7 replaced by the measured daily close.

## What drives the cost at 200,000 meters

- **S3 requests, not storage:** one raw object per F3 message gives 4.5 M PUT per month (22.50 USD). Writing several
  messages per object would bring this line under 1 USD.
- **RDS and the APIs** double because they serve 36 times more customers; both are assumptions until the load test
  (T-58.1) measures them.
- **Spark stays cheap** (13 USD per month) once `estimate_gaps` is linear; its limit is the 45 minutes of US-55, not
  money.
- Storage grows by about 15 GB per month (0.35 USD more each month); the raw lifecycle rules of T-23.2 keep it in check.
