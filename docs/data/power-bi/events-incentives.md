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

## Data: heat-wave scenario

With the real data no event is ever declared, so the page uses a scenario, as the losses page does with the
loss-injection scenario (KAN-331).

**Why there are no real events.** RN-08 needs both conditions on the same day:

- **Temperature.** In all of F2 (2011–2014) only **2013-08-01** goes above 30 °C between 18:00 and 21:59 (30.8 °C).
  On 2013-07-22, the example day of `demand-response.md`, it reached 29.7 °C.
- **Load.** With the simulated meters the circuit `CT-000` peaks at 4.7–7% of its 2,100.12 kVA, far from 85%.

**What the scenario changes** (on 12 November 2026, in a separate scenario lake; the January lake is not touched):

1. The F3 simulator publishes 2013-07-04 to 2013-08-01: 278,400 readings expected, 272,928 stored. Then
   `clean_readings`, `estimate_gaps` and `circuit_load` run normally.
2. In the F4 copy of the scenario lake, the capacity of `CT-000` goes from 2,100.12 to 105 kVA (1/20). The projected
   load of the peak band then reaches 94.7%.
3. `dr_events --date 2013-08-01` declares **one event**: `DR-CT-000-20130801`, 18:30–21:30, forecast 30.8 °C,
   projected load 94.7%. 35 dynamic-tariff customers are notified.
4. **Simulated response.** The simulator does not model how customers react, so without this step the savings stay
   between −3% and +1.6% and nobody earns an incentive. Inside the event window, half of the participants (every other
   meter, sorted by `meter_id`) cut their filled readings by 15% and the other half by 5%.
5. `dr_settlement`, `fact_dr_participation` and `dimensions` run normally on that data.

**Result in the page:**

| Measure | Value |
|---|---|
| Events | 1 |
| Participants | 35 |
| Baseline / actual | 45.673 / 40.806 kWh |
| Savings | 4.867 kWh (10.7%) |
| Customers with incentive (saving of 10% or more, RN-09) | 17 |
| Incentive cost | 1.12 |

Of the 18 customers who cut 15%, 16 reach 10% against their baseline; of the 17 who cut 5%, one does, because its
baseline days were higher than the event day. RN-09 pays only from 10%, so the threshold shows on the page as designed.

The tables are in `powerbi/data/dataset=fact_dr_participation` and `dataset=dim_dr_event` of `voltiagrid-final.pbix`.

## Screenshot
The screenshot is attached to the PR by dragging it into the description; it is not committed as a file.
