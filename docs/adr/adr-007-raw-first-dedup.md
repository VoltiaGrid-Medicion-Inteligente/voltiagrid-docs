---
sidebar_position: 7
---

# ADR-007: Store raw readings untouched; deduplicate in Spark

- **Status:** Proposed
- **Date:** 2026-10-09
- **Owner:** P1 / P2

## Context
Readings arrive with known defects: nulls, duplicates with different values, skewed clocks, impossible values and missing days. Business rules decide how to fix them (RN-01 to RN-03), and those rules may change.

## Decision
The consumer **stores every message as received** in S3 raw and only ignores exact redeliveries (same `message_id`). All business cleaning (clock normalization, duplicate resolution by highest sequence, gap estimation) happens in **Spark**.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| Deduplicate and clean in the consumer | Puts business rules in the hot path, slows ingestion during a bulk resend and loses the original data needed to reprocess. |
| Unique constraint in the database at insert time | Rejects the second reading instead of keeping the one with the highest sequence (RN-02) and forces every reading into a relational table. |

## Consequences
- Ingestion stays simple and fast.
- Any period can be reprocessed when a rule changes.
- Raw storage is larger; lifecycle rules keep the cost down (ADR-003).