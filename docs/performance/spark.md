---
title: Spark
sidebar_position: 1
---

# Spark performance of the daily close (US-42, T-42.3)

**Goal (RNF-02):** the daily close finishes in less than 45 minutes at the lowest cost. The close is the readings DAG
of voltiagrid-data: clean → estimate → circuit load, monthly consumption and billing, and the losses jobs.

## Method

`python -m jobs.benchmark` (voltiagrid-data, T-42.1) runs the close of one cleaning run in one Spark session, in the
DAG's order, and records per job the wall clock, the shuffle (bytes moved between partitions), the stages and tasks,
and the joins in the executed plans; it also saves every physical plan. Same machine, same data, before and after
each change. Details: voltiagrid-data, `docs/data/performance.md`.

## Baseline and changes

The baseline showed one job with most of the time: `clean_readings`, whose plan scanned the raw JSON **twice** (once
to find the run's dates, once to clean them). The changes of T-42.2:

| Change | Kind | Why |
|---|---|---|
| Raw readings parsed once (`localCheckpoint`) in `clean_readings` | Cache | Removes the second scan of every raw file |
| `F.broadcast` of the F4 inventory in `circuit_load`, `fact_consumption`, `transformer_losses` | Broadcast join | Already chosen by the planner (F4 is a few hundred KB); the hint keeps it when the inventory grows |
| `SPARK_SHUFFLE_PARTITIONS` | Partitioning | 8 for a laptop and the 2-vCPU daily task; about 4 per core (32) for the F1 history on 8 vCPU |

Measured and not kept: caching the filled readings in `fact_consumption` and filtering the weekday profile of
`estimate_gaps` before the join. Neither made the close faster on this data, so they would only add code.

## Results

Reference measurement of the change (synthetic lake: 1,000 meters, 35 days, 1.65 million readings; 2 cores):

| Job | Seconds before → after | Shuffle (MB) before → after |
|---|---|---|
| `clean_readings` | 131.3 → 79.4 | 372.1 → 372.1 |
| `estimate_gaps` | 63.7 → 62.2 | 107.1 → 108.3 |
| `circuit_load` | 6.4 → 6.6 | 45.5 → 45.5 |
| `fact_consumption` | 7.7 → 7.1 | 0.9 → 0.9 |
| `billing` | 1.0 → 0.8 | 0.7 → 0.7 |
| **Total** | **210.1 → 156.1 (−26%)** | |

Shuffle did not change: the gain is reading less, not moving less. One day of that lake (the size of a daily
close, 47,000 readings) took 33.2 s before and 31.6 s after: at that size most of the time is starting Spark.

**Measurement on the pilot lake** (the team's laptop, `python -m jobs.benchmark --compare …`; before and after
measured back to back under the same conditions):

| Job | Seconds before → after | Shuffle (MB) before → after |
|---|---|---|
| `clean_readings` | 23.0 → 21.9 | 2.4 → 2.4 |
| `estimate_gaps` | 5.4 → 5.4 | 0.4 → 0.4 |
| `circuit_load` | 4.3 → 4.2 | 0.2 → 0.2 |
| `fact_consumption` | 3.7 → 3.6 | 0.1 → 0.1 |
| `billing` | 3.2 → 3.3 | 0.0 → 0.0 |
| `transformer_losses` | 4.8 → 5.0 | 0.5 → 0.5 |
| `suspicious_meters` | 3.6 → 4.4 | 0.0 → 0.0 |
| **Total** | **48.0 → 47.8 (−0%)** | |

Machine: 16 cores, 15 GB RAM, Windows. Run: `f3-2026-11-04` (3 dates, 9,430 readings), shuffle partitions 8.

At this size the difference is within noise: the same code took 36.6 s and 48.0 s on two measurements of the same
laptop, about 30% apart. Like the one-day measurement of the reference lake, most of the time is starting Spark; the
gain of reading the raw once shows with volume, and the historical F1 load on Fargate (US-41) is where it is measured.

## Execution plans

The joins with F4 are `BroadcastHashJoin` in every plan of the close (the small side is copied to each task, nothing
is shuffled for the join), and the tariff bands are a `BroadcastNestedLoopJoin` (a range condition on date and time
against the 8 rows of F7, the right plan for a tiny table). Excerpt of the final plan of `circuit_load` (the clean
readings joined with the meters of F4, then the circuit capacities):

```
+- * BroadcastHashJoin Inner BuildRight (9)
   :- * Project (4)
   :  +- * Filter (3)
   :     +- * ColumnarToRow (2)
   :        +- Scan parquet  (1)
   +- BroadcastQueryStage (8), Statistics(sizeInBytes=32.0 MiB, rowCount=1.00E+3)
      +- BroadcastExchange (7)
         +- * Filter (6)
            +- Scan csv  (5)

(1) Scan parquet
PartitionFilters: [date#238 INSET 2013-02-01, 2013-02-02, ..., 2013-03-07]
```

`PartitionFilters` shows partition pruning: the job reads only the dates of the run, not the whole clean layer.
`tests/test_plans.py` keeps the broadcast joins from coming back as shuffles.

## The close on Fargate

Each job of the close is its own Fargate task (US-40), and a task takes about a minute to start (pull a 1.5 GB image,
start Java). With 8 Spark jobs, part of them in parallel, a pilot day is well inside 45 minutes. When the 200,000
meters of US-58 make the close tight, the next step is fewer, bigger tasks (several jobs in one Spark session) rather
than more tuning of each job.