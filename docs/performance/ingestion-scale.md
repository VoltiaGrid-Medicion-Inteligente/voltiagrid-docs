---
title: Ingestion at 200,000 meters
sidebar_position: 3
---

# Ingestion load test at 200,000 meters (US-58, T-58.1)

The F3 concentrator simulator was run at the target size of 200,000 meters, and the queue, the consumer and the
first Spark job (`clean_readings`) were measured on that load. The numbers feed the cost of *Costs → Scaling to
200,000 meters* (T-58.2) and the analysis of T-58.3.

## Setup

| | |
|---|---|
| Date | 9 November 2026 |
| Machine | Laptop, AMD Ryzen 7 170 (16 threads), 15 GB RAM, Windows 11, Docker Desktop |
| Broker | `rabbitmq` of `voltiagrid-api/docker-compose.yml` (durable quorum queues, as in AWS) |
| Load | 200,000 synthetic meters, 64 per concentrator (3,125 concentrators), 4 intervals of 30 minutes = **800,000 readings** |
| Defects | Default rate of the simulator: gaps, a missing day, nulls, out-of-range values, offset clocks and duplicates |
| Raw | A scratch folder, not the lake: nothing was written to S3 or to `voltiagrid-api/lake` |

Commands (from `voltiagrid-api`, one at a time):

```powershell
docker compose up -d rabbitmq
docker compose run --rm --no-deps f3-simulator python -m simulators.concentrator --no-db --meters 200000 --ticks 4 --tick-seconds 0
$env:LAKE_DIR = "<scratch folder>"
docker compose run --rm --no-deps f3-consumer python -m ingestion --exit-when-idle 10
```

and from `voltiagrid-data`:

```powershell
python -m jobs.clean_readings --source f3 --ingest-date 2026-11-09 --raw <scratch>\raw --clean <scratch>\clean --curated <scratch>\curated --driver-memory 8g
```

The simulator published the four intervals as fast as it could (`--tick-seconds 0`) and the consumer started after
it finished, so the queue held the whole load at once: a harder case than live traffic, where one interval arrives
every 30 minutes.

## Results

| Step | Measured | Rate |
|---|---|---|
| Publish (simulator → RabbitMQ) | 800,000 readings in 12,500 messages, **116.8 s** including the container start | about 6,900 readings or 107 messages per second |
| Queue peak | **12,500 messages** in `readings.live`; 0 in `readings.resend` and `readings.dead` | — |
| Consume (RabbitMQ → raw) | 12,500 messages, 783,618 readings, **about 89 s** (98.9 s minus the 10 s idle wait) | about 140 messages or 8,800 readings per second |
| Raw written | 12,500 JSON files, **82.4 MB** | 105 bytes per reading |
| `clean_readings` | 768,379 clean rows in **149.9 s** (162.4 s with the Spark start) | about 5,100 rows per second |

**Nothing was lost.** The simulator withheld 31,812 readings on purpose (15,536 gaps and 16,276 of a missing day) and
added 15,430 duplicates: 800,000 − 31,812 + 15,430 = 783,618, exactly what the consumer stored. All queues ended at 0,
and the dead-letter queue stayed empty.

Quality flags of the clean run: 728,089 `ok`, 15,042 `null_value`, 10,056 `invalid_clock`, 7,628 `negative`,
7,564 `out_of_range`. Deduplication (RN-02) removed 783,618 − 768,379 = 15,239 readings; the simulator had injected
15,430 duplicates.

### Headroom of the queue and the consumer

At 200,000 meters live traffic is 200,000 readings every 30 minutes (3,125 messages), that is **111 readings per
second on average**. One consumer task stores about 8,800 per second:

| Case | Load | Drain time with one consumer |
|---|---|---|
| One live interval | 200,000 readings, 3,125 messages | about 22 s of every 30 minutes |
| Bulk resend after a 24 h outage of 1,000 meters | 48,000 readings, 750 messages | about 5 s |
| Two hours of backlog (this test) | 783,618 readings, 12,500 messages | about 89 s |

So one consumer covers 200,000 meters about 80 times over, and the queue absorbs a two-hour backlog without loss.
A second consumer task is still useful for availability, not for throughput.

### Where `clean_readings` spends its time: small files

The consumer writes one raw object per message (64 readings each). To see the cost of that, the same 12,500 messages
were read twice: as they are, and copied into 250 JSON-lines files of 50 messages each (the consumer's ACK batch):

| Raw layout | Files | Read and explode all readings |
|---|---|---|
| One message per file (today) | 12,500 | **145.2 s** and 269.5 s (two runs) |
| 50 messages per file | 250 | **1.2 s** and 0.8 s |

Almost all of the 150 s of `clean_readings` goes into opening files, not into cleaning. The local Windows file system
makes each file expensive. S3 adds its own latency per request, so the effect is also present in AWS, although its
size there was not measured.

## What this means at 200,000 meters

| Item | Value | Basis |
|---|---|---|
| F3 raw objects per day | 150,000 | 3,125 concentrators × 48 (measured layout: one object per message) |
| F3 raw size per day | about 1.0 GB | 9.6 M readings × 105 bytes (**measured** here; *Scaling to 200,000 meters* used 47 bytes, the F1 CSV size) |
| F3 raw size per month | about 30 GB | 30 days; the cost page assumed 13.5 GB |
| `clean_readings` of one day | about 9-10 min on 2 vCPU | **extrapolated**: the pilot close of KAN-317 read about 12,400 objects in 47 s on Fargate; 150,000 is 12 times more |
| `clean_readings` of one day, 50 messages per object | well under a minute of reading | 3,000 objects; from the small-file test above |

Recommendation for T-58.3: the consumer should write one object per batch (it already ACKs in batches of 50) instead
of one per message. That change has three effects:

- it cuts the S3 PUT requests by 50 times, from 22.50 to about 0.45 USD per month;
- it removes most of the reading time of `clean_readings`;
- raw stays append-only and untouched, as ADR-007 asks, because each message is kept as received, one per line.

`read_f3` would read JSON lines instead of `multiLine` documents.

## Not measured

- The consumer writing to S3 (here it wrote to a local disk) and RabbitMQ on the EC2 `t3.large` of dev.
- The APIs and RDS with 200,000 customers: lines P1 and P8 of the cost page stay assumptions.
- A full day of 200,000 meters (9.6 M readings): the test used 4 intervals, and the day is extrapolated linearly.
