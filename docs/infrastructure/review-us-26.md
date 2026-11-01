---
title: Review of US-26
sidebar_position: 5
---

# Review of the diagram, inventory and IAM against the deployed infrastructure (US-26, T-26.3)

Compares *Physical diagram* (T-26.1) and *Resource inventory and IAM* (T-26.2) with the live account, with the
`dev` stack deployed (`infra/scripts/deploy.ps1` in `voltiagrid-api`). Replace every `—` with `OK` or with the
difference found, fix the document that is wrong in the same pull request, and destroy the stack at the end.

- **Date:** 2026-11-01
- **Reviewer:** Mary Muñoz
- **Commit of `voltiagrid-api` deployed:** df8ed7b

## 1. Physical diagram

| # | Diagram says | Command | Result |
|---|---|---|---|
| 1 | One VPC `10.20.0.0/16` | `aws ec2 describe-vpcs --filters "Name=tag:Project,Values=voltiagrid" --query "Vpcs[].CidrBlock"` | OK |
| 2 | 4 subnets: public-a/b `10.20.0.0/24`, `10.20.1.0/24`; private-a/b `10.20.10.0/24`, `10.20.11.0/24`, in `us-east-1a` and `us-east-1b` | `aws ec2 describe-subnets --filters "Name=tag:Project,Values=voltiagrid" --query "Subnets[].[Tags[?Key=='Name']|[0].Value,AvailabilityZone,CidrBlock]" --output table` | OK |
| 3 | No NAT Gateway | `aws ec2 describe-nat-gateways --filter "Name=state,Values=available" --query "NatGateways[].NatGatewayId"` | OK (empty list) |
| 4 | 4 endpoints: S3 gateway; ssm, ssmmessages, ec2messages interface | `aws ec2 describe-vpc-endpoints --filters "Name=tag:Project,Values=voltiagrid" --query "VpcEndpoints[].[ServiceName,VpcEndpointType]" --output table` | OK |
| 5 | ALB internet-facing in both AZs, listener 80 | `aws elbv2 describe-load-balancers --names voltiagrid-dev --query "LoadBalancers[0].[Scheme,AvailabilityZones[].ZoneName]"` | OK (internet-facing, us-east-1a and us-east-1b, one listener 80 HTTP) |
| 6 | 4 target groups, healthy | `aws elbv2 describe-target-groups --load-balancer-arn <arn> --query "TargetGroups[].TargetGroupName"` and `describe-target-health` | OK (consumption, control-center, inventory, f5: all healthy) |
| 7 | RDS in `us-east-1a`, not public, Single-AZ | `aws rds describe-db-instances --db-instance-identifier voltiagrid-dev-db --query "DBInstances[0].[AvailabilityZone,PubliclyAccessible,MultiAZ]"` | Difference: RDS is in `us-east-1b`; not public and Single-AZ are OK. See finding 1 |
| 8 | Admin instance in private-a, no public IP | `aws ec2 describe-instances --filters "Name=tag:Name,Values=voltiagrid-dev-admin" "Name=instance-state-name,Values=running" --query "Reservations[].Instances[].[SubnetId,PublicIpAddress]"` | OK |
| 9 | Fargate tasks in the public subnets with public IP | `aws ecs describe-services --cluster voltiagrid-dev --services api-control-center --query "services[0].networkConfiguration"` | OK (the 4 services: public-a and public-b, `assignPublicIp` ENABLED, SG `app`) |
| 10 | Security Group rules as in the matrix | `aws ec2 describe-security-group-rules --filters "Name=tag:Project,Values=voltiagrid" --query "SecurityGroupRules[].[GroupId,IsEgress,IpProtocol,FromPort,CidrIpv4,ReferencedGroupInfo.GroupId]" --output table` | OK (8 inbound, 10 outbound, same as the matrix). The `admin` 443 rule with no CIDR and no group is the S3 prefix list. See finding 3 |

## 2. Inventory

| # | Check | Command | Result |
|---|---|---|---|
| 1 | dev has 93 resources, by type as in the table | the `terraform state list` command of *Resource inventory and IAM* | OK (93, every type matches) |
| 2 | data has 22 resources | `terraform -chdir=infra/envs/data state list` (count the lines) | OK (22, every type matches) |
| 3 | Every resource has a reason in the **Why** column | read the inventory page | Difference: `aws_route` had no reason. See finding 2 |
| 4 | Every taggable resource follows the tagging policy | `python -m scripts.check_tags --stack infra/envs/dev --stack infra/envs/data --aws` | OK (dev 75, data 6, AWS 172 resources, 0 with problems) |

## 3. IAM

| # | Check | Command | Result |
|---|---|---|---|
| 1 | Admin instance role: only `AmazonSSMManagedInstanceCore` | `aws iam list-attached-role-policies --role-name voltiagrid-dev-admin-instance` and `aws iam list-role-policies --role-name voltiagrid-dev-admin-instance` | OK (no inline policies) |
| 2 | ECS execution role: `AmazonECSTaskExecutionRolePolicy` + inline `read-app-secrets` limited to 2 secret ARNs | `aws iam get-role-policy --role-name voltiagrid-dev-ecs-execution --policy-name read-app-secrets` | OK (RDS master secret and `voltiagrid-dev/app`) |
| 3 | ECS task role: no policies | `aws iam list-attached-role-policies --role-name voltiagrid-dev-ecs-task` and `list-role-policies` | OK |
| 4 | Trust policies limited to one service each | `aws iam get-role --role-name <role> --query "Role.AssumeRolePolicyDocument"` for the three roles | OK (`ec2.amazonaws.com`, `ecs-tasks.amazonaws.com`, `ecs-tasks.amazonaws.com`) |
| 5 | Data lake policies as documented | `aws iam get-policy-version --policy-arn <arn> --version-id v1` for read, ingest, process | OK (ingest has no delete) |
| 6 | Data lake buckets deny non-HTTPS and non-role principals | `aws s3api get-bucket-policy --bucket <raw bucket>` | OK (raw, clean and curated: deny without HTTPS, deny if not an assumed role, deny other accounts) |
| 7 | No IAM user created by the project | `aws iam list-users --query "Users[].UserName"` | OK (no IAM users in the account) |

## Findings and fixes

| # | Finding | Fixed in |
|---|---|---|
| 1 | RDS runs in `us-east-1b` (private-b), the diagram put it in `us-east-1a`. The instance is Single-AZ and the code does not pin an AZ, so AWS picks one of the two private subnets when it is created. | *Physical diagram*: RDS shown as "private-a or private-b", subnet table updated |
| 2 | `aws_route` had no reason in the **Why** column | *Resource inventory and IAM* |
| 3 | The egress text did not list the ALB rules to `app` (8001, 8002, 8003, 8005) | *Physical diagram*: added to the egress bullet |

## Conclusion

The deployed `dev` stack matches the documents: network, endpoints, ALB, target groups, Fargate placement,
Security Group rules, resources by type (dev 93, data 22), tags and IAM. The three differences found were in the
documents, not in the infrastructure, and are fixed in this pull request. The stack was destroyed at the end
(`destroy.ps1`: *Nothing billable left in dev*, 8.8 minutes).