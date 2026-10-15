---
title: Operational dictionary (F4)
sidebar_position: 0
---

# Operational dictionary (F4)

Inventory database populated by the seed (US-01, E-03). Source of truth: `app/models/inventory.py` in `voltiagrid-api`. The ERD in `voltiagrid-api/docs/erd.md` is introductory; this page is normative.

## circuit

Electric circuit with its capacity. RN-08 compares projected load against 85% of this capacity.

| Field | Type (PostgreSQL) | ORM | Nullable | Key / Constraint | Example | Source | Used by |
|---|---|---|---|---|---|---|---|
| `id` | `INTEGER` | `Mapped[int] pk` | No | PK `pk_circuit` | `1` | Generated | Internal |
| `code` | `VARCHAR(20)` | `Mapped[str] unique` | No | Natural key `uq_circuit_code`, upsert key | `CT-000` | Seed `network.build_circuit`, pattern `CT-XXX` | FK target |
| `capacity_kva` | `NUMERIC(8,2)` | `Mapped[Decimal]` | No | CHECK `capacity_kva > 0`, range 1000.00–5000.00 | `2500.00` | Seed random with fixed seed | RN-08 |

## transformer

Transformer belonging to one circuit. RN-06 computes losses per transformer; the control center queries its load.

| Field | Type (PostgreSQL) | ORM | Nullable | Key / Constraint | Example | Source | Used by |
|---|---|---|---|---|---|---|---|
| `id` | `INTEGER` | `Mapped[int] pk` | No | PK `pk_transformer` | `1` | Generated | Internal |
| `code` | `VARCHAR(20)` | `Mapped[str] unique` | No | Natural key `uq_transformer_code`, upsert key | `TR-00001` | Seed `network.plan_network`, pattern `TR-XXXXX` | RN-06, F5 |
| `circuit_id` | `INTEGER` | `Mapped[int] FK` | No | FK `fk_transformer_circuit_id_circuit`, indexed | `1` | Resolved from `circuit.code` | Topology |
| `capacity_kva` | `NUMERIC(8,2)` | `Mapped[Decimal]` | No | CHECK `capacity_kva > 0`, range 100.00–500.00 | `250.00` | Seed random with fixed seed | RN-06 |

## customer

Household with its socioeconomic group. The dashboard slices consumption by ACORN.

| Field | Type (PostgreSQL) | ORM | Nullable | Key / Constraint | Example | Source | Used by |
|---|---|---|---|---|---|---|---|
| `id` | `INTEGER` | `Mapped[int] pk` | No | PK `pk_customer` | `1` | Generated | Internal |
| `code` | `VARCHAR(30)` | `Mapped[str] unique` | No | Natural key `uq_customer_code`, upsert key | `CU-MAC000002` | Seed `f1.build_customer`, `CU-<LCLid>` | FK target |
| `acorn_group` | `VARCHAR(30)` | `Mapped[str]` | No | None, raw value from F1, `ACORN-` normalized to `UNKNOWN` | `ACORN-A` | F1 `Acorn` | Reference |
| `acorn_grouped` | `VARCHAR(20)` | `Mapped[str]` | No | CHECK `IN ('Affluent','Comfortable','Adversity','Unknown')` | `Affluent` | F1 `Acorn_grouped`, normalized | Dashboard Q1 |

## contract

Customer contract with tariff type and validity dates. RN-07 needs to know whether the contract changed.

| Field | Type (PostgreSQL) | ORM | Nullable | Key / Constraint | Example | Source | Used by |
|---|---|---|---|---|---|---|---|
| `id` | `INTEGER` | `Mapped[int] pk` | No | PK `pk_contract` | `1` | Generated | Internal |
| `code` | `VARCHAR(40)` | `Mapped[str] unique` | No | Natural key `uq_contract_code`, upsert key | `CT-MAC000002-1` | Seed `f1.build_contract`, `CT-<LCLid>-1` | — |
| `customer_id` | `INTEGER` | `Mapped[int] FK` | No | FK `fk_contract_customer_id_customer`, indexed | `1` | Resolved from `customer.code` | RN-07 |
| `tariff_type` | `VARCHAR(20)` | `Mapped[str]` | No | CHECK `IN ('standard','dynamic')`, mapped from `Std`/`ToU` | `standard` | F1 `stdorToU` | RN-05 input, Q1 |
| `start_date` | `DATE` | `Mapped[date]` | No | None, fixed `2011-11-01` | `2011-11-01` | Seed constant | RN-07 |
| `end_date` | `DATE` | `Mapped[date \| None]` | Yes | None, NULL while active | `NULL` | Seed, NULL | RN-07 |

## meter

Smart meter identified by the F1 `LCLid`, linked to one customer and one transformer.

| Field | Type (PostgreSQL) | ORM | Nullable | Key / Constraint | Example | Source | Used by |
|---|---|---|---|---|---|---|---|
| `id` | `INTEGER` | `Mapped[int] pk` | No | PK `pk_meter` | `1` | Generated | Internal |
| `lclid` | `VARCHAR(20)` | `Mapped[str] unique` | No | Natural key `uq_meter_lclid`, upsert key `DO UPDATE` | `MAC000002` | F1 `LCLid` | RN-01–RN-04, F3 |
| `customer_id` | `INTEGER` | `Mapped[int] FK` | No | FK `fk_meter_customer_id_customer`, indexed | `1` | Resolved from `customer.code` | Billing |
| `transformer_id` | `INTEGER` | `Mapped[int] FK` | No | FK `fk_meter_transformer_id_transformer`, indexed, updated on reassignment | `1` | Seed `network.plan_network` | RN-06 |

## Relationships

- `circuit` 1 → N `transformer`
- `transformer` 1 → N `meter` (50–80 per transformer, enforced by the seed, verified by test)
- `customer` 1 → N `meter` (one per customer in the pilot, not enforced)
- `customer` 1 → N `contract`

## Natural keys and idempotency

Each table has an internal `id` and a unique natural key (`code` or `lclid`). The seed upserts by natural key (`INSERT ... ON CONFLICT`): circuits, transformers, customers and contracts are `DO NOTHING`; meters are `DO UPDATE` on FKs. Same seed always yields the same codes, no `created_at` columns.

## Not in F4

- Meter readings (F1, F3) live in the S3 lake, processed by Spark.
- Tariff bands (F7) are a separate CSV.
- Concentrators are not a table; grouping by concentrator derives from `meter.transformer_id`.

## Traceability

F4, E-03, E-10, CT-06. Supports US-01 AC1–AC4 and RN-05, RN-06, RN-07, RN-08.