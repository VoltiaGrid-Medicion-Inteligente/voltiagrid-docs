# Guía de Contribución — VoltaGrid Docs

> Idioma: [🇺🇸 English](CONTRIBUTING.md) | [🇪🇸 Español](CONTRIBUTING.es.md)

> **Nota (P4):** esta guía se adaptó desde `voltiagrid-api`. El flujo genérico (ramas, commits, PRs) es final.
> Aquí no hay código — solo arquitectura, ADRs, costos y runbooks en Markdown/Mermaid.

Esta guía cubre el flujo completo: `git clone` → setup → rama → commit → PR → revisión → merge.
Combina [Conventional Commits](https://www.conventionalcommits.org/) (como el repo de referencia CoDecide) con el flujo **Jira (KAN)** del equipo.

---

## 0. Prerrequisitos

- Git y un editor Markdown (VS Code con preview de Mermaid recomendado).
- Cuenta de GitHub con acceso a `VoltiaGrid-Medicion-Inteligente/voltiagrid-docs`.
- Cuenta de Jira. Tu email local de git **debe coincidir** con el de Jira, si no los Smart Commits no enlazan:
  ```bash
  git config user.name "Tu Nombre"
  git config user.email "tu@email-jira.com"
  ```

## 1. Clonar y setup (solo la primera vez)

```bash
# HTTPS (más simple)
git clone https://github.com/VoltiaGrid-Medicion-Inteligente/voltiagrid-docs.git
cd voltiagrid-docs

# o SSH (si usas llaves SSH)
# git clone git@github.com:VoltiaGrid-Medicion-Inteligente/voltiagrid-docs.git
# cd voltiagrid-docs
```

Reglas:

- **Nunca commitees secretos.** Sin AWS account IDs, costos privados con números reales, credenciales ni archivos `.env`.
- Previsualiza Markdown + Mermaid en local antes de pushear (preview de VS Code o del editor web de GitHub).

## 2. Estrategia de Ramas

```
main ────────────── rama estable, los PRs se mergean aquí (demo / release)
  ├── feature/KAN-12-descripcion-corta
  ├── fix/KAN-13-descripcion-corta
  ├── refactor/KAN-14-descripcion-corta
  ├── docs/KAN-15-descripcion-corta
  └── chore/KAN-16-descripcion-corta
```

### Convención de Nombres

```
<tipo>/KAN-<numero>-<descripcion-corta>
```

| Tipo | Cuándo usarlo | Ejemplo |
|------|---------------|---------|
| `feature/` | Nueva funcionalidad / historia | `feature/KAN-12-event-settlement-spec` |
| `fix/` | Corrección de error | `fix/KAN-13-login-redirect-loop` |
| `refactor/` | Reestructura sin cambio de comportamiento | `refactor/KAN-14-extract-meter-service` |
| `chore/` | Herramientas, dependencias, config, CI | `chore/KAN-16-link-checker` |
| `docs/` | Solo documentación | `docs/KAN-15-document-f3-simulator` |
| `test/` | Solo validaciones | `test/KAN-16-costs-calculator-check` |

- Clave Jira en **MAYÚSCULAS** (`KAN-12`, no `kan-12`) para que Jira enlace rama → issue.
- Descripción en **kebab-case**, corta, en inglés de preferencia.
- Todas las ramas salen de `main` actualizado.

### Reglas

- **Nunca push directo a `main`.** Todo cambio por Pull Request.
- Cualquier commit directo a `main` será revertido/eliminado.
- Una rama por issue/tarea Jira. Si la tarea crece, divide el issue, no la rama.
- Mantén `main` en verde: haz pull antes de ramificar.

Crear una rama:

```bash
git checkout main
git pull origin main
git checkout -b docs/KAN-12-cost-assumptions
```

## 3. Conventional Commits + Jira

### Formato

```
KAN-<numero> <tipo>(<alcance>): <descripcion>
```

- El prefijo `KAN-XX` mantiene la automatización Jira (rama/commit/PR enlazados).
- El resto sigue Conventional Commits.

### Tipos

| Tipo | Cuándo usarlo |
|------|---------------|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de error |
| `refactor` | Ni fix ni feature |
| `style` | Solo formato (sin cambio productivo) |
| `docs` | Solo documentación |
| `chore` | Build, deps, herramientas, CI |
| `test` | Agregar/modificar tests |
| `perf` | Mejora de rendimiento |

### Alcances (scopes, este repo)

Docs: `architecture`, `adrs`, `costs`, `runbook`, `demo`
Transversales: `config`, `ci`, `docs`, `deps`

### Ejemplos (copia el estilo)

```
KAN-12 feat(architecture): add end-to-end v1 with spark on fargate
KAN-13 fix(costs): correct s3 lifecycle assumption for 3-year retention
KAN-14 refactor(adrs): extract seed determinism adr from us-01 notes
KAN-15 docs(runbook): document reprocessing procedure for one period
KAN-16 test(costs): add calculator check pilot vs projected
KAN-15 chore(config): add markdown link checker to ci
```

### Reglas

- **Clave Jira primero, en MAYÚSCULAS** (`KAN-12`, no `kan-12`).
- **Descripción en inglés, imperativa, presente:** "add" no "added"/"adds". (Traducción con WordReference si dudas: "agregar" → "add", "corregir" → "fix", "mover" → "move").
- **Minúscula inicial, sin punto final**, concisa (menos de 72 caracteres si es posible).
- Un cambio lógico por commit. Dos fixes no relacionados → dos commits.
- Commits pequeños. 20+ archivos en un commit → divídelo.

Buena división:

```
KAN-12 feat(adrs): record rds multi-az decision with consequences
KAN-12 feat(costs): add pilot vs projected cost assumptions
```

Malo:

```
KAN-12 feat: add lots of stuff   # 35 archivos, 1200 adiciones
```

Corregir un mensaje antes de pushear:

```bash
git commit --amend -m "KAN-12 feat(adrs): correct message"
# si ya pusheaste a TU rama solamente:
git push --force-with-lease
```

### Smart Commits (automatización Jira)

Solo funcionan si `git config user.email` == email Jira:

```
KAN-12 #comment listo para revisión
KAN-12 #done
```

Úsalos en un commit aparte o en la descripción del PR — no los mezcles silenciosamente con cambios de código.

## 4. Flujo de Pull Request

1. Actualiza desde `main`, corre validaciones:

   ```bash
   git checkout docs/KAN-12-cost-assumptions
   git pull --rebase origin main
   # previsualiza Markdown + Mermaid, verifica links relativos e índice
   ```

2. Pushea y abre PR **contra `main**:

   ```bash
   git push -u origin docs/KAN-12-cost-assumptions
   ```

3. Título del PR = mismo formato que el commit (clave Jira + Conventional):

   ```
   KAN-12 feat(architecture): add end-to-end v1 with spark on fargate
   ```

4. Descripción del PR (plantilla obligatoria):

   ```markdown
   ## Qué
   Descripción breve del cambio.

   ## Por qué
   Razón + issue Jira (ej. KAN-12).

   ## Cómo probar
   1. Previsualizar el render de Markdown + Mermaid
   2. Verificar que los links relativos resuelven y el índice coincide con los títulos

   ## Capturas / evidencia (si aplica)
   ```

5. Espera revisión + CI en verde (lint, tests, secret scan). Responde comentarios con **nuevos commits**, no reescribas historia bajo revisión.
6. El mantenedor hace merge a `main` por PR revisado (squash por default, manteniendo `KAN-XX` en el título). `main` siempre debe quedar en verde y listo para demo.

### Checklist pre-PR

- [ ] Rama desde `main` actualizado, nombre `tipo/KAN-XX-kebab-case`.
- [ ] Commits `KAN-XX tipo(alcance): descripción en inglés imperativa`.
- [ ] Nuevas decisiones registradas como ADRs (contexto, decisión, consecuencias) — nada decidido fuera de registro.
- [ ] Markdown + Mermaid previsualizados, links relativos e índice verificados.
- [ ] Sin secretos/`.env`/credenciales en el diff (`git status`, `git diff --check`).
- [ ] PR apunta a `main`, título + plantilla completos.

## 5. Qué hace que tu PR sea rechazado

- Push directo a `main`.
- Falta clave Jira o en minúscula (`kan-12`).
- Mensaje no-Conventional (`added stuff`, `fix style.`, oración capitalizada).
- Commit gigante, mezcla de temas, o decisión mergeada sin su ADR.
- Secretos en la docs (AWS account IDs, credenciales reales, costos privados).
