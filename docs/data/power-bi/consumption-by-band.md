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
no ACORN group). For January 2013 (29 days, 2013-01-01 to 2013-01-29) the page must show 30,159.6083 kWh and 6,057.97 of
amount in total, and:

| Band | Tariff | kWh | Amount |
|---|---|---|---|
| intermediate | dynamic | 1,735.2865 | 312.34 |
| intermediate | standard | 8,774.7773 | 1,579.47 |
| off-peak | dynamic | 1,581.3117 | 189.76 |
| off-peak | standard | 8,022.6393 | 962.79 |
| peak | dynamic | 1,654.2119 | 496.25 |
| peak | standard | 8,391.3816 | 2,517.36 |

The ACORN split adds up to the same totals.

## Screenshot
The screenshot is attached to the PR that adds the page to the `.pbix`; it is not committed as a file.

## Where the .pbix is
The Power BI file is shared in the team folder. This page documents what the report answers, not the file itself.
