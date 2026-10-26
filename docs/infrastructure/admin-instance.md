---
title: Admin instance
sidebar_position: 2
---

# Admin instance (US-22)

> Why it exists: [ADR-013](../adr/adr-013-admin-instance.md). Terraform: `infra/modules/admin_instance` in `voltiagrid-api`.

| Item | Value |
|---|---|
| Type | `t4g.nano`, Amazon Linux 2023 (ARM) |
| Subnet | private, `us-east-1a`, no public IP |
| Inbound rules | none |
| Access | AWS Systems Manager Session Manager only (no SSH, no key pair) |
| IAM role | `AmazonSSMManagedInstanceCore` only |
| Exists | only while the `dev` stack exists (`enable_admin_instance = true`, the default) |
| Cost | about 0.035 USD per hour with its three SSM endpoints |

## Before the first use (Windows, once)

```powershell
winget install Amazon.AWSCLI
winget install Amazon.SessionManagerPlugin
```

Open a new terminal and check both:

```powershell
aws --version
session-manager-plugin
```

The second command must answer *The Session Manager plugin was installed successfully*.

## Open a shell on the instance

```powershell
aws sso login --profile voltia-admin
$env:AWS_PROFILE = "voltia-admin"
$id = terraform -chdir=infra/envs/dev output -raw admin_instance_id
aws ssm start-session --target $id
```

A prompt `sh-5.2$` opens; it runs as the user `ssm-user`. Leave with `exit`.

If the session says *TargetNotConnected*, the agent is still starting: wait one or two minutes after the apply and try again.

## Connect to RDS from your laptop (port forwarding)

The session forwards `localhost:15432` on your laptop to port 5432 of RDS through the instance:

```powershell
$id   = terraform -chdir=infra/envs/dev output -raw admin_instance_id
$db   = terraform -chdir=infra/envs/dev output -raw rds_address
aws ssm start-session --target $id `
  --document-name AWS-StartPortForwardingSessionToRemoteHost `
  --parameters "host=$db,portNumber=5432,localPortNumber=15432"
```

Leave that terminal open (it says *Waiting for connections...*). In another terminal or in DBeaver,
connect to `localhost`, port `15432`, database `voltiagrid`, SSL mode `require`. The user and the
password are in Secrets Manager (see *RDS* in the `voltiagrid-api` repo, `infra/docs/RDS.md`). Close the tunnel with Ctrl+C.

The `rds_address` output exists from US-25 on.

## Check S3 from the private subnet

Inside a session:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://s3.us-east-1.amazonaws.com   # an HTTP code: S3 answers through the endpoint
curl -sS -m 5 https://www.google.com                                            # times out: no route to the internet
```

## Stop it or remove it

| What you want | Command | Cost afterwards |
|---|---|---|
| Pause it for a few hours | `aws ec2 stop-instances --instance-ids $id` | 8 GB disk (about 0.0009 USD per hour) + SSM endpoints |
| Start it again | `aws ec2 start-instances --instance-ids $id` | — |
| Remove it but keep the rest of `dev` | `terraform -chdir=infra/envs/dev apply -var enable_admin_instance=false` | 0 |
| End of the test window | `terraform -chdir=infra/envs/dev destroy` | 0 |

The usual case is the last one: the instance is destroyed with the rest of the `dev` stack at the end of each window.

## Rules

- Never add an inbound rule or a public IP to this instance.
- Do not store files with data or credentials on it; it is destroyed often.
- Do not install a database or services on it: it is a door, not a server.
