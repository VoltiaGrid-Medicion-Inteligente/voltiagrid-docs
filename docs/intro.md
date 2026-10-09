---
title: Introduction
sidebar_position: 1
slug: /
---

# VoltiaGrid Docs

Documentation for **Project 04 – VoltiaGrid Smart Metering**: a data platform that ingests, validates and aggregates smart-meter readings for billing, non-technical losses and demand response, deployed on AWS.

## What you will find here

- **Architecture**: end-to-end design, components and data flows (E-01).
- **ADRs**: architecture decisions with the alternatives considered.
- **Data**: data dictionary, dimensional model and lineage (E-10).
- **Infrastructure**: AWS network, IAM and resources (E-06).
- **Costs**: monthly cost model and the 200,000-meter projection (E-07, E-15).
- **Runbook**: how to deploy, monitor, reprocess and recover (E-12).
- **Contributing**: branch, commit and pull request rules.

## Repositories

| Repository | Purpose |
|---|---|
| `voltiagrid-api` | APIs, seed and simulators |
| `voltiagrid-data` | Spark jobs, Airflow DAGs and reference data |
| `voltiagrid-analytics` | Dimensional model and Power BI |
| `voltiagrid-docs` | This documentation site |