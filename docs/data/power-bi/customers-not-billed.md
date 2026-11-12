---
title: Customers left out of automatic billing
---

# Customers left out of automatic billing

**Business question 6:** How many customers are left out of automatic billing, and why?

## Source
- `billing_status` (one row per customer and month, US-36): `is_billable`, `estimated_pct`, `inspection_order`.
- `inspection_orders` (one row per customer that cannot be billed automatically, RN-04): `reason`, `estimated_pct`.
- Dimensions: `dim_customer`, `dim_month`.
- The dimensional model names this fact `fact_billing_monthly` with a `dim_exclusion_reason`; neither exists in the
  lake. The reason is the `reason` column of `inspection_orders`.
- Measures:

```
Not billable = CALCULATE(COUNTROWS(billing_status), billing_status[is_billable] = FALSE())
```

```
% not billable = DIVIDE([Not billable], COUNTROWS(billing_status))
```

## Visual
A card with the % not billable, bars with the customers by reason, and a table of customers with their estimated
percentage, highest first; slicer for month.

## Control
`python -m jobs.control_queries --question 6 --month 2013-01` returns the customers by reason. For January 2013 the
page must show **65 of 200 customers (32.5%)** not billable and 65 inspection orders, all with the reason
*estimated readings above 10% of the month (RN-04)*. The two counts (orders and `is_billable = false`) must agree.

## Screenshot
The screenshot is attached to the PR that adds the page to the `.pbix`; it is not committed as a file.

## Where the .pbix is
The Power BI file is shared in the team folder. This page documents what the report answers, not the file itself.
