---
sidebar_position: 11
---

# ADR-011: us-east-1, two availability zones and a network without NAT Gateway

- **Status:** Accepted
- **Date:** 2026-10-23
- **Owner:** P3

## Context
US-21 asks for our own network defined as code: a VPC with public and private subnets in **2 availability zones**, routes, gateways and minimal Security Groups, recreatable at any time. The team has about **110 USD of AWS credits** for the rest of the project, so every resource that is billed per hour while it exists must be justified. Developers and users are in Colombia; the pilot data (London smart meters) has no residency requirement.

## Decision

**Region: `us-east-1` (N. Virginia).**
- It is the cheapest region for every service we use (Fargate, RDS, ALB, S3, Secrets Manager) and the one used in the cost estimate.
- Every service in the architecture exists there, including EKS, Fargate Spot and Amazon MQ.
- Latency from Colombia (about 60–90 ms) is irrelevant for batch processing and acceptable for the APIs.

**Availability zones: `us-east-1a` and `us-east-1b`.**
- Two AZs is the minimum that RDS (DB subnet group) and the ALB accept, and what the acceptance criteria require.
- A third AZ would add subnets and endpoints without improving a pilot that is not highly available on purpose.
- AZ names are a Terraform variable (`azs`). If an instance type is not offered in one of them, the variable is changed, not the code.

**Network layout (VPC `10.20.0.0/16`):**

| Subnet | AZ | CIDR | What runs there |
|---|---|---|---|
| public-a | us-east-1a | `10.20.0.0/24` | ALB, Fargate tasks (public IP, inbound only from the ALB) |
| public-b | us-east-1b | `10.20.1.0/24` | ALB, Fargate tasks |
| private-a | us-east-1a | `10.20.10.0/24` | RDS, admin EC2 instance, SSM endpoints |
| private-b | us-east-1b | `10.20.11.0/24` | RDS (standby subnet of the DB subnet group) |

- **Internet Gateway** for the public subnets.
- **No NAT Gateway by default.** A NAT Gateway costs about 33 USD a month per AZ plus data, which is a third of our credits. The private subnets have no route to the internet. They reach S3 through a **gateway VPC endpoint**, which is free, and Systems Manager through three **interface endpoints**, placed in one AZ only. A NAT Gateway can be turned on with `enable_nat_gateway = true` if a future component really needs it, and that change must be recorded in a new ADR.
- **Fargate tasks in public subnets** with a public IP, so they can pull images from ECR and read Secrets Manager without NAT or six more interface endpoints. Their Security Group accepts traffic **only from the ALB Security Group**, so they are not reachable from the internet even with a public IP.
- **RDS and the admin instance in private subnets**, never with a public IP.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| `sa-east-1` (São Paulo), closer to Colombia | 30–60% more expensive for compute and RDS, and some services arrive there later. The latency gain does not matter for 30-minute batches. |
| Three availability zones | More subnets and endpoints to pay for and maintain; the pilot does not need that level of availability. |
| NAT Gateway per AZ (textbook layout) | About 66 USD a month for two AZs before data, more than half of the credits, only to let private tasks reach AWS APIs that endpoints or public subnets already reach. |
| Fargate in private subnets with interface endpoints (ECR API, ECR DKR, Logs, Secrets Manager) | Four endpoints in two AZs cost more than a NAT Gateway; it would be the right choice in production with a real budget (noted for US-58). |

## Consequences
- The network costs **0 USD per hour** by itself (VPC, subnets, routes, Internet Gateway and S3 endpoint are free). The SSM endpoints cost about 0.03 USD per hour while the admin instance exists.
- Anything in a private subnet that needs the internet (for example `dnf install` on the admin instance) will not work without a NAT Gateway; this is accepted.
- Fargate tasks get public IPv4 addresses (about 0.005 USD per hour each). This is cheaper than NAT for a handful of tasks.
- The production design for 200,000 meters (US-58) should revisit this: private Fargate with NAT or endpoints in every AZ.
