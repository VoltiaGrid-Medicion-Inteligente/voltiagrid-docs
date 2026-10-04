# Contributing Guidelines — VoltaGrid Docs

> Language: [🇺🇸 English](CONTRIBUTING.md) | [🇪🇸 Español](CONTRIBUTING.es.md)

> **Note (P4):** this guide was adapted from `voltiagrid-api`. Generic workflow (branches, commits, PRs) is final.
> There is no code here — only architecture, ADRs, costs and runbooks in Markdown/Mermaid.

This guide covers the full workflow: `git clone` → setup → branch → commit → PR → review → merge.
It combines [Conventional Commits](https://www.conventionalcommits.org/) (like the CoDecide reference repo) with the team's **Jira (KAN)** workflow.

---

## 0. Prerequisites

- Git and a Markdown editor (VS Code with Mermaid preview recommended).
- A GitHub account with access to `VoltiaGrid-Medicion-Inteligente/voltiagrid-docs`.
- A Jira account. Your local git email **must match** your Jira email, otherwise Smart Commits won't link:
  ```bash
  git config user.name "Your Name"
  git config user.email "you@jira-email.com"
  ```

## 1. Clone and setup (first time only)

```bash
# HTTPS (simplest)
git clone https://github.com/VoltiaGrid-Medicion-Inteligente/voltiagrid-docs.git
cd voltiagrid-docs

# or SSH (if you use SSH keys)
# git clone git@github.com:VoltiaGrid-Medicion-Inteligente/voltiagrid-docs.git
# cd voltiagrid-docs
```

Rules:

- **Never commit secrets.** No AWS account IDs, private costs with real account numbers, credentials, or `.env` files.
- Preview Markdown + Mermaid locally before pushing (VS Code preview or GitHub web edit preview).

## 2. Branch Strategy

```
main ────────────── stable branch, PRs merge here (demo / release)
  ├── feature/KAN-12-short-description
  ├── fix/KAN-13-short-description
  ├── refactor/KAN-14-short-description
  ├── docs/KAN-15-short-description
  └── chore/KAN-16-short-description
```

### Branch Naming Convention

```
<type>/KAN-<number>-<short-description>
```

| Type | When to use | Example |
|------|-------------|---------|
| `feature/` | New functionality / user story | `feature/KAN-12-event-settlement-spec` |
| `fix/` | Bug fix | `fix/KAN-13-login-redirect-loop` |
| `refactor/` | Restructure without behavior change | `refactor/KAN-14-extract-meter-service` |
| `chore/` | Tooling, dependencies, config, CI | `chore/KAN-16-link-checker` |
| `docs/` | Documentation only | `docs/KAN-15-document-f3-simulator` |
| `test/` | Checks only | `test/KAN-16-costs-calculator-check` |

- Jira key in **UPPERCASE** (`KAN-12`, not `kan-12`) so Jira auto-links branch → issue.
- Description in **kebab-case**, short but meaningful, English preferred.
- All branches come from up-to-date `main`.

### Rules

- **Never push directly to `main`.** All changes via Pull Request.
- Any commit pushed directly to `main` will be reverted/deleted.
- One branch per Jira issue/task. If the task grows, split the issue, don't grow the branch.
- Keep `main` green: pull before branching.

Create a branch:

```bash
git checkout main
git pull origin main
git checkout -b docs/KAN-12-cost-assumptions
```

## 3. Conventional Commits + Jira

### Format

```
KAN-<number> <type>(<scope>): <description>
```

- The `KAN-XX` prefix keeps Jira automation (branch/commit/PR all linked).
- The rest follows Conventional Commits.

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Neither fix nor feature |
| `style` | Formatting only (no production change) |
| `docs` | Documentation only |
| `chore` | Build, deps, tooling, CI |
| `test` | Add/modify tests |
| `perf` | Performance improvement |

### Scopes (this repo)

Docs: `architecture`, `adrs`, `costs`, `runbook`, `demo`
Cross-cutting: `config`, `ci`, `docs`, `deps`

### Examples (copy the style)

```
KAN-12 feat(architecture): add end-to-end v1 with spark on fargate
KAN-13 fix(costs): correct s3 lifecycle assumption for 3-year retention
KAN-14 refactor(adrs): extract seed determinism adr from us-01 notes
KAN-15 docs(runbook): document reprocessing procedure for one period
KAN-16 test(costs): add calculator check pilot vs projected
KAN-15 chore(config): add markdown link checker to ci
```

### Rules

- **Jira key first, UPPERCASE** (`KAN-12`, not `kan-12`).
- **Description in English, imperative present tense:** "add" not "added"/"adds".
- **Lowercase description, no trailing period**, concise (<72 chars if possible).
- One logical change per commit. Two unrelated fixes → two commits.
- Small commits preferred. 20+ files in one commit → split it.

Good split:

```
KAN-12 feat(adrs): record rds multi-az decision with consequences
KAN-12 feat(costs): add pilot vs projected cost assumptions
```

Bad:

```
KAN-12 feat: add lots of stuff   # 35 files, 1200 additions
```

Fix a message before pushing:

```bash
git commit --amend -m "KAN-12 feat(adrs): correct message"
# if already pushed to YOUR branch only:
git push --force-with-lease
```

### Smart Commits (Jira automation)

Only works if `git config user.email` == Jira email:

```
KAN-12 #comment ready for review
KAN-12 #done
```

Use them in a separate commit or in the PR description — don't mix with code changes silently.

## 4. Pull Request Workflow

1. Update from `main`, run checks:

   ```bash
   git checkout docs/KAN-12-cost-assumptions
   git pull --rebase origin main
   # preview Markdown + Mermaid, verify relative links and TOC
   ```

2. Push and open a PR **targeting `main**:

   ```bash
   git push -u origin docs/KAN-12-cost-assumptions
   ```

3. PR title = same as commit format (Jira key + Conventional):

   ```
   KAN-12 feat(architecture): add end-to-end v1 with spark on fargate
   ```

4. PR description (required template):

   ```markdown
   ## What
   Brief description of the change.

   ## Why
   Reason + Jira issue (e.g. KAN-12).

   ## How to test
   1. Preview the Markdown + Mermaid rendering
   2. Check relative links resolve and the TOC matches the headings

   ## Screenshots / evidence (if applicable)
   ```

5. Wait for review + green CI (lint, tests, secret scan). Address comments with **new commits**, don't rewrite history under review.
6. Maintainer merges into `main` via reviewed PR (squash by default, keeping `KAN-XX` in title). `main` must always stay green and demo-ready.

### Pre-PR checklist

- [ ] Branch from latest `main`, name `type/KAN-XX-kebab-case`.
- [ ] Commits `KAN-XX type(scope): english imperative description`.
- [ ] New decisions recorded as ADRs (context, decision, consequences) — nothing decided off-record.
- [ ] Markdown + Mermaid previewed, relative links and TOC verified.
- [ ] No secrets/`.env`/credentials in diff (`git status`, `git diff --check`).
- [ ] PR targets `main`, title + template filled.

## 5. What gets your PR rejected

- Direct push to `main`.
- Missing Jira key or lowercase key (`kan-12`).
- Non-Conventional message (`added stuff`, `fix style.`, capitalised sentence).
- Giant commit, mixed concerns, or a decision merged without its ADR.
- Secrets in docs (AWS account IDs, real credentials, private cost figures).
