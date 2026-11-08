---
title: Reading quality by meter, transformer and month
---

# Reading quality by meter, transformer and month

**Business question 3:** What percentage of readings was estimated, by meter, transformer and month?

## Source
- Fact: `fact_consumption` (monthly, US-45).
- Dimensions: `dim_meter`, `dim_transformer`, `dim_date` (month).
- Measure: `SUM(is_estimated) / COUNT(*)`.

## Visual
A table by transformer and month with the estimated percentage; the meter as the detail when a transformer is selected.

## Control
The control query (the same one as the US-45 report) must return the same percentage for a reference month.

## Screenshot
The screenshot is attached to the PR by dragging it into the description; it is not committed as a file.

## Where the .pbix is
The Power BI file is shared in the team folder. This page documents what the report answers, not the file itself.
