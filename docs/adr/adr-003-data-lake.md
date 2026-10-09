---
sidebar_position: 3
---

# ADR-003: S3 data lake with raw, clean and curated layers in Parquet

- **Status:** Accepted
- **Date:** 2026-10-09
- **Owner:** P2 / P3

## Context
Readings must be kept for **3 years** at the lowest cost, reprocessed when needed, and read efficiently by Spark and Power BI.

## Decision
Store data in **S3** in three layers: **raw** (as received), **clean** (validated, deduplicated, estimated) and **curated** (aggregated, analytics-ready). Clean and curated use **Parquet** partitioned by date. Lifecycle rules move old partitions to cheaper storage classes.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| All readings in RDS PostgreSQL | Billions of rows over 3 years make storage and backups expensive and analytical queries slow; RDS is kept for the inventory and the small aggregates the APIs need. |
| Amazon Redshift as the main store | A warehouse cluster costs money even when idle and is more than the pilot needs; S3 + Parquet keeps storage cheap and still serves Spark and Power BI. |

## Consequences
- Any period can be reprocessed from raw.
- Storage cost is low and predictable; retention is enforced by lifecycle rules.
- Partition layout and naming must be agreed and documented in the data dictionary.