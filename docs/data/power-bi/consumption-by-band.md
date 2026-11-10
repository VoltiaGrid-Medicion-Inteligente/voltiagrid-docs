---
title: Consumption by band, socioeconomic group and tariff
---

# Consumption by band, socioeconomic group and tariff

**Business question 1:** How much is consumed by time band, socioeconomic group (ACORN) and tariff type?

## Source
- Fact: `fact_consumption` (monthly, one row per customer, month, band and tariff period, US-35).
- Dimensions: `dim_tariff_band`, `dim_customer` (tariff type, current contract: `is_current = 1`), `dim_month`.
- ACORN group: `informations_households.csv` (Kaggle households file), joined by `customer_code = "CU-" & LCLid`.
  F4 keeps `acorn_grouped` in the `customer` table, but the F4 export (`jobs.inventory`, `CONTRACTS_SQL`) does not
  select it, so `dim_customer` has no ACORN column yet. The group is normalized as the F4 seed does
  (`seed/f1.py`): Affluent, Comfortable and Adversity stay; any other value is Unknown.
- Measures: `SUM(energy_kwh)`, `SUM(amount)`, share of each band.

## Visual
Stacked bars by band, split by ACORN group, with slicers for tariff type and month; two cards with total kWh and
total amount.

## Control
`python -m jobs.control_queries --question 1 --month 2013-01` returns band and tariff type (the control query has
no ACORN group). For January 2013 the page must show 2,051.2426 kWh and 414.66 of amount in total, and:

| Band | Tariff | kWh | Amount |
|---|---|---|---|
| intermediate | dynamic | 118.0305 | 21.23 |
| intermediate | standard | 592.7514 | 106.73 |
| off-peak | dynamic | 106.5395 | 12.77 |
| off-peak | standard | 534.8811 | 64.20 |
| peak | dynamic | 111.9152 | 33.59 |
| peak | standard | 587.1249 | 176.14 |

The ACORN split adds up to the same totals.

## Screenshot
The screenshot is attached to the PR that adds the page to the `.pbix`; it is not committed as a file.

## Where the .pbix is
The Power BI file is shared in the team folder. This page documents what the report answers, not the file itself.
