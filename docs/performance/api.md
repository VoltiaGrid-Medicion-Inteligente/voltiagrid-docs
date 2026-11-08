---
title: Customer API
sidebar_position: 2
---

# Customer API performance (US-47, T-47.3)

**Goal (RNF-04):** a customer's consumption loads fast: the **95th percentile (p95) of the response time is at most
500 ms** for one month of daily data, the call behind the customer's main screen (`GET /me/consumption/daily`).

## Method

Load test with **Locust** (voltiagrid-api, `loadtest/`, T-47.1). Each simulated user is one customer of the seed: it
logs in once and asks for its month every 0.5 to 1.5 seconds. 100 users, started 20 per second, for 2 minutes,
against the local stack (two API workers). `python -m loadtest.report` reads Locust's CSV and prints the p95 against
the 500 ms target. Before and after on the same machine with the same seed.

```powershell
locust -f loadtest/locustfile.py --headless -u 100 -r 20 -t 2m --host http://localhost:8001 --csv loadtest/results/before --only-summary
python -m loadtest.report loadtest/results/before_stats.csv loadtest/results/after_stats.csv
```

## What was slow

The API computed every month on each request: 1,488 half hours per meter from the consumption model, priced band by
band. That is CPU in Python, so with many customers at once the requests queue behind each other: p95 was 470 ms
with 100 users, just under the target with no margin.

## Changes (T-47.2)

| Change | Why |
|---|---|
| **Aggregate table** `consumption_daily` (customer, day, band → kWh, cost, readings, estimated), filled by `python -m scripts.build_consumption_daily` | A month becomes one read of about 90 rows instead of computing 1,488 half hours per meter. A month not built is still computed, with the same response |
| **Index**: the primary key `(customer_code, date, band_name)` | The monthly query is a range on the first two columns of the index. The inventory lookups (`customer.code` unique, `meter.customer_id`) already had their indexes from the first migration |
| **Connection pool** per worker (`DB_POOL_SIZE` 10, `DB_POOL_OVERFLOW` 10, `pool_pre_ping`, recycle every 30 min) | A request takes an open connection instead of opening one (a TLS handshake to RDS in AWS) |

The response is the same before and after: `tests/test_consumption_daily.py` compares the computed and the stored
answer field by field.

## Results

Reference measurement (local stack, 2 cores, dev seed of 200 customers, month 2013-01, 100 users for 45 s):

| | Requests | Failures | Median | p95 | p99 | RNF-04 |
|---|---|---|---|---|---|---|
| Before (computed on each request) | 3,716 | 0 | 140 ms | 470 ms | 580 ms | meets, without margin |
| After (`consumption_daily`) | 4,169 | 0 | 8 ms | 21 ms | 100 ms | meets |

p95 went from 470 ms to 21 ms (−96%) and the API served 15% more requests in the same time.

**Measurement of the team** (Carlos Aponte's laptop, local stack, 100 users for 2 minutes; KAN-295 and KAN-296):

| | Requests | Failures | Median | p95 | p99 | RNF-04 |
|---|---|---|---|---|---|---|
| Before (computed on each request) | 4,030 | 0 | 1,600 ms | 2,800 ms | 4,000 ms | misses |
| After (`consumption_daily`) | | | 74 ms | 730 ms | 2,200 ms | misses (730 > 500 ms) |

p95 went from 2,800 ms to 730 ms (−74%), still above the 500 ms of RNF-04 on this laptop. The reference run meets
it (21 ms); the gap is the laptop under load (the API, Postgres and Locust on the same machine). The next steps are
to measure on the dev stack in AWS once consumption_daily is built there (see Notes for AWS) and to check whether
the requests still go through the computed path (a month not built yet).

## Notes for AWS

- In RDS the table starts empty, so the API computes every month as before. Building it there needs a one-off ECS
  task whose image has `scripts/` and `simulators/` (the migrate-seed image has neither): an open point for sprint 6.
- With 0.25 vCPU per API task (US-27) the computed path is slower than on a laptop, which makes the table more
  important there, not less.
- When the clean layer is served (sprint 6), the same table is filled from the curated facts instead of the model.
