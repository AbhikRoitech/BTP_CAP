# Enterprise Procurement and Order Management Platform

An SAP CAP application on SAP BTP: suppliers, products, employees, purchase
orders and an approval workflow, with role-based access enforced at the backend.

Built step by step as a learning project. The plan is in
[`ClaudeCodeInstructions.md`](ClaudeCodeInstructions.md); the reasoning behind
every decision is in [`docs/`](docs/).

## Status

**Phase 1 complete** — project foundation, Git hygiene and CI.
No domain model yet; that is Phase 2.

Current position is always in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | `>=22`, developed on 24 | see [`.nvmrc`](.nvmrc) and [ADR 001](docs/adr/001-node-version.md) |
| `@sap/cds-dk` | 10.x | `npm i -g @sap/cds-dk` |
| `mbt` | 1.x | needed from Step 48 |
| `cf` CLI | 8.x | needed from Step 49 |

## Getting started

```bash
npm install
npm run watch
```

Then open <http://localhost:4004>.

There is no model yet, so the server starts with no services. From Phase 2 this
is where the OData endpoints appear.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run watch` | `cds watch` — restarts on change |
| `npm start` | `cds-serve` — no watching |
| `npm run lint` | ESLint, using CAP's recommended config |
| `npm test` | Node's built-in test runner |
| `npm run build` | `cds build --production` |
| `npm run ci` | **lint + test + build** — exactly what CI runs |

Run `npm run ci` before pushing. It is the same gate, so a green run locally
means a green run in GitHub Actions.

## Test users

Local development uses mocked authentication. Log in with any password:

| User | Roles | Use for |
| --- | --- | --- |
| `emma` | Employee | the ordinary path, and proving she cannot approve |
| `max` | Employee, Manager | approval — and that he cannot approve his **own** orders |
| `admin` | Admin | master data, and that approval is refused |

CAP's own defaults (`alice`, `bob`, …) still exist alongside these. Prefer the
three above — their roles match the real role collections, so a test that passes
locally means something in the cloud. See
[`docs/environments.md`](docs/environments.md).

## Environments

| | Database | Auth | Used in |
| --- | --- | --- | --- |
| local | SQLite | mocked | Phases 2-4 |
| hybrid | SQLite | **real XSUAA** | Phase 5 |
| cloud | HANA | real XSUAA | Phase 6+ |

Details in [`docs/environments.md`](docs/environments.md).

## Documentation

| Document | Contents |
| --- | --- |
| [`PROGRESS.md`](docs/PROGRESS.md) | current step, decisions, open questions |
| [`requirements.md`](docs/requirements.md) | actors, workflows, business rules, NFRs |
| [`architecture.md`](docs/architecture.md) | components, request flow, trust boundary |
| [`domain-model.md`](docs/domain-model.md) | entities, relationships, service boundaries |
| [`security-matrix.md`](docs/security-matrix.md) | roles, permissions, negative tests |
| [`environments.md`](docs/environments.md) | profiles and configuration |
| [`btp-services.md`](docs/btp-services.md) | BTP services, entitlements, cost |
| [`adr/`](docs/adr/) | architecture decision records |

## Contributing

`main` is the integration branch. Work on a feature branch and open a pull
request; CI must be green before merge.

```bash
git switch -c feature/short-description
# ... work ...
npm run ci
git push -u origin feature/short-description
```

Never commit `.cdsrc-private.json` or `default-env.json` — they hold real
service credentials. Both are in [`.gitignore`](.gitignore).
