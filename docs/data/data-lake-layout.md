---
title: Data lake layout
sidebar_position: 4
---

# Data lake layout: paths and partitions (T-23.4)

> Applies to every job and script that writes to the lake (ADR-003). Buckets and access: `infra/docs/DATA-LAKE.md` in `voltiagrid-api`.

## Buckets

One bucket per layer and environment:

```
voltiagrid-<env>-<layer>-<account id>
```

| Layer   | Example (dev)                         | Content                                              | Format                  |
| ------- | ------------------------------------- | ---------------------------------------------------- | ----------------------- |
| raw     | `voltiagrid-dev-raw-<account id>`     | What each source sent, byte for byte                 | As received (CSV, JSON) |
| clean   | `voltiagrid-dev-clean-<account id>`   | Validated, deduplicated, estimated, with tariff band | Parquet (Snappy)        |
| curated | `voltiagrid-dev-curated-<account id>` | Facts and dimensions for Power BI and the APIs       | Parquet (Snappy)        |

## Key format

Every object key follows the same pattern, with **Hive-style partitions** (`name=value`) so Spark and Athena discover them without configuration:

```
source=<source>/dataset=<dataset>/<partition 1>=<value>/[<partition 2>=<value>/]<file>
```

| Layer   | Partitions                                                                                | Meaning                                                                                                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| raw     | `ingest_date=YYYY-MM-DD` (and `ingest_hour=HH` for streams)                               | UTC date (and hour) when the object was **written to the lake**. It never depends on the content, so a resend of old readings lands in today's partition and nothing is overwritten (ADR-007). |
| clean   | `date=YYYY-MM-DD`                                                                         | UTC date of the **reading or event**. Spark reads raw by ingest date and writes clean by reading date.                                                                                         |
| curated | `month=YYYY-MM` for monthly facts, `date=YYYY-MM-DD` for daily facts, none for dimensions | Period the row describes.                                                                                                                                                                      |

## Datasets

| Source                  | Layer   | Key prefix                                | Partition                    | Files                                          |
| ----------------------- | ------- | ----------------------------------------- | ---------------------------- | ---------------------------------------------- |
| F1 half-hourly readings | raw     | `source=f1/dataset=halfhourly/`           | `ingest_date`                | `block_<n>.csv` (112 Kaggle files, unchanged)  |
| F1 households           | raw     | `source=f1/dataset=households/`           | `ingest_date`                | `informations_households.csv`                  |
| F2 hourly weather       | raw     | `source=f2/dataset=weather_hourly/`       | `ingest_date`                | `weather_hourly_darksky.csv`                   |
| F3 concentrator batches | raw     | `source=f3/dataset=readings/`             | `ingest_date`, `ingest_hour` | `<concentrator>_<batch sequence>.json` (US-29) |
| F5 transformer energy   | raw     | `source=f5/dataset=transformer_energy/`   | `ingest_date`                | `<transformer>_<from>_<to>.json`               |
| F6 temperature forecast | raw     | `source=f6/dataset=forecast_hourly/`      | `ingest_date`                | `forecast_<HHMM>.json`                         |
| F7 tariff calendar      | raw     | `source=f7/dataset=tariffs/`              | `ingest_date`                | `tariffs.csv`                                  |
| Readings, clean         | clean   | `source=readings/dataset=interval_30min/` | `date`                       | `part-*.snappy.parquet`                        |
| Weather, clean          | clean   | `source=f2/dataset=weather_hourly/`       | `date`                       | `part-*.snappy.parquet`                        |
| Consumption fact        | curated | `dataset=fact_consumption/`               | `month`                      | `part-*.snappy.parquet`                        |
| Dimensions              | curated | `dataset=dim_<name>/`                     | none                         | `part-*.snappy.parquet`                        |

New datasets follow the same pattern and are added to this table in the same pull request that writes them.

## Rules

1. **Lowercase, `snake_case`, no spaces or accents** in prefixes and partition names.
2. **Dates in ISO format** (`2026-10-23`, `2026-10`), always UTC.
3. **Raw is append-only.** Nothing rewrites or deletes an object in raw; corrections are new objects. The ingest policy (`datalake-ingest`) has no delete permission.
4. **Every load to raw writes a manifest** `_manifest.json` in its partition: source, files, bytes, start and end time, and who loaded it.
5. **Spark writes clean and curated by partition overwrite** (`partitionOverwriteMode=dynamic`) and leaves `_SUCCESS` when a partition is complete. Readers ignore partitions without `_SUCCESS`.
6. **One format per dataset.** Raw keeps the source format; clean and curated are always Parquet with Snappy.
7. **Target file size 64–256 MB in clean and curated.** Many small files make Spark and Athena slow; jobs repartition before writing.

## Examples

```
s3://voltiagrid-dev-raw-<account id>/source=f1/dataset=halfhourly/ingest_date=2026-10-25/block_0.csv
s3://voltiagrid-dev-raw-<account id>/source=f1/dataset=halfhourly/ingest_date=2026-10-25/_manifest.json
s3://voltiagrid-dev-raw-<account id>/source=f3/dataset=readings/ingest_date=2026-11-02/ingest_hour=14/CT-000_000123.json
s3://voltiagrid-dev-clean-<account id>/source=readings/dataset=interval_30min/date=2013-01-15/part-00000.snappy.parquet
s3://voltiagrid-dev-curated-<account id>/dataset=fact_consumption/month=2013-01/part-00000.snappy.parquet
```
