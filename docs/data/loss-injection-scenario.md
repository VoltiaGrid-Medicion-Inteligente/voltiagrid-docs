---
title: Loss-injection scenario
---

# Loss-injection scenario: what was injected and what the detection found

**Story:** US-62 · **Task:** T-62.1, detection with injected losses (job `jobs/loss_injection_scenario.py`, voltiagrid-data PR #69).

## What is injected
- Transformer: `TR-00001` (53 meters).
- Period: `2013-01-02` to `2013-01-04`, three consecutive days with filled readings in the lake. RN-06 requires three consecutive days above 12%.
- Injected loss: `0.15` (15%). F5 delivers the meters' energy multiplied by `1 + 0.15`.

## How to run it
F5 must be running (`docker compose up -d api-transformer-metering` in `voltiagrid-api`), and the lake must have the clean readings of the period. From `voltiagrid-data`:

```powershell
python -m jobs.estimate_gaps --date 2013-01-02 --date 2013-01-03 --date 2013-01-04 --lake ..\voltiagrid-api\lake
python -m jobs.loss_injection_scenario --lake ..\voltiagrid-api\lake --from 2013-01-02 --days 3 --transformers TR-00001 --loss-pct 0.15
```

The first command fills the readings of the three days (`estimate_gaps` produces the filled readings from the clean ones). The second one needs them: without filled readings the days have no meter energy to compare.

The scenario injects the loss in F5 (`POST /losses`), copies F5 to raw for the three days, runs `transformer_losses` and `suspicious_meters`, checks the result, and removes the injection, also when a step fails.

## What must happen
- `TR-00001` is suspicious on the last day (`is_suspicious = 1`, with the three-day streak).
- Its meters are evaluated that day in `suspicious_meters` (RN-07).
- A transformer without an injection is not flagged by this test.

## Result of the run
Real output of the command (run by Carlos Muñoz for KAN-331, local F5 on port 8005), pasted as is:

```text
loss-injection: TR-00001 suspicious on the last day, their meters evaluated
```

**The detection works:** with 15% injected for three days, RN-06 flags the transformer and RN-07 evaluates its meters.

## A run that failed, and why it should
A first run started on `2013-01-01`. `TR-00001` showed a loss of **7.0%** on 2013-01-01 and **13.3%** and **15.6%** on the next two days. That day's own loss was below the threshold even with the injection, so there were not three consecutive days above 12% and the check failed, as designed:

```text
FAIL TR-00001 is not suspicious on 2013-01-03
FAIL no meter of TR-00001 was evaluated
```

The second line follows from the first: RN-07 only evaluates the meters of suspicious transformers. Starting the period one day later gave three days above 12% and the run above.

## Notes
- The injection lives in F5's memory: restarting `api-transformer-metering` removes it, and the scenario removes it at the end.
- The run writes F5 raw, `transformer_losses` and `suspicious_meters` for the period in the local lake. Use days that the dashboard does not read, or re-run the daily jobs for them afterwards.
