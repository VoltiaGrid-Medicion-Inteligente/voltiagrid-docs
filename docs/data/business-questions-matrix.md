---
title: Business questions matrix
sidebar_position: 2
---

# Business questions matrix

> Each of the six questions management asks maps to one fact table, its dimensions and its measures. Every dashboard number must match a control query run on the same data.

## Summary

| # | Question | Fact table | Dimensions | Measures |
|---|---|---|---|---|
| 1 | How much is consumed by time band, socioeconomic group and tariff type? | `fact_consumption` | `dim_tariff_band`, `dim_customer` (ACORN, tariff type), `dim_date` | `SUM(energy_kwh)`, `SUM(energy_cost)` |
| 2 | Which transformers lose the most energy, in kWh and money? | `fact_transformer_loss_daily` | `dim_transformer`, `dim_date` | `SUM(loss_kwh)`, `SUM(loss_cost)`, `AVG(loss_pct)`, days suspicious |
| 3 | What % of readings was estimated, by meter, transformer and month? | `fact_consumption` | `dim_meter`, `dim_transformer`, `dim_date` (month) | `SUM(is_estimated) / COUNT(*)` |
| 4 | How much did each demand-response event save, and what did incentives cost? | `fact_dr_participation` | `dim_dr_event`, `dim_customer`, `dim_date` | `SUM(savings_kwh)`, `AVG(savings_pct)`, `SUM(incentive_amount)` |
| 5 | How does temperature relate to peak load? | `fact_load_weather_hourly` | `dim_transformer`, `dim_date`, hour | `MAX(load_pct_capacity)`, `AVG(temperature_c)`, correlation |
| 6 | How many customers are left out of automatic billing, and why? | `fact_billing_monthly` | `dim_month`, `dim_exclusion_reason`, `dim_customer` | `COUNT` where `is_billable = 0`, by reason |

## Detail per question

### 1. Consumption by time band, socioeconomic group and tariff type

- **Fact:** `fact_consumption` (meter × 30 min).
- **Slice by:** `dim_tariff_band.band_name`, `dim_customer.acorn_grouped`, `dim_customer.tariff_type`, `dim_date.month`.
- **Measures:** total kWh, total cost, share of each band.
- **Visual:** stacked bar by band, split by ACORN group, filter by tariff type.
- **Control query:**

```sql
SELECT b.band_name, c.acorn_grouped, c.tariff_type,
       SUM(f.energy_kwh) AS kwh
FROM fact_consumption f
JOIN dim_tariff_band b ON b.band_key = f.band_key
JOIN dim_customer c    ON c.customer_key = f.customer_key
JOIN dim_date d        ON d.date_key = f.date_key
WHERE d.year = 2013 AND d.month = 1
GROUP BY b.band_name, c.acorn_grouped, c.tariff_type;
```

### 2. Transformers with the most losses

- **Fact:** `fact_transformer_loss_daily` (transformer × day).
- **Slice by:** `dim_transformer.transformer_code`, `circuit_code`, `dim_date.month`.
- **Measures:** loss kWh, loss cost, average loss %, number of days flagged suspicious.
- **Visual:** top 10 transformers by loss cost; table with loss % and suspicious days.
- **Control query:**

```sql
SELECT t.transformer_code,
       SUM(f.loss_kwh)  AS loss_kwh,
       SUM(f.loss_cost) AS loss_cost,
       SUM(f.is_suspicious) AS suspicious_days
FROM fact_transformer_loss_daily f
JOIN dim_transformer t ON t.transformer_key = f.transformer_key
GROUP BY t.transformer_code
ORDER BY loss_cost DESC
LIMIT 10;
```

### 3. Estimated readings

- **Fact:** `fact_consumption`.
- **Slice by:** `dim_meter.lclid`, `dim_transformer.transformer_code`, `dim_date.month`.
- **Measure:** estimated % = estimated intervals ÷ all intervals.
- **Visual:** heat map transformer × month; drill-down to meter.
- **Control query:**

```sql
SELECT t.transformer_code, d.year, d.month,
       ROUND(100.0 * SUM(f.is_estimated) / COUNT(*), 2) AS estimated_pct
FROM fact_consumption f
JOIN dim_transformer t ON t.transformer_key = f.transformer_key
JOIN dim_date d        ON d.date_key = f.date_key
GROUP BY t.transformer_code, d.year, d.month;
```

### 4. Demand-response savings and incentive cost

- **Fact:** `fact_dr_participation` (customer × event).
- **Slice by:** `dim_dr_event.event_id`, `circuit_code`, `dim_date.month`.
- **Measures:** savings kWh (baseline − actual), average savings %, customers paid, incentive cost.
- **Baseline:** average of the same intervals over the previous 5 business days without an event.
- **Visual:** one row per event with savings and cost; cost per kWh saved.
- **Control query:**

```sql
SELECT e.event_id,
       SUM(f.savings_kwh)      AS savings_kwh,
       SUM(f.incentive_paid)   AS customers_paid,
       SUM(f.incentive_amount) AS incentive_cost
FROM fact_dr_participation f
JOIN dim_dr_event e ON e.event_key = f.event_key
GROUP BY e.event_id;
```

### 5. Temperature and peak load

- **Fact:** `fact_load_weather_hourly` (transformer × hour).
- **Slice by:** `dim_date`, hour, `dim_transformer.circuit_code`.
- **Measures:** maximum load % of capacity, average temperature, correlation between both.
- **Visual:** scatter plot temperature vs load %; line chart of daily peak vs daily maximum temperature.
- **Control query:**

```sql
SELECT d.date,
       MAX(f.load_pct_capacity) AS peak_load_pct,
       MAX(f.temperature_c)     AS max_temp_c
FROM fact_load_weather_hourly f
JOIN dim_date d ON d.date_key = f.date_key
GROUP BY d.date
ORDER BY d.date;
```

### 6. Customers left out of automatic billing

- **Fact:** `fact_billing_monthly` (customer × month).
- **Slice by:** `dim_month.year_month`, `dim_exclusion_reason.description`, `dim_customer.acorn_grouped`.
- **Measures:** customers not billable, % of the base, inspection orders.
- **Main reason:** more than 10% estimated readings in the month (RN-04).
- **Visual:** KPI card with % not billable; bar by reason.
- **Control query:**

```sql
SELECT m.year_month, r.description,
       COUNT(*) AS customers
FROM fact_billing_monthly f
JOIN dim_month m             ON m.month_key = f.month_key
JOIN dim_exclusion_reason r  ON r.reason_key = f.reason_key
WHERE f.is_billable = 0
GROUP BY m.year_month, r.description;
```

## How reconciliation works

1. Spark writes the fact tables to S3 curated after the daily close.
2. The control queries above run on the same tables (Athena or Spark SQL).
3. Each dashboard visual shows the same filter and must give the same number; differences are logged and fixed before the demo.

## Reconciliation, January 2013 (KAN-328)

January 2013 closed on the local lake on 11 November 2026: 29 days, from 2013-01-01 to 2013-01-29 (2013-01-30 is
incomplete in F3 and was left out). Control queries run with
`python -m jobs.control_queries --question <n> --month 2013-01`. The dashboard column was read on 12 November 2026
from the pages of `voltiagrid-final.pbix`, refreshed with the same data.

| # | Control query result | Dashboard | Match |
|---|---|---|---|
| 1 | 30,159.6083 kWh and 6,057.97 of amount; by band and tariff in *Consumption by band, socioeconomic group and tariff* | 30,159.61 kWh and 6,057.97; the six band and tariff rows equal; by ACORN: Affluent 12,100.4223, Adversity 9,602.7042, Comfortable 8,244.9483, Unknown 211.5335 | Yes |
| 3 | Estimated half hours: TR-00000 9.05%, TR-00001 9.14%, TR-00002 8.79%, TR-00003 9.48% (9.07% overall) | page *Reading quality*: the same four values and 9.07% overall | Yes |
| 5 | Read of `fact_load_weather_hourly` (no control query): 2,784 rows, highest load 23.5%, correlation +0.01 | `Max load` 23.5%; `Correlación temp-carga` +0.006 with the default date range, which includes 2012-12-31 | Yes |
| 6 | 65 of 200 customers not billable (32.5%), 65 inspection orders, reason RN-04 | 65 of 200 (32.5%), 65 orders, the same reason | Yes |

Question 2 is checked against `fact_transformer_loss_daily` on its own page (−0.64% loss in the month, no suspicious
transformer: the F5 simulator injects no losses outside the scenario of KAN-331). Question 4 has no events in January
(highest circuit load 7%, threshold 85%); its page needs the events of the heat-wave day of July 2013, still to be
added to `voltiagrid-final.pbix`.

See the [dimensional model](./dimensional-model.md) for the full list of tables and grains.