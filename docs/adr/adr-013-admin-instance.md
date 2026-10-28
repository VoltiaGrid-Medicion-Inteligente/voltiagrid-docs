---
sidebar_position: 13
---

# ADR-013: One small EC2 instance as the admin door to the private network

- **Status:** Accepted
- **Date:** 2026-10-23
- **Owner:** P3

## Context
US-22 asks for an EC2 instance with a clear purpose for admin tasks inside the private network, with no SSH open to the internet. The RDS database lives in a private subnet (US-25) and the private subnets have no route to the internet (ADR-011). The team still needs, a few times per sprint, to:

- open `psql` or DBeaver against RDS to check data, for example after the seed (US-25);
- prove from inside a private subnet that S3 is reached through the gateway endpoint (US-21);
- look at the network from the inside when something does not connect.

## Decision
Run **one `t4g.nano` instance (Amazon Linux 2023, ARM)** in the private subnet of `us-east-1a`:

- **No public IP, no key pair, no inbound rule** in its Security Group.
- **Access only through AWS Systems Manager Session Manager**, with the identity and MFA of each person (ADR-009). Every session is recorded in CloudTrail.
- **Port forwarding** to RDS (`AWS-StartPortForwardingSessionToRemoteHost`) so local tools connect to `localhost:15432` as if the database were local.
- Its IAM role only has `AmazonSSMManagedInstanceCore`: it cannot read data or change resources.
- It exists only while the `dev` stack exists (test windows). It can also be stopped between uses; a stopped instance only pays for its 8 GB disk.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| Bastion host with SSH in a public subnet | Port 22 open to the internet and SSH keys to share and rotate; the acceptance criteria forbid it. |
| No instance: make RDS public for a moment | Breaks US-25 (RDS must reject internet connections) and is easy to forget open. |
| AWS Client VPN | Fixed hourly cost per association (about 0.10 USD per hour) plus per connection, and certificates to manage. |
| Run admin commands only as one-off ECS tasks | Good for scripted jobs (migrations and seed, US-25), but awkward for interactive checks such as `psql`. |

## Consequences
- Cost while it exists: about 0.004 USD per hour for the instance plus about 0.03 USD per hour for the three SSM interface endpoints.
- Each person needs AWS CLI v2 and the Session Manager plugin installed.
- Without a NAT Gateway the instance cannot install packages from the internet; port forwarding needs nothing installed on it.
- Usage and shutdown are documented in *Infrastructure → Admin instance*.
