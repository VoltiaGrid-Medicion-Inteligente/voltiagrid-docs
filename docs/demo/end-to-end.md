---
title: End-to-end demo script
sidebar_position: 1
---

# End-to-end demo script (US-65, KAN-337 and KAN-338)

> Rehearsed on 9 November 2026 with the local stack (`voltiagrid-api`, `voltiagrid-data` and the portal) and the
> lake in `voltiagrid-api/lake`. Steps 1 and 3 to 8 were run and their real outputs are in this page; step 2 is
> the broker console view of the same messages. Step 9 (Power BI) is pending of María Muñoz's model (KAN-327).
> For KAN-338, each layer owner confirms their query and signs the Owner column in the pull request.

The demo follows one reading of meter `MAC000002` from the simulator to the dashboard: the interval
2013-01-01 00:00 UTC. The meter belongs to customer `CU-MAC000002`, the demo account of the portal. Write the
meter, the interval and the ingest date on the board; every query filters by them.

| Variable | Value in the rehearsal |
| --- | --- |
| `$meter` | `MAC000002` |
| `$ingest` | `2026-11-09`: the UTC date when the consumer stored the message, the `ingest_date=` folder. After 19:00 in Bogotá it is already the next day. |
| `$lake` | `C:\Users\<user>\...\VoltaGrid\voltiagrid-api\lake` |
| Interval | 2013-01-01 00:00 (the first interval the simulator sends with the default `SIM_START`) |
| Expected value | 0.043 kWh, `ok`, real reading (seed 42) |

Set the variables at the start of the session:

```powershell
$meter  = "MAC000002"
$ingest = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
$lake   = "C:\Users\<user>\...\VoltaGrid\voltiagrid-api\lake"
```

`$ingest` must match the folder the consumer creates. Check it after step 1 and update it if the UTC date changed
in the middle of the demo.

## What to say about the API and the portal

The customer API does not read the lake. It computes each reading with the same model and the same seed as the
F3 simulator (`half_hour_kwh`, `SIM_SEED=42`; see the docstring of
`app/api/customer_consumption/service.py`). For a real reading it returns the same kWh that the pipeline stores,
and the days the simulator leaves silent (the missing-day defect) are the days RN-03 fills by profile, so all
their readings count as estimated.

Say this if someone asks: it is a design decision, not a shortcut. The lake path ends in curated and Power BI.
The API and the portal show the same number from the same source model.

The API always returns the 48 half hours of the day. In the rehearsal the API marked all of them as
`estimated: false` for 2013-01-01, so the portal says "Sin lecturas estimadas". The filled layer of the lake is
where the estimated rows appear: `MAC000002` had 44 real intervals and 4 interpolated (04:00, 11:00, 16:30 and
19:00). That difference is the moment to explain RN-03: the API serves the model, the lake records what was
actually received and estimated.

## 0. Before the demo

From `voltiagrid-api`, start the database, the broker, the consumer, F5 and the APIs. The consumer writes to
`lake/` of this repository:

```powershell
make up
```

The equivalent without GNU make is `docker compose up -d --build`.

Stop the simulator service so step 1 publishes on purpose:

```powershell
docker compose stop f3-simulator
```

The stack's simulator publishes the first tick when it starts, and the consumer remembers those `message_id`
values in memory. Restart the consumer before step 1 so the explicit tick is stored instead of deduplicated:

```powershell
docker compose restart f3-consumer
```

From `voltiagrid-data/airflow`, start the scheduler, the Celery workers and Flower only if steps 4 to 6 run as
the DAG:

```powershell
docker compose up -d
```

From `voltiagrid-portal`, start the portal:

```powershell
npm run dev
```

Open:

- RabbitMQ console: http://localhost:15672
- Airflow: http://localhost:8080
- Portal: http://localhost:5173

## Steps, layer by layer

Run the commands from `voltiagrid-data` with the virtual environment active. The Owner column is a proposal
taken from [Likely questions per flow](./likely-questions.md); each owner confirms their query in the pull
request before KAN-338 closes.

| # | Layer | What the audience sees | Command | Owner |
| --- | --- | --- | --- | --- |
| 1 | Source | The F3 concentrators publish one message per transformer | In `voltiagrid-api`: `docker compose run --rm --no-deps f3-simulator python -m simulators.concentrator --ticks 1 --tick-seconds 0` | Carlos Aponte (pending) |
| 2 | Broker | `readings.live` receives the messages and the consumer drains them | RabbitMQ console, queue `readings.live` | Carlos Aponte (pending) |
| 3 | Raw | The message is stored as received, one JSON file | Query R | Carlos Aponte (pending) |
| 4 | Clean | The reading is cleaned, deduplicated and flagged | `python -m jobs.clean_readings --source f3 --ingest-date $ingest --lake $lake` and query C | Carlos Aponte (pending) |
| 5 | Filled | The day of the meter has its 48 intervals, real or estimated | `python -m jobs.estimate_gaps --run f3-$ingest --lake $lake` and query F | Carlos Aponte (pending) |
| 6 | Curated | The reading is in the interval fact, with customer, transformer, band and cost | `python -m jobs.fact_consumption_interval --run f3-$ingest --lake $lake` and query K | María Muñoz (pending) |
| 7 | API | The customer API returns the interval | `GET /me/consumption/intervals?date=2013-01-01` with the token of the demo customer | Sharon Meriño (pending) |
| 8 | Portal | The day's curve shows the interval | Demo customer, Mi consumo, month 2013-01, row 2013-01-01, Ver curva | Sharon Meriño (pending) |
| 9 | Power BI | The dashboard shows the same kWh after refresh | Refresh the model that reads `curated/dataset=fact_consumption_interval` (not run yet: KAN-327) | María Muñoz (pending) |

Steps 4 and 5 can also run as one run of the `voltiagrid_readings` DAG, which is what the daily close does:
*Trigger DAG w/ config* with `{"date": "$ingest"}`. The DAG does not build the interval fact of step 6; run that
job separately.

With a single tick on a fresh lake, only the first interval exists when `estimate_gaps` runs, so the other 47
intervals of the day are `unavailable`: there is no history to estimate from. The rehearsal used the lake that
already had readings for 2013-01-01, so the day was complete (44 real and 4 interpolated) and the job reported
`unavailable 445` for other meters of the dataset. Both outcomes are a good moment to explain RN-03.

To show a full day from scratch, publish with `--ticks 48`.

## Verification queries (KAN-338)

### R. Raw (step 3)

`ConvertFrom-Json -DateKind String` keeps the ISO timestamps as text: without it, PowerShell 7 converts them to
`[datetime]` and the equality against `2013-01-01T00:00:00Z` fails.

```powershell
Get-ChildItem "$lake\raw\source=f3\dataset=readings\ingest_date=$ingest" -Recurse -Filter *.json | ForEach-Object {
  $file = $_.FullName.Replace("$lake\raw\source=f3\dataset=readings\ingest_date=$ingest\", "")
  $msg  = Get-Content $_.FullName -Raw | ConvertFrom-Json -DateKind String
  $msg.readings | Where-Object {
    $_.meter_id -eq $meter -and $_.interval_start -eq "2013-01-01T00:00:00Z"
  } | ForEach-Object {
    [pscustomobject]@{
      File     = $file
      Meter    = $_.meter_id
      Interval = $_.interval_start
      Kwh      = $_.energy_kwh.ToString("0.###")
      Seq      = $_.reading_seq
    }
  }
} | Sort-Object File | Format-Table -AutoSize
```

The consumer stores each message under the UTC hour it was received, so the same reading can appear under two
`ingest_hour=` folders after a resend. Clean deduplicates in two passes: exact copies by meter, source, original
timestamp, sequence and value; then, per meter and interval, the highest sequence wins (RN-02).

### C. Clean (step 4), F. Filled (step 5) and K. Curated (step 6)

The queries use PySpark because it is already a dependency of the jobs and the virtual environment does not need
extra packages. Save this helper once (it is not part of the repository):

```python
"""Print the rows of one meter from a parquet date partition."""

import sys

from pyspark.sql import SparkSession, functions as F

path, meter, columns = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
spark = SparkSession.builder.master("local[2]").appName("check-reading").getOrCreate()
spark.sparkContext.setLogLevel("ERROR")
(spark.read.parquet(path)
      .filter(F.col("meter_id") == meter)
      .orderBy("interval_start")
      .select(*columns)
      .show(6, truncate=False))
spark.stop()
```

Save it as `$env:TEMP\check-reading.py`. It needs Java 17, the same requirement as the jobs.

```powershell
$helper = "$env:TEMP\check-reading.py"

python $helper "$lake\clean\source=readings\dataset=interval_30min\date=2013-01-01" $meter "interval_start,energy_kwh,is_valid,quality_flag"
python $helper "$lake\clean\source=readings\dataset=interval_30min_filled\date=2013-01-01" $meter "interval_start,energy_kwh,is_estimated,estimation_method"
python $helper "$lake\curated\dataset=fact_consumption_interval\date=2013-01-01" $meter "interval_start,customer_code,transformer_code,band_name,energy_kwh,energy_cost,is_estimated,estimation_method"
```

### A. API (step 7)

Read the demo password from the API `.env` so it is not written in the script, and request a token:

```powershell
$env:DEMO_CUSTOMER_PASSWORD = (
  Get-Content "..\voltiagrid-api\.env" |
    Where-Object { $_ -match '^\s*DEMO_CUSTOMER_PASSWORD=' } |
    Select-Object -First 1
) -replace '^\s*DEMO_CUSTOMER_PASSWORD=', ''

$body  = @{ username = "CU-MAC000002"; password = $env:DEMO_CUSTOMER_PASSWORD } | ConvertTo-Json
$token = (Invoke-RestMethod -Method Post -Uri "http://localhost:8001/auth/token" -ContentType "application/json" -Body $body).access_token
$response = Invoke-RestMethod -Headers @{ Authorization = "Bearer $token" } -Uri "http://localhost:8001/me/consumption/intervals?date=2013-01-01"

$response.intervals | Select-Object -First 3 | Format-Table start, band_name, energy_kwh, estimated -AutoSize
```

## What each query returned on 9 November 2026

Step 1 published `4 messages` with `197 readings` for the interval; `200` were expected and the rest are the
simulator's defects (`missing_day 4`, `gap 3`, `null 1`, `out_of_bounds 3`, `offset_clock 3`, `duplicate 4`).

| Query | Result for MAC000002, 2013-01-01 00:00 | Status |
| --- | --- | --- |
| R. Raw | `DC-TR-00000_00000001.json` under `ingest_hour=01` and `ingest_hour=20`: `"meter_id": "MAC000002"`, `energy_kwh` 0.043, `reading_seq` 1 | Confirmed |
| C. Clean | 0.043, `is_valid` true, `quality_flag` `ok`. Job: 37,047 rows in 5 dates; `ok 35083`, `out_of_range 363`, `negative 357`, `null_value 720`, `invalid_clock 524` | Confirmed |
| F. Filled | 0.043, `is_estimated` false, `estimation_method` null. The day had 44 real intervals and 4 interpolated (04:00, 11:00, 16:30, 19:00). Job: 38,208 rows; `interpolation 2680`, `unavailable 445` | Confirmed |
| K. Curated | `customer_code` `CU-MAC000002`, `transformer_code` `TR-00000`, band `off-peak`, 0.043 kWh, `energy_cost` 0.0052, `is_estimated` 0, `estimation_method` `none`. Job: 38,208 rows, 200 meters, 4,110.5 kWh, cost 830.93, 3,125 estimated, no orphan keys | Confirmed |
| A. API | 48 intervals, `estimated false` in all of them: 0.043 kWh, `off-peak` at 00:00 (0.042 at 00:30) | Confirmed |
| Portal | The curve of 2013-01-01 starts at 0.043 kWh and shows "Sin lecturas estimadas" | Confirmed |
| Power BI | The same 0.043 kWh after the model refresh | Pending KAN-327 |

## Losses: show the detection with the injection scenario (US-62)

January 2013 has no losses to detect: the F5 simulator delivers exactly what the meters consume, so the *Losses per
transformer* page shows about −0.6% in the month and no suspicious transformer. The small negative loss comes from the
estimated readings, which add a little energy. To show that detection works, run the scenario of
*Data → Loss-injection scenario* (KAN-331/332) live. It injects 15% in F5 for `TR-00001` on 2013-01-02 to 2013-01-04.

From `voltiagrid-data`, with F5 running (`docker compose up -d api-transformer-metering` in `voltiagrid-api`):

```powershell
python -m jobs.loss_injection_scenario --lake ..\voltiagrid-api\lake --from 2013-01-02 --days 3 --transformers TR-00001 --loss-pct 0.15
```

Expected last line: `loss-injection: TR-00001 suspicious on the last day, their meters evaluated`.

The scenario rewrites F5 raw, `transformer_losses` and `suspicious_meters` of those three days in the lake. It removes
the injection when it ends, also when a step fails. Afterwards, re-run the normal jobs for the three days, so the
dashboard keeps the real January:

```powershell
python -m jobs.fetch_f5 --date 2013-01-02 --date 2013-01-03 --date 2013-01-04 --lake ..\voltiagrid-api\lake
```

```powershell
python -m jobs.transformer_losses --date 2013-01-02 --date 2013-01-03 --date 2013-01-04 --lake ..\voltiagrid-api\lake
```

```powershell
python -m jobs.suspicious_meters --date 2013-01-02 --date 2013-01-03 --date 2013-01-04 --lake ..\voltiagrid-api\lake
```

```powershell
python -m jobs.fact_transformer_loss --date 2013-01-02 --date 2013-01-03 --date 2013-01-04 --lake ..\voltiagrid-api\lake
```

This sequence has not been rehearsed with the January data yet. Rehearse it once before the demo, and check that the
*Losses per transformer* page still shows −190.54 kWh for the month after refreshing.

## If something fails live

- A task of the DAG fails: runbook, section 4 (Recover a failed DAG). Plan B: run steps 4 to 6 as the three
  commands above.
- The portal does not load: show step 7 with the API call and its response.
- An API deployment fails in AWS: the demo failure of KAN-335. ECS's circuit breaker rolls the service back, and
  `rollback.ps1` recovers in about 3 minutes.
