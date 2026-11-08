---
title: Losses per transformer
---

# Losses per transformer (business question 2)

**Business question 2:** Which transformers lose the most energy, in kWh and in money?

## Source
- Fact: `fact_transformer_loss_daily` (transformer by day, RN-06).
- Dimensions: `dim_transformer`, `dim_date`.
- Measures: `SUM(loss_kwh)`, `SUM(loss_cost)`, `AVG(loss_pct)`, and suspicious days (`SUM(is_suspicious)`).

## Visual
Bars with the 10 transformers with the highest loss cost. A table next to it with kWh lost, cost, average loss percentage and suspicious days. Filter by quarter (`dim_date.quarter`).

## Control
For a reference quarter, the sum of `loss_kwh` on the page must match the quarterly transformer report (KAN-314, `quarterly_report_transformers`). If it does not match, the page is not published.

## Screenshot
The screenshot is attached to the PR by dragging it into the description; it is not committed as a file.

## Where the .pbix is
The Power BI file is shared in the team folder. This page documents what the report answers, not the file itself.
