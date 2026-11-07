---
title: ECS vs EKS
sidebar_position: 3
---

# ECS vs EKS for VoltiaGrid (US-50)

[ADR-006](../adr/adr-006-container-runtime.md) asks for one component on Kubernetes and a comparison with ECS;
[ADR-014](../adr/adr-014-runtime-adjustments.md) chose the **F5 transformer metering simulator**. In weeks 5 and 6 the
same image ran on both: as the ECS service `api-transformer-metering` of the dev stack and as the Deployment `f5` of the
EKS cluster `voltiagrid-dev-eks` (`voltiagrid-api/infra/envs/eks` and `k8s/f5`, guide in `infra/docs/EKS.md`). Same
image, port, size (0.25 vCPU, 512 MB), health check and database, so the differences below come from the orchestrator.

## 1. Cost

Prices of us-east-1 (*Costs → Monthly estimate*). F5 alone, 730 hours a month:

| Item | ECS Fargate | EKS (managed node group) |
|---|---|---|
| Control plane | 0 (included) | 0.10 USD/hour → **73.00** |
| Compute | 0.25 vCPU × 0.04048 + 0.5 GB × 0.004445 = 0.0123 USD/hour → **9.01** | 1 × t3.small 0.0208 USD/hour → **15.18** |
| Disk | 0 (20 GB of ephemeral storage included) | 20 GB gp3 of the node → **1.60** |
| Public IPv4 (no NAT, ADR-011) | 1 per task → **3.65** | 1 per node → **3.65** |
| **Total per month** | **12.66 USD** | **93.43 USD** |

EKS costs **7.4 times more** for this component; the control plane alone is 73 USD a month, more than the whole compute
of the platform's APIs. The node has room for more pods (11 fit a t3.small), so the gap shrinks as more services share
the cluster, but the control plane is a fixed cost that ECS does not have.

Test windows (the cluster exists only while it is used): one 16-hour window costs about **2.05 USD** on EKS and
**0.28 USD** on ECS. The comparison window of 2026-11-07 kept the EKS cluster for about 37 minutes: about **0.08 USD**
at the prices above (control plane 0.10 + node 0.0208 USD/hour). The figure of Cost Explorer (Amazon Elastic Kubernetes
Service + EC2 of the node) is added when AWS shows it, one or two days after the window.

## 2. Operation

| Aspect | ECS | EKS | Measured |
|---|---|---|---|
| Create the runtime | Part of `infra/envs/dev`; the cluster has no fixed resources | Own stack `infra/envs/eks`: cluster, node group, subnets, IAM, access entry | ECS: 15.4 min (the whole dev stack, reading the plan included) · EKS: 14.6 min (`terraform apply`) |
| Deploy a new image | `deploy.ps1` / the deploy workflow: new task definition revision, rolling update | `eks-deploy-f5.ps1`: kubectl apply, `rollout status` | ECS: 128 s · EKS: 130 s (until the new task or pod is healthy; the pod was Running after about 21 s, the rest is the namespace, ConfigMap, Secret and the checks) |
| Roll back | Automatic with the deployment circuit breaker, or `rollback.ps1` | `kubectl rollout undo deployment/f5` | — |
| Secrets | Task definition reads Secrets Manager directly | Secret `f5-db` created by the script from Secrets Manager (or the Secrets Store CSI driver, not installed) | — |
| Patching | None: AWS runs the hosts | Node AMI and Kubernetes version (1.35, standard support until 2027-03-27): a new version every year; extended support would cost 0.60 USD/hour, so the cluster has `upgrade_policy = STANDARD` | — |
| Access | IAM only | IAM + access entries + Kubernetes RBAC | — |
| Destroy | Part of `destroy.ps1` | `destroy-eks.ps1` (before dev: the cluster uses the dev VPC) | ECS: 5.5 min · EKS: 12.3 min |
| Tools the team needs | AWS CLI, Terraform | AWS CLI, Terraform, kubectl, YAML manifests | — |

What the team saw (window of 2026-11-07, 10:40 to 13:13): F5 answered the same on both (`/health` ok, the same 4
transformers). Creating and deploying took about the same time; destroying took more than twice as long on EKS. The
slowest step was pushing the images to ECR (about 50 minutes on a home connection), the same for both. Before the
window, Kubernetes 1.33 had to be moved to 1.35: 1.33 had left standard support and the cluster would have billed
extended support (0.60 USD/hour), a cost ECS does not have.

## 3. Scaling

| Aspect | ECS Fargate | EKS |
|---|---|---|
| Unit | Task: any size from 0.25 vCPU / 0.5 GB to 16 vCPU / 120 GB | Pod on a node: the node size limits the pod |
| More copies | `desired_count` or Application Auto Scaling on CPU or requests | `replicas` or a HorizontalPodAutoscaler (needs metrics-server) |
| More capacity | None: each task brings its own | More nodes: the node group (max 2 here) or Cluster Autoscaler / Karpenter, a few minutes per node |
| Idle cost | 0 tasks = 0 USD | The control plane and at least one node keep billing |
| At 200,000 meters | Same services with more tasks; Spark already runs one task per job | Worth it only if many services shared one cluster and the team ran Kubernetes |

## 4. Recommendation

**Keep ECS Fargate as the runtime of VoltiaGrid; use EKS only for the comparison windows and destroy it after them.**

1. **Cost:** for F5 ECS is 12.66 USD a month and EKS 93.43; the platform has fewer than ten small services, too few to
   pay back the control plane.
2. **Operation:** ECS needs no nodes, no Kubernetes upgrades and no second access model. A four-person team spends that
   time on the pipeline and the APIs.
3. **Scaling:** what VoltiaGrid has to scale (Spark jobs, API tasks) already scales on Fargate per task, with nothing
   to provision.

EKS would be the better choice if the company already ran Kubernetes for other systems, needed portability to another
cloud or on-premises, or ran dozens of services where shared nodes cost less than one task each. None of these holds
for the pilot or for the 200,000-meter target, so ADR-006 stays as it is.