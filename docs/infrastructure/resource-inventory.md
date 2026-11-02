---
title: Resource inventory and IAM
sidebar_position: 4
---

# Resource inventory and IAM policies (US-26, T-26.2)

> Taken from the Terraform code in `voltiagrid-api/infra`. Every resource exists because a user story or an ADR
> needs it; the **Why** column says which. Costs per hour: *Costs → Monthly estimate*.

## Totals per stack

| Stack | Folder | Resources | Life cycle |
|---|---|---|---|
| bootstrap | `infra/bootstrap` | 6 | Created once, never destroyed |
| data | `infra/envs/data` | 22 | Persistent (3-year data lake) |
| dev | `infra/envs/dev` | 93 | Created for a test window, destroyed after it |

Regenerate the counts from the state after an apply (PowerShell):

```powershell
terraform -chdir=infra/envs/dev state list |
  Where-Object { $_ -notmatch '\.data\.' } |
  ForEach-Object { ($_ -split '\.')[-2] } |
  Group-Object | Sort-Object Name | Format-Table Count, Name
```

## bootstrap (6)

| Resource type | Count | Name | Why |
|---|---|---|---|
| `aws_s3_bucket` | 1 | `voltiagrid-tfstate-<account id>` | Shared Terraform state with locking (ADR-012) |
| `aws_s3_bucket_versioning` | 1 | — | Roll back a bad state |
| `aws_s3_bucket_server_side_encryption_configuration` | 1 | — | The state contains generated secrets: encrypted at rest |
| `aws_s3_bucket_public_access_block` | 1 | — | Never public |
| `aws_s3_bucket_lifecycle_configuration` | 1 | — | Old state versions deleted after 30 days |
| `aws_s3_bucket_policy` | 1 | — | HTTPS only |

## data (22)

| Resource type | Count | Name | Why |
|---|---|---|---|
| `aws_s3_bucket` | 3 | `voltiagrid-dev-{raw,clean,curated}-<account id>` | Data lake layers (ADR-003, US-23) |
| `aws_s3_bucket_ownership_controls` | 3 | — | ACLs disabled: access decided by IAM only |
| `aws_s3_bucket_public_access_block` | 3 | — | Public access blocked (US-23) |
| `aws_s3_bucket_server_side_encryption_configuration` | 3 | — | Encryption at rest, SSE-S3 |
| `aws_s3_bucket_policy` | 3 | — | HTTPS only, only IAM roles of this account |
| `aws_s3_bucket_lifecycle_configuration` | 3 | — | Cheaper classes over time, expire at 3 years (T-23.2) |
| `aws_s3_bucket_versioning` | 1 | raw only | Protect the only copy of what the sources sent |
| `aws_iam_policy` | 3 | `voltiagrid-dev-datalake-{read,ingest,process}` | Access to the lake through roles (see IAM below) |

## dev (93)

| Area | Resource type | Count | Name | Why |
|---|---|---|---|---|
| Network | `aws_vpc` | 1 | `voltiagrid-dev` | Own network (US-21) |
| | `aws_subnet` | 4 | `voltiagrid-dev-{public,private}-{a,b}` | Public and private in 2 AZs (ADR-011) |
| | `aws_internet_gateway` | 1 | `voltiagrid-dev-igw` | Internet for the ALB and the tasks |
| | `aws_route_table` | 2 | `voltiagrid-dev-{public,private}` | Private table without internet route |
| | `aws_route` | 1 | public `0.0.0.0/0` → IGW | Internet for the public subnets (ALB and tasks) |
| | `aws_route_table_association` | 4 | — | One per subnet |
| | `aws_default_security_group` | 1 | `voltiagrid-dev-default-closed` | Default group left without rules |
| | `aws_vpc_endpoint` | 4 | `voltiagrid-dev-s3` (gateway), `-ssm`, `-ssmmessages`, `-ec2messages` (interface) | S3 without NAT (T-21.3); Session Manager without NAT (US-22) |
| Security | `aws_security_group` | 5 | `voltiagrid-dev-{alb,app,rds,admin,endpoints}` | One group per component (T-21.2) |
| | `aws_vpc_security_group_ingress_rule` | 8 | — | Inbound rules, see *Physical diagram* |
| | `aws_vpc_security_group_egress_rule` | 10 | — | Explicit outbound rules |
| Admin | `aws_instance` | 1 | `voltiagrid-dev-admin` | Admin door to the private network (ADR-013) |
| | `aws_iam_role` + `aws_iam_instance_profile` + `aws_iam_role_policy_attachment` | 1 + 1 + 1 | `voltiagrid-dev-admin-instance` | Session Manager only |
| Database | `aws_db_instance` | 1 | `voltiagrid-dev-db` | Operational database (US-25) |
| | `aws_db_subnet_group` | 1 | `voltiagrid-dev-db` | Private subnets only |
| | `aws_db_parameter_group` | 1 | `voltiagrid-dev-postgres16` | `rds.force_ssl = 1` |
| Secrets | `aws_secretsmanager_secret` + `_version` | 1 + 1 | `voltiagrid-dev/app` | JWT secret and demo passwords (T-25.2). The RDS master secret is created by RDS itself. |
| | `random_password` | 3 | — | Generates those values (not an AWS resource) |
| Images | `aws_ecr_repository` + `aws_ecr_lifecycle_policy` | 5 + 5 | `voltiagrid/<image>` | One per image, immutable tags (T-27.1) |
| Logs | `aws_cloudwatch_log_group` | 5 | `/ecs/voltiagrid-dev/<image>` | 7-day retention (T-27.4) |
| Compute | `aws_ecs_cluster` + `aws_ecs_cluster_capacity_providers` | 1 + 1 | `voltiagrid-dev` | Fargate and Fargate Spot (ADR-006) |
| | `aws_ecs_task_definition` | 5 | `voltiagrid-dev-<image>` | Versioned deployments (T-27.2) |
| | `aws_ecs_service` | 4 | one per API | Long-running APIs behind the ALB |
| | `aws_iam_role` | 2 | `voltiagrid-dev-ecs-execution`, `voltiagrid-dev-ecs-task` | See IAM below |
| | `aws_iam_role_policy` + `aws_iam_role_policy_attachment` | 1 + 1 | — | Execution role permissions |
| Load balancer | `aws_lb` + `aws_lb_listener` | 1 + 1 | `voltiagrid-dev`, port 80 | Single entry point (T-27.3) |
| | `aws_lb_target_group` + `aws_lb_listener_rule` | 4 + 4 | `voltiagrid-dev-{consumption,control-center,inventory,f5}` | One per API, routing by path |

By area: network 18, security 23, admin 4, database 3, secrets 5, images 10, logs 5, compute 15, load balancer 10 = **93**.

## IAM

### People (IAM Identity Center)

Documented in *AWS account and access*: `VoltiaAdmin` (AdministratorAccess) for whoever applies Terraform, `VoltiaDeveloper` (PowerUserAccess) and `VoltiaAnalyst` (ReadOnlyAccess + Billing). Nobody uses the root user or long-lived access keys.

### Roles used by AWS services

| Role | Trusted by | Policies | What it can do | What it cannot do |
|---|---|---|---|---|
| `voltiagrid-dev-admin-instance` | `ec2.amazonaws.com` | `AmazonSSMManagedInstanceCore` (AWS managed) | Register with Systems Manager and accept sessions | Read S3, RDS secrets or change any resource |
| `voltiagrid-dev-ecs-execution` | `ecs-tasks.amazonaws.com` | `AmazonECSTaskExecutionRolePolicy` (AWS managed) + inline `read-app-secrets` | Pull images from ECR, write CloudWatch logs, `secretsmanager:GetSecretValue` **only** on the RDS master secret and `voltiagrid-dev/app` | Read any other secret; the application code never gets this role |
| `voltiagrid-dev-ecs-task` | `ecs-tasks.amazonaws.com` | none | Nothing: the APIs call no AWS service | Everything |

### Data lake policies (attached to roles when a service needs them)

| Policy | Actions | Resources |
|---|---|---|
| `voltiagrid-dev-datalake-read` | `s3:ListBucket`, `s3:GetBucketLocation`, `s3:GetObject` | the three buckets |
| `voltiagrid-dev-datalake-ingest` | `s3:ListBucket`, `s3:GetBucketLocation` on raw; `s3:PutObject`, `s3:GetObject`, `s3:AbortMultipartUpload` on `raw/*` | raw only, **no delete** |
| `voltiagrid-dev-datalake-process` | List on the three buckets; `s3:GetObject` on `raw/*`; `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:AbortMultipartUpload` on `clean/*` and `curated/*` | Spark jobs |

### Bucket policies (resource side)

Every data lake bucket and the state bucket deny requests without HTTPS. The data lake buckets also deny any
principal that is not an IAM role of this account (`aws:PrincipalType`, `aws:PrincipalAccount`): no anonymous,
no IAM users, no root, no other account.

### Least privilege checklist

- [x] No IAM user and no access key is created by the code.
- [x] Every role has a trust policy limited to one AWS service.
- [x] No inline `"Action": "*"` or `"Resource": "*"` written by us (the AWS managed policies above are the standard ones for their service).
- [x] Secrets readable only by the ECS execution role, and only the two it needs.
- [x] Write access to raw cannot delete (ADR-007: raw is append-only).