---
title: Analytics dictionary (lake)
sidebar_position: 1
---

# Analytics dictionary (lake)

The operational dictionary covers F4, the inventory database. This page covers what the pipeline writes to the
lake: the clean layer, the curated tables of the daily close, and the facts and dimensions Power BI reads.
Every dataset is Parquet (Snappy) under `<layer>/dataset=<name>/`, partitioned as shown. Types and examples come
from the lake; datasets marked *schema from the job* had no rows in the lake used to write this page.

| Dataset | Layer | Partition | Grain | Written by | Story |
|---|---|---|---|---|---|
| [`interval_30min`](#interval_30min) | `clean/source=readings` | `date` | one reading per meter and 30-minute interval, plus the readings with an invalid clock | `jobs.clean_readings` | US-30 |
| [`interval_30min_filled`](#interval_30min_filled) | `clean/source=readings` | `date` | exactly 48 rows per meter and day: the real reading or an estimate | `jobs.estimate_gaps` | US-34, RN-03 |
| [`circuit_load`](#circuit_load) | `curated` | `date` | one circuit in one 30-minute interval | `jobs.circuit_load` | US-33 |
| [`transformer_losses`](#transformer_losses) | `curated` | `date` | one transformer on one day | `jobs.transformer_losses` | US-37, RN-06 |
| [`suspicious_transformers`](#suspicious_transformers) | `curated` | `date` | one suspicious transformer on one day | `jobs.transformer_losses` | US-37, RN-06 |
| [`suspicious_meters`](#suspicious_meters) | `curated` | `date` | one meter of a suspicious transformer, evaluated on one day | `jobs.suspicious_meters` | US-38, RN-07 |
| [`fact_consumption`](#fact_consumption) | `curated` | `month` | one customer, month, tariff band and tariff period | `jobs.fact_consumption` | US-35 |
| [`fact_consumption_interval`](#fact_consumption_interval) | `curated` | `date` | one meter in one 30-minute interval | `jobs.fact_consumption_interval` | US-48 |
| [`billing_status`](#billing_status) | `curated` | `month` | one customer in one month | `jobs.billing` | US-36, RN-04 |
| [`inspection_orders`](#inspection_orders) | `curated` | `month` | one customer that cannot be billed automatically, in one month | `jobs.billing` | US-36, RN-04 |
| [`fact_transformer_loss_daily`](#fact_transformer_loss_daily) | `curated` | `date` | one transformer on one day, valued in money | `jobs.fact_transformer_loss` | US-51, RN-06 |
| [`fact_load_weather_hourly`](#fact_load_weather_hourly) | `curated` | `date` | one transformer in one hour | `jobs.fact_load_weather (PR data #78)` | US-53 (question 5) |
| [`quarterly_report_transformers`](#quarterly_report_transformers) | `curated` | `quarter` | one transformer in one quarter | `jobs.quarterly_report` | US-54 |
| [`dr_events`](#dr_events) | `curated` | `date` | one demand-response event | `jobs.dr_events` | US-43, RN-08 |
| [`dr_participants`](#dr_participants) | `curated` | `date` | one customer meter taking part in one event | `jobs.dr_events` | US-43, RN-10 |
| [`dr_notifications`](#dr_notifications) | `curated` | `date` | one notification of one event to one customer | `jobs.dr_events` | US-43 |
| [`dr_settlement`](#dr_settlement) | `curated` | `date` | one customer in one event, with baseline, saving and incentive | `jobs.dr_settlement` | US-44, RN-09 |
| [`fact_dr_participation`](#fact_dr_participation) | `curated` | `date` | one customer in one demand-response event | `jobs.fact_dr_participation` | US-45 |
| [`dim_date`](#dim_date) | `curated` | `-` | one day | `jobs.dimensions` | US-52 |
| [`dim_month`](#dim_month) | `curated` | `-` | one calendar month | `jobs.dimensions` | US-52 |
| [`dim_time_of_day`](#dim_time_of_day) | `curated` | `-` | one of the 48 half hours of a day | `jobs.dimensions` | US-52 |
| [`dim_tariff_band`](#dim_tariff_band) | `curated` | `-` | one version of one F7 tariff band | `jobs.dimensions` | US-52 |
| [`dim_customer`](#dim_customer) | `curated` | `-` | one contract version of one customer (type 2) | `jobs.dimensions` | US-52 |
| [`dim_meter`](#dim_meter) | `curated` | `-` | one meter | `jobs.dimensions` | US-52 |
| [`dim_transformer`](#dim_transformer) | `curated` | `-` | one transformer with its circuit | `jobs.dimensions` | US-52 |
| [`dim_dr_event`](#dim_dr_event) | `curated` | `-` | one demand-response event | `jobs.dimensions` | US-52 |

## interval_30min

**Grain:** one reading per meter and 30-minute interval, plus the readings with an invalid clock. **Written by:** `jobs.clean_readings` (US-30). **Reads:** raw F1 / F3 readings.

| Field | Type | Description | Example |
|---|---|---|---|
| `meter_id` | `string` | Meter code (the F1 `LCLid`, the same in F4), e.g. `MAC000002`. | `MAC000002` |
| `interval_start` | `timestamp[us]` | Start of the 30-minute interval (UTC, stored without time zone). | `2013-01-30 00:00:00` |
| `energy_kwh` | `double` | kWh of the interval as read; null when the value was missing or could not be parsed. | `0.038` |
| `is_valid` | `bool` | True when the reading passed every check (`quality_flag = ok`). | `True` |
| `quality_flag` | `string` | `ok`, `null_value`, `negative`, `out_of_range` or `invalid_clock` (US-30). | `ok` |
| `original_ts` | `timestamp[us]` | Timestamp as the source sent it, before the clock correction (T-30.2). | `2013-01-30 00:00:00` |
| `energy_text` | `string` | Raw value as text, kept to audit parsing errors. | `0.038` |
| `seq` | `int64` | Sequence number of the reading at the source; among duplicates the highest one wins (T-30.3). | `95381` |
| `date` | partition | Day of the row; the partition folder of the dataset. | |

## interval_30min_filled

**Grain:** exactly 48 rows per meter and day: the real reading or an estimate. **Written by:** `jobs.estimate_gaps` (US-34, RN-03). **Reads:** interval_30min.

| Field | Type | Description | Example |
|---|---|---|---|
| `meter_id` | `string` | Meter code (the F1 `LCLid`, the same in F4), e.g. `MAC000002`. | `MAC000002` |
| `interval_start` | `timestamp[us]` | Start of the 30-minute interval (UTC, stored without time zone). | `2013-01-03 00:00:00` |
| `energy_kwh` | `double` | kWh of the interval: the real reading, or the estimate when `is_estimated`; null when `unavailable`. | `0.039` |
| `is_estimated` | `bool` | True (1) when the value is an estimate, not a reading. | `False` |
| `estimation_method` | `string` | `null` for a real reading; `interpolation` (gap of 2 h or less), `profile` (same weekday of the last 4 weeks) or `unavailable` (no history, energy null) (RN-03). | `null` |
| `quality_flag` | `string` | Flag of the clean reading, or `missing` when there was no row at all. | `ok` |
| `date` | partition | Day of the row; the partition folder of the dataset. | |

## circuit_load

**Grain:** one circuit in one 30-minute interval. **Written by:** `jobs.circuit_load` (US-33). **Reads:** interval_30min, raw F4 meters.

| Field | Type | Description | Example |
|---|---|---|---|
| `circuit_code` | `string` | Circuit code from F4 (`CT-XXX`). | `CT-000` |
| `interval_start` | `timestamp[us]` | Start of the 30-minute interval (UTC, stored without time zone). | `2013-01-03 17:00:00` |
| `energy_kwh` | `double` | kWh of the circuit's meters in the interval (valid clean readings). | `28.27400000000001` |
| `load_kw` | `double` | Average power of the interval: `energy_kwh × 2`. | `56.54800000000002` |
| `capacity_kva` | `double` | Capacity of the circuit (F4). | `2100.12` |
| `load_pct` | `double` | `load_kw / capacity_kva` (power factor 1). | `0.0269` |
| `is_overloaded` | `bool` | True above 85% (US-33; the same threshold starts an event in RN-08). | `False` |
| `meters_reporting` | `int64` | Meters of the circuit with a valid reading in the interval. | `187` |
| `meters_total` | `int64` | Meters of the circuit in F4. | `200` |
| `date` | partition | Day of the row; the partition folder of the dataset. | |

## transformer_losses

**Grain:** one transformer on one day. **Written by:** `jobs.transformer_losses` (US-37, RN-06). **Reads:** raw F5, interval_30min_filled, raw F4 meters.

| Field | Type | Description | Example |
|---|---|---|---|
| `transformer_code` | `string` | Transformer code from F4 (`TR-XXXXX`). | `TR-00000` |
| `delivered_kwh` | `double` | Energy delivered to the transformer that day (F5), over the half hours present in both F5 and the meters. | `338.689` |
| `metered_kwh` | `double` | Energy of the transformer's meters in the same intervals (filled readings: real + estimated). | `338.613` |
| `loss_kwh` | `double` | `delivered_kwh − metered_kwh` (RN-06); negative when the meters add up to more than F5. | `0.076` |
| `loss_pct` | `double` | `loss_kwh / delivered_kwh`. | `0.0002` |
| `estimated_kwh` | `double` | Part of the meters' energy that comes from estimates. | `26.231` |
| `intervals` | `int64` | Half hours present in both F5 and the meters. | `48` |
| `meters` | `int64` | Distinct meters of the transformer counted. | `70` |
| `date` | partition | Day of the row; the partition folder of the dataset. | |

## suspicious_transformers

**Grain:** one suspicious transformer on one day. **Written by:** `jobs.transformer_losses` (US-37, RN-06). **Reads:** transformer_losses.

*Schema from the job.*

| Field | Type | Description |
|---|---|---|
| `transformer_code` | `string` | Transformer code from F4 (`TR-XXXXX`). |
| `rank` | `int32` | 1 = most energy lost during the streak, among the suspicious transformers of the day. |
| `streak_days` | `int64` | Consecutive days above 12% up to this day (3 or more, RN-06). |
| `streak_start` | `date` | First day of the streak. |
| `streak_loss_kwh` | `double` | kWh lost along the streak. |
| `loss_pct` | `double` | `loss_kwh / delivered_kwh`. |
| `loss_kwh` | `double` | `delivered_kwh − metered_kwh` (RN-06); negative when the meters add up to more than F5. |
| `delivered_kwh` | `double` | Energy delivered to the transformer (F5). |
| `metered_kwh` | `double` | Energy of the transformer's meters in the same intervals (filled readings: real + estimated). |
| `date` | partition | Day of the row; the partition folder of the dataset. |

## suspicious_meters

**Grain:** one meter of a suspicious transformer, evaluated on one day. **Written by:** `jobs.suspicious_meters` (US-38, RN-07). **Reads:** suspicious_transformers, interval_30min_filled, raw F4.

*Schema from the job.*

| Field | Type | Description |
|---|---|---|
| `meter_id` | `string` | Meter code (the F1 `LCLid`, the same in F4), e.g. `MAC000002`. |
| `transformer_code` | `string` | Transformer code from F4 (`TR-XXXXX`). |
| `customer_code` | `string` | Customer code from F4 (`CU-<LCLid>`). |
| `zero_streak_intervals` | `int64` | Longest run of real readings of 0 kWh in the day and the two days before. |
| `avg_daily_kwh_8w` | `double` | Average daily kWh in the 8 weeks before the last week. |
| `baseline_days` | `int64` | Days with data in that 8-week baseline. |
| `avg_daily_kwh_last_week` | `double` | Average daily kWh of the last 7 days. |
| `drop_pct` | `double` | `1 − last week / 8 weeks`; null with fewer than 28 baseline days or a zero baseline. |
| `contract_changed` | `bool` | True when the customer's contract started or ended in the period (it explains a drop). |
| `zero_48h` | `bool` | True with 96 or more consecutive readings of 0 kWh (48 hours). |
| `drop_60` | `bool` | True when `drop_pct` is above 60% and the contract did not change. |
| `is_suspicious` | `bool` | `zero_48h` or `drop_60` (RN-07). |
| `reason` | `string` | Why the row was flagged; null when it was not. |
| `date` | partition | Day of the row; the partition folder of the dataset. |

## fact_consumption

**Grain:** one customer, month, tariff band and tariff period. **Written by:** `jobs.fact_consumption` (US-35). **Reads:** interval_30min_filled, raw F4 meters, F7.

| Field | Type | Description | Example |
|---|---|---|---|
| `customer_code` | `string` | Customer code from F4 (`CU-<LCLid>`). | `CU-MAC000004` |
| `band_name` | `string` | F7 tariff band of the interval or row. | `intermediate` |
| `tariff_valid_from` | `date32[day]` | First day of the F7 price version applied; a month is split when the tariff changes (US-35). | `2012-01-01` |
| `price_per_kwh` | `decimal128(10, 4)` | F7 price per kWh of the band in that version. | `0.1800` |
| `energy_kwh` | `double` | kWh of the customer in that month, band and tariff period (real + estimated). | `1.958` |
| `estimated_kwh` | `double` | Part of `energy_kwh` that comes from estimates. | `0.209` |
| `intervals` | `int64` | Half hours counted. | `20` |
| `estimated_intervals` | `int64` | Half hours counted that are estimates. | `2` |
| `amount` | `decimal128(12, 2)` | `energy_kwh × price_per_kwh`. | `0.35` |
| `month` | partition | Calendar month (1-12); as a partition, `YYYY-MM`. | |

## fact_consumption_interval

**Grain:** one meter in one 30-minute interval. **Written by:** `jobs.fact_consumption_interval` (US-48). **Reads:** interval_30min_filled, raw F4 meters, F7.

*Schema from the job.*

| Field | Type | Description |
|---|---|---|
| `date_key` | `int32` | Day as `yyyymmdd`, key of `dim_date`. |
| `time_key` | `int32` | Half hour of the day, 0 (00:00) to 47 (23:30), key of `dim_time_of_day`. |
| `meter_id` | `string` | Meter code (the F1 `LCLid`, the same in F4), e.g. `MAC000002`. |
| `customer_code` | `string` | Customer code from F4 (`CU-<LCLid>`). |
| `transformer_code` | `string` | Transformer code from F4 (`TR-XXXXX`). |
| `band_name` | `string` | F7 tariff band of the interval or row. |
| `tariff_valid_from` | `date` | First day of the F7 price version applied; a month is split when the tariff changes (US-35). |
| `interval_start` | `timestamp` | Start of the 30-minute interval (UTC, stored without time zone). |
| `energy_kwh` | `double` | kWh of the meter in the interval (real or estimated). |
| `energy_cost` | `double` | `energy_kwh ×` F7 price of its band on that date. |
| `is_estimated` | `int32` | True (1) when the value is an estimate, not a reading. |
| `estimation_method` | `string` | `null` for a real reading; `interpolation` (gap of 2 h or less), `profile` (same weekday of the last 4 weeks) or `unavailable` (no history, energy null) (RN-03). |
| `date` | partition | Day of the row; the partition folder of the dataset. |

## billing_status

**Grain:** one customer in one month. **Written by:** `jobs.billing` (US-36, RN-04). **Reads:** fact_consumption.

| Field | Type | Description | Example |
|---|---|---|---|
| `customer_code` | `string` | Customer code from F4 (`CU-<LCLid>`). | `CU-MAC000052` |
| `intervals` | `int64` | Half hours counted. | `96` |
| `estimated_intervals` | `int64` | Half hours counted that are estimates. | `7` |
| `estimated_pct` | `double` | `estimated_intervals / intervals`. | `0.0729` |
| `inspection_order` | `bool` | True when the customer got an inspection order (not billable). | `False` |
| `is_billable` | `bool` | True when `estimated_pct` is 10% or less (RN-04). | `True` |
| `month` | partition | Calendar month (1-12); as a partition, `YYYY-MM`. | |

## inspection_orders

**Grain:** one customer that cannot be billed automatically, in one month. **Written by:** `jobs.billing` (US-36, RN-04). **Reads:** fact_consumption.

| Field | Type | Description | Example |
|---|---|---|---|
| `order_id` | `string` | Identifier of the inspection order. | `IO-2013-01-CU-MAC000146` |
| `customer_code` | `string` | Customer code from F4 (`CU-<LCLid>`). | `CU-MAC000146` |
| `estimated_pct` | `double` | `estimated_intervals / intervals`. | `0.5417` |
| `estimated_intervals` | `int64` | Half hours counted that are estimates. | `52` |
| `intervals` | `int64` | Half hours counted. | `96` |
| `reason` | `string` | Why the customer cannot be billed automatically (RN-04). | `estimated readings above 10% o` |
| `created_at` | `timestamp[us]` | When the order was created. | `2026-11-09 11:52:06` |
| `month` | partition | Calendar month (1-12); as a partition, `YYYY-MM`. | |

## fact_transformer_loss_daily

**Grain:** one transformer on one day, valued in money. **Written by:** `jobs.fact_transformer_loss` (US-51, RN-06). **Reads:** transformer_losses, suspicious_transformers, raw F5, F7.

| Field | Type | Description | Example |
|---|---|---|---|
| `date_key` | `int32` | Day as `yyyymmdd`, key of `dim_date`. | `20130103` |
| `transformer_code` | `string` | Transformer code from F4 (`TR-XXXXX`). | `TR-00000` |
| `circuit_code` | `string` | Circuit code from F4 (`CT-XXX`). | `CT-000` |
| `delivered_kwh` | `double` | Energy delivered to the transformer (F5). | `338.689` |
| `metered_kwh` | `double` | Energy of the transformer's meters in the same intervals (filled readings: real + estimated). | `338.613` |
| `estimated_kwh` | `double` | Part of the meters' energy that comes from estimates. | `26.231` |
| `loss_kwh` | `double` | `delivered_kwh − metered_kwh` (RN-06); negative when the meters add up to more than F5. | `0.076` |
| `loss_pct` | `double` | `loss_kwh / delivered_kwh`. | `0.0002` |
| `loss_cost` | `decimal128(12, 2)` | Loss of each half hour valued at the F7 price of its band, added up per day (T-51.2). | `0.05` |
| `consecutive_days_over_12` | `int32` | Days in a row up to this one with a loss above 12%; a missing day breaks the count. | `0` |
| `is_suspicious` | `int32` | 1 when the transformer is suspicious that day (RN-06). | `0` |
| `suspicious_rank` | `int32` | Rank among the suspicious transformers of the day; null when it is not suspicious. | `null` |
| `date` | partition | Day of the row; the partition folder of the dataset. | |

## fact_load_weather_hourly

**Grain:** one transformer in one hour. **Written by:** `jobs.fact_load_weather (PR data #78)` (US-53 (question 5)). **Reads:** raw F5, raw F2, raw F4 meters.

| Field | Type | Description | Example |
|---|---|---|---|
| `date_key` | `int32` | Day as `yyyymmdd`, key of `dim_date`. | `20130103` |
| `hour` | `int32` | Hour of the day, 0-23. | `2` |
| `transformer_code` | `string` | Transformer code from F4 (`TR-XXXXX`). | `TR-00001` |
| `circuit_code` | `string` | Circuit code from F4 (`CT-XXX`). | `CT-000` |
| `delivered_kwh` | `double` | F5 energy of the hour (its four quarters; an hour with a missing quarter is dropped). | `7.189` |
| `peak_kw` | `double` | Highest quarter of the hour as average power (kWh of 15 minutes × 4). | `7.228` |
| `load_pct_capacity` | `double` | `peak_kw /` capacity of the transformer (kVA, power factor 1). | `0.0513` |
| `temperature_c` | `double` | F2 temperature of that hour; null when F2 has no reading. | `10.27` |
| `date` | partition | Day of the row; the partition folder of the dataset. | |

## quarterly_report_transformers

**Grain:** one transformer in one quarter. **Written by:** `jobs.quarterly_report` (US-54). **Reads:** fact_transformer_loss_daily, interval_30min_filled.

| Field | Type | Description | Example |
|---|---|---|---|
| `transformer_code` | `string` | Transformer code from F4 (`TR-XXXXX`). | `TR-00003` |
| `circuit_code` | `string` | Circuit code from F4 (`CT-XXX`). | `CT-000` |
| `delivered_kwh` | `double` | Energy delivered to the transformer (F5). | `295.86400000000003` |
| `metered_kwh` | `double` | Energy of the transformer's meters in the same intervals (filled readings: real + estimated). | `290.812` |
| `loss_kwh` | `double` | `delivered_kwh − metered_kwh` (RN-06); negative when the meters add up to more than F5. | `5.052` |
| `loss_pct` | `double` | `loss_kwh / delivered_kwh`. | `0.017075413027607275` |
| `loss_cost` | `decimal128(22, 2)` | Sum of the daily `loss_cost` of the quarter. | `1.05` |
| `real_readings` | `int64` | Real readings of the transformer's meters in the quarter. | `2386` |
| `estimated_readings` | `int64` | Estimated readings in the quarter. | `117` |
| `invalid_readings` | `int64` | Readings that could not be used (no value). | `89` |
| `share_real` | `double` | `real_readings` over all readings. | `0.9205246913580247` |
| `share_estimated` | `double` | `estimated_readings` over all readings. | `0.04513888888888889` |
| `share_invalid` | `double` | `invalid_readings` over all readings. | `0.03433641975308642` |
| `quarter` | partition | Quarter, e.g. `2013-Q1` (in `dim_date`/`dim_month`: 1 to 4). | |

## dr_events

**Grain:** one demand-response event. **Written by:** `jobs.dr_events` (US-43, RN-08). **Reads:** raw F2, circuit_load.

*Schema from the job.*

| Field | Type | Description |
|---|---|---|
| `event_id` | `string` | Demand-response event, `DR-<circuit>-<yyyymmdd>`. |
| `circuit_code` | `string` | Circuit code from F4 (`CT-XXX`). |
| `start_ts` | `timestamp` | Start of the event window (inside the peak band). |
| `end_ts` | `timestamp` | End of the event window (3 hours at most). |
| `duration_h` | `double` | Length of the event window in hours. |
| `forecast_temp_c` | `double` | Highest F2 temperature of the day inside the peak band; the pilot replays history, so it plays the forecast (RN-08). |
| `projected_load_pct` | `double` | Highest load of the circuit in the same intervals one week before (weekly persistence forecast, RN-08). |
| `date` | partition | Day of the row; the partition folder of the dataset. |

## dr_participants

**Grain:** one customer meter taking part in one event. **Written by:** `jobs.dr_events` (US-43, RN-10). **Reads:** dr_events, raw F4 meters and contracts.

*Schema from the job.*

| Field | Type | Description |
|---|---|---|
| `event_id` | `string` | Demand-response event, `DR-<circuit>-<yyyymmdd>`. |
| `customer_code` | `string` | Customer code from F4 (`CU-<LCLid>`). |
| `meter_id` | `string` | Meter of the customer on the event circuit. |
| `circuit_code` | `string` | Circuit code from F4 (`CT-XXX`). |
| `date` | partition | Day of the row; the partition folder of the dataset. |

## dr_notifications

**Grain:** one notification of one event to one customer. **Written by:** `jobs.dr_events` (US-43). **Reads:** dr_participants.

*Schema from the job.*

| Field | Type | Description |
|---|---|---|
| `event_id` | `string` | Demand-response event, `DR-<circuit>-<yyyymmdd>`. |
| `customer_code` | `string` | Customer code from F4 (`CU-<LCLid>`). |
| `channel` | `string` | Channel of the message (the outbox a mailer sends). |
| `message` | `string` | Text sent to the customer. |
| `date` | partition | Day of the row; the partition folder of the dataset. |

## dr_settlement

**Grain:** one customer in one event, with baseline, saving and incentive. **Written by:** `jobs.dr_settlement` (US-44, RN-09). **Reads:** dr_participants, dr_events, interval_30min_filled, F7.

*Schema from the job.*

| Field | Type | Description |
|---|---|---|
| `event_id` | `string` | Demand-response event, `DR-<circuit>-<yyyymmdd>`. |
| `customer_code` | `string` | Customer code from F4 (`CU-<LCLid>`). |
| `baseline_days` | `int32` | Days used for the baseline. |
| `baseline_kwh` | `double` | Average energy of the customer in the event window over the baseline days (RN-09); null without a fair baseline. |
| `actual_kwh` | `double` | Energy of the customer in the event window on the event day. |
| `savings_kwh` | `double` | `baseline_kwh − actual_kwh`. |
| `savings_pct` | `double` | `savings_kwh / baseline_kwh`. |
| `incentive_paid` | `bool` | True (1) when the saving is 10% or more (RN-09). |
| `price_per_kwh` | `double` | F7 peak price of the event day. |
| `incentive_amount` | `double` | kWh saved × F7 peak price of the day; 0 without incentive. |
| `date` | partition | Day of the row; the partition folder of the dataset. |

## fact_dr_participation

**Grain:** one customer in one demand-response event. **Written by:** `jobs.fact_dr_participation` (US-45). **Reads:** dr_settlement, dr_events, raw F4.

*Schema from the job.*

| Field | Type | Description |
|---|---|---|
| `date_key` | `int32` | Day as `yyyymmdd`, key of `dim_date`. |
| `event_id` | `string` | Demand-response event, `DR-<circuit>-<yyyymmdd>`. |
| `customer_code` | `string` | Customer code from F4 (`CU-<LCLid>`). |
| `circuit_code` | `string` | Circuit code from F4 (`CT-XXX`). |
| `baseline_kwh` | `double` | Average energy of the customer in the event window over the baseline days (RN-09); null without a fair baseline. |
| `actual_kwh` | `double` | Energy of the customer in the event window on the event day. |
| `savings_kwh` | `double` | `baseline_kwh − actual_kwh`. |
| `savings_pct` | `double` | `savings_kwh / baseline_kwh`. |
| `incentive_paid` | `int32` | True (1) when the saving is 10% or more (RN-09). |
| `incentive_amount` | `double` | kWh saved × F7 peak price of the day; 0 without incentive. |
| `date` | partition | Day of the row; the partition folder of the dataset. |

## dim_date

**Grain:** one day. **Written by:** `jobs.dimensions` (US-52). **Reads:** generated.

| Field | Type | Description | Example |
|---|---|---|---|
| `date_key` | `int32` | Day as `yyyymmdd`, key of `dim_date`. | `20121201` |
| `date` | `date32[day]` | The day. | `2012-12-01` |
| `day_of_week` | `int32` | ISO day of the week: 1 = Monday ... 7 = Sunday. | `6` |
| `is_business_day` | `bool` | Monday to Friday (holidays not modelled yet). | `False` |
| `year_month` | `string` | Month as `YYYY-MM`. | `2012-12` |
| `month` | `int32` | Calendar month (1-12); as a partition, `YYYY-MM`. | `12` |
| `quarter` | `int32` | Quarter, e.g. `2013-Q1` (in `dim_date`/`dim_month`: 1 to 4). | `4` |
| `year` | `int32` | Calendar year. | `2012` |

## dim_month

**Grain:** one calendar month. **Written by:** `jobs.dimensions` (US-52). **Reads:** dim_date.

| Field | Type | Description | Example |
|---|---|---|---|
| `year_month` | `string` | Month as `YYYY-MM`. | `2012-12` |
| `month_name` | `string` | Name of the month, e.g. `January`. | `December` |
| `quarter` | `int32` | Quarter, e.g. `2013-Q1` (in `dim_date`/`dim_month`: 1 to 4). | `4` |
| `year` | `int32` | Calendar year. | `2012` |
| `first_date_key` | `int32` | `date_key` of the first day of the month. | `20121201` |

## dim_time_of_day

**Grain:** one of the 48 half hours of a day. **Written by:** `jobs.dimensions` (US-52). **Reads:** generated.

| Field | Type | Description | Example |
|---|---|---|---|
| `time_key` | `int32` | Half hour of the day, 0 (00:00) to 47 (23:30), key of `dim_time_of_day`. | `0` |
| `hh_mm` | `string` | Start of the half hour, `HH:MM`. | `00:00` |
| `hour` | `int32` | Hour of the day, 0-23. | `0` |

## dim_tariff_band

**Grain:** one version of one F7 tariff band. **Written by:** `jobs.dimensions` (US-52). **Reads:** F7.

| Field | Type | Description | Example |
|---|---|---|---|
| `band_name` | `string` | F7 tariff band of the interval or row. | `off-peak` |
| `price_per_kwh` | `decimal128(10, 4)` | F7 price per kWh of the band in that version. | `0.1000` |
| `start_time` | `string` | Start of the band in the day. | `00:00:00` |
| `end_time` | `string` | End of the band in the day. | `07:59:59` |
| `valid_from` | `date32[day]` | First day the row is valid. | `2011-01-01` |
| `valid_to` | `date32[day]` | Last day the row is valid; `9999-12-31` while it is the current one. | `2011-12-31` |

## dim_customer

**Grain:** one contract version of one customer (type 2). **Written by:** `jobs.dimensions` (US-52). **Reads:** raw F4 contracts.

| Field | Type | Description | Example |
|---|---|---|---|
| `customer_code` | `string` | Customer code from F4 (`CU-<LCLid>`). | `CU-MAC000002` |
| `contract_code` | `string` | F4 contract code. | `CT-MAC000002-1` |
| `tariff_type` | `string` | `standard` or `dynamic` (time of use). | `standard` |
| `valid_from` | `date32[day]` | First day the row is valid. | `2011-11-01` |
| `valid_to` | `date32[day]` | Last day the row is valid; `9999-12-31` while it is the current one. | `9999-12-31` |
| `is_current` | `int32` | 1 for the open contract version, 0 for a closed one. | `1` |

## dim_meter

**Grain:** one meter. **Written by:** `jobs.dimensions` (US-52). **Reads:** raw F4 meters.

| Field | Type | Description | Example |
|---|---|---|---|
| `lclid` | `string` | Meter code (the F1 `LCLid`, `meter_id` everywhere else). | `MAC000002` |
| `customer_code` | `string` | Customer code from F4 (`CU-<LCLid>`). | `CU-MAC000002` |
| `transformer_code` | `string` | Transformer that feeds the meter. | `TR-00000` |

## dim_transformer

**Grain:** one transformer with its circuit. **Written by:** `jobs.dimensions` (US-52). **Reads:** raw F4 meters.

| Field | Type | Description | Example |
|---|---|---|---|
| `transformer_code` | `string` | Transformer code from F4 (`TR-XXXXX`). | `TR-00000` |
| `capacity_kva` | `decimal128(8, 2)` | Capacity of the transformer in kVA (F4). | `155.82` |
| `circuit_code` | `string` | Circuit code from F4 (`CT-XXX`). | `CT-000` |
| `circuit_capacity_kva` | `decimal128(8, 2)` | Capacity of the circuit in kVA (F4). | `2100.12` |

## dim_dr_event

**Grain:** one demand-response event. **Written by:** `jobs.dimensions` (US-52). **Reads:** dr_events.

*Schema from the job.*

| Field | Type | Description |
|---|---|---|
| `event_id` | `string` | Demand-response event, `DR-<circuit>-<yyyymmdd>`. |
| `circuit_code` | `string` | Circuit code from F4 (`CT-XXX`). |
| `start_ts` | `timestamp` | Start of the event window (inside the peak band). |
| `end_ts` | `timestamp` | End of the event window (3 hours at most). |
| `duration_h` | `double` | Length of the event window in hours. |
| `forecast_temp_c` | `double` | Highest F2 temperature of the day inside the peak band; the pilot replays history, so it plays the forecast (RN-08). |
| `projected_load_pct` | `double` | Highest load of the circuit in the same intervals one week before (weekly persistence forecast, RN-08). |
