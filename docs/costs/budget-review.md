---
title: Budget alert review
sidebar_position: 4
---

# Budget alert review (US-28, T-28.3)

The budget and its alerts were created in sprint 1 (*AWS account and access* → Budget and alerts). This review
checks that they still protect the credits now that sprint 3 deploys real infrastructure, and adjusts them.

- **Date:** 2026-11-02
- **Reviewer:** Sharon Meriño
- **Credits left:** 110.26 USD
- **Account plan:** Free plan

## 1. What the budget looks like today

```powershell
aws sso login --profile voltia-admin
$env:AWS_PROFILE = "voltia-admin"
$account = aws sts get-caller-identity --query Account --output text
aws budgets describe-budget --account-id $account --budget-name "voltiagrid-monthly" `
  --query "Budget.[BudgetType,TimeUnit,BudgetLimit.Amount,FilterExpression]" --output json
aws budgets describe-notifications-for-budget --account-id $account --budget-name "voltiagrid-monthly" --output table
aws ce get-anomaly-monitors --region us-east-1 --query "AnomalyMonitors[].[MonitorName,MonitorType,MonitorDimension]" --output table
aws ce get-anomaly-subscriptions --region us-east-1 `
  --query "AnomalySubscriptions[].[SubscriptionName,Frequency,Subscribers[].Address]" --output json
```

One budget exists: `voltiagrid-monthly`. The table shows what was found before the review and what it is after.

| Setting | Expected | Found |
|---|---|---|
| Budget type and period | Cost, monthly, recurring | Cost, monthly, recurring since 2026-09-30, unblended costs. OK |
| Amount | 40 USD (see section 2) | 50 USD. **Changed to 40 USD** |
| `IncludeCredit` | **False** | True: scope *All AWS services* with no charge type filter, actual spend showed 0.00 USD. **Fixed**: filter excludes `Credit` |
| `IncludeRefund` | False | True (same cause). **Fixed**: filter excludes `Refund` |
| Alert 1 | ACTUAL > 50% | ACTUAL > 50% (now 20 USD). OK |
| Alert 2 | ACTUAL > 80% | ACTUAL > 80% (now 32 USD). OK |
| Alert 3 | FORECASTED > 100% | FORECASTED > 100% (now 40 USD). OK |
| Recipients | the four team emails | 2 of 4 on every alert (Mary Muñoz, Sharon Meriño). **Added the other two**: 4 of 4 |
| Cost Anomaly Detection monitor | Exists, daily summary by email | `Default-Services-Monitor` (dimensional, by service), subscription `Default-Services-Subscription`, daily, to Sharon only. **Added the other three**: 4 of 4 |
| Free Tier usage alerts | On (Billing preferences) | On, delivered to marriangelica135@gmail.com (CloudWatch billing alerts also delivered). OK |

The new console has no `CostTypes` field: charge types are set as a filter. After the change `describe-budget`
returns `40.0` and `FilterExpression: Not → Dimensions RECORD_TYPE = [Credit, Refund]` (*Charge type* in the
console is `RECORD_TYPE` in the API).

**Why `IncludeCredit` must be false.** With credits included, every charge is cancelled by a credit and the
budget always sees about 0 USD: no alert would ever fire while the credits are being spent. Without credits, the
budget sees the real usage, which is exactly what the credits are paying for. This review confirmed it: before the
change the actual spend read 0.00 USD although dev windows had run this month.

## 2. Amount and thresholds for sprints 3 and 4

| Item | Value | Source |
|---|---|---|
| Credits left | 110.26 USD | Billing → Credits |
| Expected dev spend | about 3 USD per month (4 windows of 4 h) | *Monthly estimate* |
| Final demo (prod for a few hours) | about 2 USD | *Monthly estimate*: 0.30 USD per prod hour |
| Budget amount | **40 USD per month** | Leaves margin for a heavy month (Spark on the full F1 history, US-41) and still alerts long before the credits run out |
| Alert at 50% (20 USD) | Something was left running for days | Alert 1, actual |
| Alert at 80% (32 USD) | Stop and review Cost Explorer the same day | Alert 2, actual |
| Forecast at 100% (40 USD) | The month is heading over budget: destroy dev | Alert 3, forecasted |

A month of dev normally costs under 10% of the budget. Any alert means something stayed on.

## 3. Changes made

| Change | Done |
|---|---|
| Budget amount 50 → 40 USD | Yes, 2026-11-02 |
| Charge type filter excluding `Credit` and `Refund` (budget now sees real usage) | Yes, 2026-11-02 |
| Two missing team emails added to the three alerts | Yes, 2026-11-02 |
| Three missing team emails added to the anomaly detection subscription | Yes, 2026-11-02 |

To edit the budget: Billing and Cost Management → **Budgets** → `voltiagrid-monthly` → **Edit**. In **Scope
options** choose **Filter specific AWS cost dimensions** → Dimension **Charge type** → **Excludes** → *Credit* and
*Refund*. (The old *Advanced options → Charge types* checkboxes moved there.) Set the amount, then in step 2 check
the three alerts and their recipients.

To edit the anomaly alerts: **Cost Anomaly Detection** → **Alert subscriptions** → the subscription → **Edit**.

## 4. What to do when an alert arrives

1. `.\infra\scripts\destroy.ps1` in `voltiagrid-api` (stops everything in dev). Investigate after, not before.
2. Cost Explorer → *Month to date*, **Group by: Service**, filter **Charge type** excluding *Credit*: find what is charging.
3. Group by **Tag: Owner** or **Tag: Component** to find whose resource it is.
4. Anything not tagged `Project=voltiagrid` was created by hand: find it with **Tag Editor** (all regions) and delete it.
5. Write what happened and the fix in the sprint review.