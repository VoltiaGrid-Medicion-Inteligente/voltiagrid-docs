---
title: Temperature and peak load
---

# Temperature and peak load

**Business question 5:** How does temperature relate to peak load?

## Source
- Fact: `fact_load_weather_hourly` (one row per transformer and complete hour, US-53, `jobs.fact_load_weather`).
  Columns: `date_key`, `hour`, `transformer_code`, `circuit_code`, `delivered_kwh`, `peak_kw`, `load_pct_capacity`,
  `temperature_c`, `date`.
- Load comes from F5 (energy delivered per transformer); temperature from F2 (hourly weather). An hour enters only
  when its four 15-minute rows of F5 exist.
- `load_pct_capacity` is a fraction of the transformer capacity (0.233 = 23.3%): format it as a percentage.
- Dimensions: `dim_transformer`, `dim_date`, the hour.
- Measures: `MAX(load_pct_capacity)`, `AVERAGE(temperature_c)` and the correlation between both.

## Visual
A scatter of `temperature_c` against `load_pct_capacity`, one point per transformer and hour, coloured by
transformer; a line of load and temperature by hour of the day; slicers for transformer and date.

## Control
There is no control query for question 5 in `jobs.control_queries`; the check is a direct read of the fact. With
the data of the local lake of 9 November 2026 the page must show:

- 2,784 rows for January 2013: 4 transformers, 29 days, 24 hours (2,880 with 2012-12-31).
- Highest load 23.5% of capacity, `TR-00000` on 2013-01-09 at 19:00, with 5.0 °C.
- Temperature between −3.9 and 13.1 °C.
- Correlation between temperature and load: +0.01 (+0.006 with 2012-12-31). In winter the relation is weak; the heat-wave
  scenario of demand response is where a positive relation would show.

## Screenshot
The screenshot is attached to the PR that adds the page to the `.pbix`; it is not committed as a file.

## Where the .pbix is
The Power BI file is shared in the team folder. This page documents what the report answers, not the file itself.
