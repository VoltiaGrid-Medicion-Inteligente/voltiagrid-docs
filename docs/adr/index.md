---
title: Architecture decision records
sidebar_position: 0
---

# Architecture decision records (ADRs)

An ADR records one important decision: the context, what we chose, the alternatives we discarded and why, and the consequences we accept. Nothing is decided off-record: if a decision changes, a new ADR supersedes the old one.

## Index

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](./adr-001-ingestion-broker.md) | RabbitMQ as the ingestion broker | Accepted |
| [ADR-002](./adr-002-batch-processing.md) | Spark on ECS Fargate for batch processing | Accepted |
| [ADR-003](./adr-003-data-lake.md) | S3 data lake with raw, clean and curated layers in Parquet | Accepted |
| [ADR-004](./adr-004-orchestration.md) | Airflow with CeleryExecutor for orchestration | Accepted |
| [ADR-005](./adr-005-api-framework.md) | FastAPI with JWT for the APIs | Accepted |
| [ADR-006](./adr-006-container-runtime.md) | ECS Fargate as main runtime, one component on EKS | Accepted |
| [ADR-007](./adr-007-raw-first-dedup.md) | Store raw readings untouched; deduplicate in Spark | Accepted |
| [ADR-008](./adr-008-repositories-and-docs.md) | One repository per area plus a Docusaurus docs site | Accepted |

**Status values:** *Accepted* (written, pending team review), *Accepted* (agreed by the team), *Superseded by ADR-XXX*.

## Template

Copy this structure for every new ADR (`adr-NNN-short-name.md`):

```markdown
# ADR-NNN: Title

- **Status:** Proposed | Accepted | Superseded by ADR-XXX
- **Date:** YYYY-MM-DD
- **Owner:** P1 | P2 | P3 | P4

## Context
What problem or requirement forces a decision.

## Decision
What we chose, in one or two sentences.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| Option A | ... |
| Option B | ... |

## Consequences
What we gain, what we give up, and what we must do because of this decision.
```