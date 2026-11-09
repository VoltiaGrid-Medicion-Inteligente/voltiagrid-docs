# Operations runbook

To operate VoltiaGrid without depending on the team that built it (US-66). Each procedure has steps, a check at the end and what to do if it fails. All commands run from the root of `voltiagrid-api` in PowerShell, with Docker Desktop open, unless stated otherwise.

Before any procedure:

```powershell
aws sso login --profile voltia-admin
$env:AWS_PROFILE = "voltia-admin"
```

## 1. Deploy a version

Source: `infra/docs/DEPLOY.md` and `infra/scripts/deploy.ps1`.

1. Have `develop` up to date with no local changes: `git pull origin develop`.
2. Run the deployment: `.\infra\scripts\deploy.ps1 -AutoApprove`. The script creates the images in ECR, registers the task definitions with the commit as the tag, runs the migrations and the seed on RDS, and updates the services.
3. Check: the script ends with the health of the four APIs through the ALB. If one of them does not answer, stop and go to the rollback procedure.

**If it fails:** `.\infra\scripts\rollback.ps1 -All` puts each service back on its previous revision. ECS replaces the tasks one by one, without downtime.

## 2. Reprocess a period

Source: the DAG `voltiagrid_history` (voltiagrid-data, `dags/voltiagrid_history.py`).

Before you start, with Airflow in ECS mode (`VOLTIA_RUNTIME=ecs`):

- Leave the daily DAG `voltiagrid_readings` **paused**. Unpaused, it starts its own runs on Fargate as soon as Airflow
  comes up.
- Log in with `aws sso login` right before you trigger the run. The SSO session of the laptop lasts **1 hour**. When it
  expires, Airflow stops seeing the Fargate tasks while they keep running, and a retry would start a second task. Log
  in again within the hour while the run lasts. The full history takes about an hour of Spark (cleaning 26 min,
  filling 24.7 min, monthly consumption 6.1 min).

1. In the Airflow UI, open the DAG `voltiagrid_history` and click **Trigger DAG w/ config**.
2. Fill in the parameters:
   - `ingest_date`: the date of the F1 upload (format `YYYY-MM-DD`).
   - `mode`: which raw files are read. `full` reads all 112 blocks; `dev` reads only the 4 blocks of the development
     subset. On the workers (local mode), use `dev`.
3. Check: the cleaning and the filling tasks end green, and the row count of the period matches the control report (`jobs.control_counts`).

**`mode` limits what is read, not what is rewritten.** The cleaning rewrites every date that appears in the files it
reads, and merges in what clean already holds for those dates. The 4 dev blocks have readings on every date of the
history, so on a lake that already holds the full history, `mode=dev` rewrites the whole history too. That is what
happened on 9 November 2026: 167,817,209 rows, the same as `full` (KAN-340). On a lake that holds only the dev subset,
`dev` processes only those 4 blocks.

**Reprocessing is safe:** the load is idempotent, so running it twice does not duplicate rows. If the period already exists, it is overwritten.

## 3. Rotate secrets

Source: `infra/modules/secrets/main.tf`. The secret `voltiagrid-dev/app` holds the JWT secret and the demo password. Confirm the name first with `aws secretsmanager list-secrets --query "SecretList[].Name"`.

1. Generate the new value outside the repository, never in a versioned file.
2. Update the secret: `aws secretsmanager put-secret-value --secret-id voltiagrid-dev/app --secret-string file://new-secret.json`. Delete `new-secret.json` afterwards.
3. Force a new deployment of the services so they take the new value: `aws ecs update-service --cluster voltiagrid-dev --service <service> --force-new-deployment`, once per API service.
4. Check: `GET /health` of each API returns 200 and login works with a test user.

**Expected effect:** rotating the JWT secret invalidates every token issued before. Tell the team before doing it.

## 4. Recover a failed DAG

1. Open the run in Airflow and read the log of the red task. The log says what failed (data, memory, connection to RDS or S3).
2. Fix the cause. If it is bad data, do not edit it by hand: report it with its date and its meter.
3. Clear only the failed tasks: in the DAG view, select the red task and click **Clear task** with the downstream option. Never clear the whole DAG if only one task failed.
4. Check: the run ends green and the last day of the period has its partition in `curated/`.

**If the failure repeats:** do not retry in a loop. Leave the run marked and report it to the team with the log.

## 5. Destroy the environment

Source: `infra/docs/DESTROY-RECREATE.md` and `infra/scripts/destroy.ps1`.

For the development environment, at the end of a work window:

```powershell
.\infra\scripts\destroy.ps1 -AutoApprove
```

The script destroys `infra/envs/dev` and then checks in AWS that nothing that bills per hour is left (instances, RDS, load balancers, NAT, Elastic IPs, endpoints and the ECS cluster). If anything is left, it fails.

**What this script does not destroy:** the data lake (`infra/envs/data`) and the state bucket (`infra/bootstrap`). They are persistent by design (ADR-012). Their deletion is the final cleanup of US-56 and **is not run without an explicit decision of the team**: it deletes the data.

## Who maintains it

Each procedure is reviewed when the code it depends on changes. If a step no longer works, fix it here in the same PR that changes the code.
