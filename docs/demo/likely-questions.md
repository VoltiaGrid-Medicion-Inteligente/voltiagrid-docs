---
title: Likely questions per flow
sidebar_position: 9
---

# Likely questions per flow (US-68, T-68.3)

Questions the evaluators are likely to ask in the demo, grouped by flow, with the answer and where the evidence is.
Each flow names who answers it (a proposal: the owner of the flow can swap with the back-up before the rehearsal).
Numbers come from the runs of 8-9 November 2026; if a number changes, update it here before the rehearsal.

| Flow | Answers | Back-up |
|---|---|---|
| 1. Ingestion and raw | Carlos Aponte | Sharon |
| 2. Daily close and the F1 history | Carlos Aponte | Sharon |
| 3. Losses and detection | María Muñoz | Carlos Muñoz |
| 4. Demand response | Carlos Muñoz | Carlos Aponte |
| 5. Customer API and portal | Sharon Meriño | Carlos Muñoz |
| 6. Dashboard and business questions | María Muñoz | Carlos Aponte |
| 7. Infrastructure, operations and cost | Sharon Meriño | María Muñoz |

## 1. Ingestion and raw

**What happens if the consumer goes down while the concentrators keep sending?**
RabbitMQ keeps the messages in durable quorum queues (`readings.live`, `readings.resend`); the consumer ACKs only after
writing the message to raw, so nothing is lost and nothing is ACKed twice (ADR-001, ADR-007).

**Why do you store the raw message untouched instead of cleaning it on arrival?**
So any cleaning can be repeated from the source: raw is the only copy of what the sources sent (versioned bucket), and
deduplication happens in Spark, where the whole day is visible (ADR-007).

**How do you know no reading was lost between layers?**
`layer_counts` compares raw, clean, filled and curated for a run. On the full F1 history (167,817,021 raw readings):
0 lost from raw to clean, 0 duplicated, every valid reading reaches filled, and the consumption fact matches filled
in intervals and kWh (*Data → The F1 history in the cloud*, KAN-357).

## 2. Daily close and the F1 history

**Does the daily close meet 45 minutes?**
Yes. Measured in AWS on 9 November: 12.2 minutes of wall clock for 793,528 readings, 0.0358 USD of Fargate (KAN-317).

**Why did the F1 history take hours, and how was it fixed?**
`estimate_gaps` looked up the next valid reading with a Spark window that ran to the end of each meter for every row:
about n²/2 operations per meter, with 40,000 intervals per meter. The fix keeps the same result and does it in one
pass: the full history went from more than 3 hours to 24.7 minutes (PR data #76, checked row by row).

**How are missing readings estimated?**
RN-03: a gap of up to 2 hours with readings on both sides is interpolated; a longer one takes the average of the same
half hour on the same weekday of the last 4 weeks; without that history the value stays empty and is marked
`unavailable`. Every estimate is flagged with its method.

**What does "estimated" mean for billing?**
RN-04: a customer with more than 10% of estimated half hours in the month is not billed automatically and gets an
inspection order (`billing_status`, `inspection_orders`).

## 3. Losses and detection

**How is a loss computed?**
Energy delivered to the transformer (F5) minus the energy of its meters in the same half hours, using real and
estimated readings: with only real ones every missing reading would look like stolen energy (RN-06).

**When is a transformer suspicious?**
Loss above 12% on 3 or more consecutive days; suspicious transformers are ranked by the energy lost in the streak, and
their meters are checked for 48 hours at zero or a drop of more than 60% against their 8-week average (RN-06, RN-07).

**How do you know the detection works?**
The loss-injection scenario injects 15% in F5 for `TR-00001` for three days and checks that it becomes suspicious and
that its meters are evaluated; it passed (*Data → Loss-injection scenario*, KAN-331/332).

**Why does a transformer show a negative loss on some day?**
The meters add up to more than F5 delivered. On 2013-01-01, `TR-00001` reads 304.6 kWh against 284.8 delivered: the
excess is the estimated energy (20.0 kWh), so the real readings alone match F5. It is an estimation effect, not a
data error.

## 4. Demand response

**When is an event declared?**
RN-08: forecast temperature above the threshold and projected load of the circuit above 85% in the peak band; the
event lasts 3 hours at most and only time-of-use customers take part, at most 8 events per month (RN-10).

**How is the saving measured?**
RN-09: baseline = average of the same window on the last 5 working days without an event; saving = baseline − actual;
from 10% on the customer gets the incentive at the peak price (*Data → Power BI → Events and incentives*).

## 5. Customer API and portal

**Can a customer see another customer's data?**
No. The token carries the customer code; the API answers 403 to any other customer, and the portal only calls
`/me/...`. The 22 isolation tests pass (CA-10, CA-69.4, KAN-355).

**Where does the portal run?**
Static files on a private S3 bucket behind CloudFront, deployed with Terraform and removed by the destroy (ADR-015,
KAN-354). The API behind the ALB is HTTP, so the portal on CloudFront cannot call it yet; the fix is proposed in
ADR-016. In the demo the portal runs locally against the same API.

**What does the API answer in time?**
RNF-04 asks for a p95 of 500 ms or less; the dashboard of US-63 shows the ALB p95 (0.045 s at most in the window of
9 November, *Performance → API* for the load test).

## 6. Dashboard and business questions

**Do the dashboard numbers match the data?**
Each business question has a control query run on the same tables (CT-10, *Data → Business questions matrix*). For
losses, the quarterly report of KAN-314 matches the loss fact (16.21 kWh lost in total in both), and the loss page
is compared against that report before it is published.

**Which questions are answered?**
Question 2 (losses per transformer), 3 (estimated readings) and 4 (demand response) have pages. Question 5
(temperature and peak load) has its fact since KAN-313 (`fact_load_weather_hourly`); questions 1 and 6 are pages of
US-57.

**Why only 200 customers in the consumption fact?**
The dev inventory (F4) has 200 meters; the other 5,365 F1 meters have no customer in F4, so the fact cannot assign
them. `layer_counts` reports them as `meters_without_f4`.

## 7. Infrastructure, operations and cost

**What does it cost?**
dev: about 0.16 USD per hour of window, destroyed after each one. prod for the pilot (5,500 meters): 214.89 USD per
month; for 200,000 meters: 303.77 USD per month (*Costs → Scaling to 200,000 meters*).

**What happens at 200,000 meters?**
Spark stays cheap (about 13 USD per month for the daily close), but `estimate_gaps` would need 16 vCPU to keep the
close under 45 minutes. The cost grows most in a bigger RDS (+27.54 USD), larger API tasks (+27.05 USD) and S3
requests (+22.10 USD, one object per message); the last one drops under 1 USD by writing several messages per object.

**How do you recover from a bad deployment?**
ECS's circuit breaker returns the service to the last revision that worked; for the demo, `rollback.ps1` does it in
about 3 minutes while the previous version keeps answering (KAN-335).

**How do you know nothing is left running after the demo?**
`destroy.ps1` ends with *Nothing billable left in dev* after checking EC2, RDS, load balancers, NAT, Elastic IPs,
endpoints and ECS; on 9 November no snapshots, images, log groups or alarms were left either (KAN-319).
