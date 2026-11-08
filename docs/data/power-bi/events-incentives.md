---
title: Savings and incentives per demand-response event
---

# Savings and incentives per demand-response event

**Business question 4:** How much did each demand-response event save, and what did the incentives cost?

## Source
- Fact: `fact_dr_participation` (one row per customer and event, US-45 and KAN-290).
- Dimensions: `dim_dr_event`, `dim_customer`, `dim_date`.
- Measures: `SUM(savings_kwh)`, `AVG(savings_pct)`, `SUM(incentive_amount)`.

## Dependency
`dim_dr_event` is built by the dimensions job (KAN-310, `jobs/dimensions.py`) from `dr_events`. The page joins `fact_dr_participation` to `dim_dr_event` on `event_id`.

## Visual
One row per event: total savings in kWh, average savings in percent, number of customers who received an incentive, and total incentive cost.

## Control
The sum of `incentive_amount` per event must match the settlement of the event (`dr_settlement`).

## Screenshot
The screenshot is attached to the PR by dragging it into the description; it is not committed as a file.

## Where the .pbix is
The Power BI file is shared in the team folder. This page documents what the report answers, not the file itself.
