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

| Source | Layer | Key prefix | Partition | Files | Written by |
| --- | --- | --- | --- | --- | --- |
| F1 half-hourly readings | raw | `source=f1/dataset=halfhourly/` | `ingest_date` | `block_<n>.csv` (112 Kaggle files, unchanged) | |
| F1 households | raw | `source=f1/dataset=households/` | `ingest_date` | `informations_households.csv` | |
| F2 hourly weather | raw | `source=f2/dataset=weather_hourly/` | `ingest_date` | `weather_hourly_darksky.csv` | |
| F3 concentrator batches | raw | `source=f3/dataset=readings/` | `ingest_date`, `ingest_hour` | `<concentrator>_<sequence, 8 digits>.json` | F3 consumer (US-29) |
| F4 meters | raw | `source=f4/dataset=meters/` | `ingest_date` | `meters.csv` | `jobs.inventory` (US-33) |
| F4 contracts | raw | `source=f4/dataset=contracts/` | `ingest_date` | `contracts.csv` | `jobs.inventory` (US-33) |
| F5 transformer energy | raw | `source=f5/dataset=transformer_energy/` | `ingest_date` | `<transformer>_<from>_<to>.json` | `jobs.fetch_f5` (US-37) |
| F6 temperature forecast | raw | `source=f6/dataset=forecast_hourly/` | `ingest_date` | `forecast_<HHMM>.json` | |
| F7 tariff calendar | raw | `source=f7/dataset=tariffs/` | `ingest_date` | `tariffs.csv` | |
| Readings, clean | clean | `source=readings/dataset=interval_30min/` | `date` | `part-*.snappy.parquet` | `jobs.clean_readings` (US-30) |
| Cleaning run manifests | clean | `source=readings/dataset=interval_30min/_runs/` | none | `<run>.json` | `jobs.clean_readings` (US-30) |
| Readings with gaps filled | clean | `source=readings/dataset=interval_30min_filled/` | `date` | `part-*.snappy.parquet` | `jobs.estimate_gaps` (US-34) |
| Weather, clean | clean | `source=f2/dataset=weather_hourly/` | `date` | `part-*.snappy.parquet` | |
| Circuit load | curated | `dataset=circuit_load/` | `date` | `part-*.snappy.parquet` | `jobs.circuit_load` (US-33) |
| Consumption fact | curated | `dataset=fact_consumption/` | `month` | `part-*.snappy.parquet` | `jobs.fact_consumption` (US-35) |
| Billing status | curated | `dataset=billing_status/` | `month` | `part-*.snappy.parquet` | `jobs.billing` (US-36) |
| Inspection orders | curated | `dataset=inspection_orders/` | `month` | `part-*.snappy.parquet` | `jobs.billing` (US-36) |
| Transformer losses | curated | `dataset=transformer_losses/` | `date` | `part-*.snappy.parquet` | `jobs.transformer_losses` (US-37) |
| Suspicious transformers | curated | `dataset=suspicious_transformers/` | `date` | `part-*.snappy.parquet` | `jobs.transformer_losses` (US-37) |
| Suspicious meters | curated | `dataset=suspicious_meters/` | `date` | `part-*.snappy.parquet` | `jobs.suspicious_meters` (US-38) |
| Dimensions | curated | `dataset=dim_<name>/` | none | `part-*.snappy.parquet` | |

The jobs live in `voltiagrid-data` and all run in the `voltiagrid_readings` DAG (*Airflow* page of that repo).

### Cleaning run manifests

Each run of `jobs.clean_readings` writes one JSON file in `_runs/` next to the clean readings: the run name
(`f3-<ingest date>` or `f1-<mode>-<ingest date>`), the source, the input path, the reading **dates it touched**, the
rows per quality flag and when it finished. The jobs after cleaning take `--run <name>` and process exactly those
dates, so a resend of old readings recalculates only the days it changed. `_runs/` starts with an underscore, so
Spark ignores it when reading the dataset.

New datasets follow the same pattern and are added to this table in the same pull request that writes them.

## Rules

1. **Lowercase, `snake_case`, no spaces or accents** in prefixes and partition names.
2. **Dates in ISO format** (`2026-10-23`, `2026-10`), always UTC.
3. **Raw is append-only.** Nothing rewrites or deletes an object in raw; corrections are new objects. The ingest policy (`datalake-ingest`) has no delete permission.
4. **Every load to raw writes a manifest** `_manifest.json` in its partition: source, files, bytes, start and end time, and who loaded it.
5. **Spark writes clean and curated by partition overwrite** (`partitionOverwriteMode=dynamic`) and leaves `_SUCCESS` when a partition is complete. Readers ignore partitions without `_SUCCESS`.
6. **One format per dataset.** Raw keeps the source format; clean and curated are always Parquet with Snappy.
7. **Target file size 64–256 MB in clean and curated.** Many small files make Spark and Athena slow; jobs repartition before writing. For the pilot one daily partition is a few MB and that is accepted (one file per partition, `repartition("date")` or `repartition("month")`); to revisit at 200,000 meters (US-58).

## Examples

```
s3://voltiagrid-dev-raw-<account id>/source=f1/dataset=halfhourly/ingest_date=2026-10-25/block_0.csv
s3://voltiagrid-dev-raw-<account id>/source=f1/dataset=halfhourly/ingest_date=2026-10-25/_manifest.json
s3://voltiagrid-dev-raw-<account id>/source=f3/dataset=readings/ingest_date=2026-11-02/ingest_hour=14/DC-TR-00001_00000123.json
s3://voltiagrid-dev-raw-<account id>/source=f5/dataset=transformer_energy/ingest_date=2026-11-02/TR-00001_20130105T0000Z_20130106T0000Z.json
s3://voltiagrid-dev-clean-<account id>/source=readings/dataset=interval_30min/date=2013-01-15/part-00000.snappy.parquet
s3://voltiagrid-dev-clean-<account id>/source=readings/dataset=interval_30min/_runs/f3-2026-11-02.json
s3://voltiagrid-dev-clean-<account id>/source=readings/dataset=interval_30min_filled/date=2013-01-15/part-00000.snappy.parquet
s3://voltiagrid-dev-curated-<account id>/dataset=transformer_losses/date=2013-01-15/part-00000.snappy.parquet
s3://voltiagrid-dev-curated-<account id>/dataset=fact_consumption/month=2013-01/part-00000.snappy.parquet
s3://voltiagrid-dev-curated-<account id>/dataset=inspection_orders/month=2013-01/part-00000.snappy.parquet
```
