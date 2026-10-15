# Project progress

Living log. Updated at the end of every step, in the same commit as the code.
See `ClaudeCodeInstructions.md` for the full plan, and `docs/adr/` for decisions.

---

## Current position

**Phase 1 — Project foundation, Git and CI**
**Steps 7–10 DONE. Step 11 (the PR demonstration) is yours to run.**

Not committed — awaiting your review.

Still open from Phase 0: the cockpit checklist in
[btp-services.md §5](btp-services.md#5-your-checklist--run-this-in-the-cockpit).
Not blocking; first needed at Step 37.

Next: Phase 2, Step 12 — reusable aspects, types and i18n.

---

## Step log

### Phase 1, Steps 7–11 — Foundation, Git hygiene and CI (2026-10-15)

Done in one pass at your request. **Not committed** — you review and commit.

**Step 7 — CAP project initialized**

- `cds init`, then `cds add nodejs,sqlite,test`. The `test` facet skipped itself
  ("no model found"), so the harness was written by hand — see Step 9.
- `package.json`: renamed to `procurement-platform`, `engines.node: ">=22"`
  per ADR 001, six scripts, the three test users.
- `.nvmrc` → `24`, the parity contract from ADR 001. CI reads this file rather
  than hardcoding a version.
- Verified: `cds env` resolves `emma`, `max`, `admin` with the right roles, and
  the `[production]` profile switches auth to `xsuaa`.

**Step 8 — Git hygiene**

- `.gitattributes` created. `cds init`'s `.gitignore` was already good
  (`.cdsrc-private.json`, `default-*.json`, `*.sqlite`, MTA artifacts); rewritten
  tidily rather than appended to, with the secret entries commented as to *why*.
- Branch strategy: `main` is the integration branch, work on `feature/*`, merge
  by PR with CI green. Documented in `readme.md`.

**Step 9 — Lint and tests are real commands**

- ESLint 10 with CAP's shipped config. `npm run lint` → clean.
- `test/config.test.js`: **9 tests, all passing.** Each asserts a Phase 0
  decision and cites it.
- `npm run ci` = `lint && test && build`, the same gate CI runs.

**Step 10 — GitHub Actions**

- `.github/workflows/ci.yml`: checkout → setup-node → `npm ci` → lint → test →
  production build. `permissions: contents: read`. No cloud access, no secrets.
- Action versions **verified against the GitHub API**, not assumed:
  `actions/checkout@v7` (v7.0.1), `actions/setup-node@v7` (v7.1.0).

**Step 11 — the PR demonstration: yours to run.** Requires commits and a GitHub
PR, which you are doing by hand this time. Procedure in the handover notes.

**Decisions taken**

| # | Decision | Rationale |
| --- | --- | --- |
| D24 | CI runs lint → test → build only. No packaging or deploy until Phase 7 | A pipeline that deploys nothing cannot leak a secret or break an environment. ADR 004 |
| D25 | Node's built-in test runner, not Jest | Zero dependencies, native ESM. Jest needs config to handle `"type": "module"`. ADR 004 |
| D26 | **ESLint 10, not 9** | `@sap/cds@10.1.1` peers `@eslint/js@^10`, which requires `eslint@^10`. Pinning `^9` gave ERESOLVE |
| D27 | Fixed the peer conflict rather than `--legacy-peer-deps` | Suppressing a peer conflict leaves it in place for whoever next runs a clean install |
| D28 | `cds build --production` is in the gate from day one | Targets HANA, so a model that builds for SQLite but not HANA fails in seconds, not at Phase 6 deploy |
| D29 | Phase 1 tests assert **configuration**, since there is no behaviour yet | `npm test` passing while testing nothing teaches the team to ignore the gate. ADR 004 |

**Key points established**

| # | Point | Where it lands |
| --- | --- | --- |
| A19 | `cds add` facets map onto later phases: `xsuaa` (37), `approuter` (40), `hana` (46), `mta` (47), `html5-repo`/`destination`/`workzone-standard` (51) | Those steps |
| A20 | Our mocked users are **merged with** CAP's defaults, not replacing them. `alice` has lowercase `admin`, which will **not** match `@requires: 'Admin'` | Step 25 |
| A21 | `npm ci` ≠ `npm install`. `ci` installs exactly the lockfile and fails on drift | Step 54 |

**Open / deferred**

- **Step 11 outstanding** — the PR loop demonstration.
- CI triggers on `main` and `dev1`; narrows to `main` + feature branches once
  `main` is protected (your GitHub setting, not a file).
- Dependency caching deliberately absent until Step 54.
- `test/config.test.js` is a floor, replaced by service tests at Step 27.
- Phase 0's cockpit checklist still open. First needed at Step 37.

---

### Step 6 — BTP services, entitlements, plans and cost (2026-10-15)

**Done**

- Wrote [btp-services.md](btp-services.md): seven required services with expected
  plans and first-needed step, two optional ones, a staged provisioning timeline,
  cost analysis, a seven-item prerequisite list, a cockpit checklist, and a
  fallback table for anything not entitled.
- **Nothing provisioned.** Plan §5 Step 6 requires it, and no confirmation to
  provision has been sought or given.

**Decisions taken**

| # | Decision | Rationale |
| --- | --- | --- |
| D21 | Provision in stages, never up front | 90-day clock and HANA's 30-day reclaim. Nothing is created before the step that needs it |
| D22 | XSUAA at Step 38, HANA not until Step 45 | The whole of Phase 5 runs on a free service that starts no clock, so real auth can be learned without a database quietly expiring |
| D23 | Steps 63–65 (SBPA, Application Logging) confirmed out of the critical path | Neither serves any of the six learning goals. Fallbacks documented |

**Key points established**

| # | Point | Where it lands |
| --- | --- | --- |
| A16 | The database is the expensive part on trial *and* on a productive account — so it is the part you size and switch off deliberately | Step 45, Step 47 |
| A17 | Only XSUAA is genuinely blocking. Every other service has a documented fallback | Step 45, Step 51 |
| A18 | Subdomain and CF API endpoint are needed in `xs-security.json` and the CI deploy job | Steps 37, 49, 56 |

**Open — blocking Phase 0 closure**

Checklist in [btp-services.md §5](btp-services.md#5-your-checklist--run-this-in-the-cockpit)
is yours to run; entitlements are per-subaccount and cannot be verified from here.
Needed back:

- Plan name **as the cockpit shows it** for each of the seven services
- Subdomain (P6), region technical name, CF API endpoint (P7), org and space
- Confirmation of the **Space Developer** role (P4)
- Specifically: whether **`hana-free` is offered in the US region** — not
  available everywhere, and the one gap with real consequences

Phase 1 (Step 7) does not depend on any of this and can start first if preferred.

---

### Step 5 — Environments and CAP profiles (2026-10-15)

**Done**

- Wrote [environments.md](environments.md): the three environments, the profile
  mechanism, per-environment config, the three test users, secrets handling,
  what must never differ, and a debugging table.
- **Verified CAP's profile defaults against the installed 10.1.0** rather than
  writing them from memory (see below).
- Closed **OQ6 → yes**, `MyProfile` is in v1. Recorded in
  [domain-model.md §6](domain-model.md#6-resolved-questions).

**Verified facts (cds 10.1.0, this machine)**

```
cds env get requires.auth                     → kind: "mocked", users alice/bob/carol
cds env get requires.auth --profile production → kind: "jwt", vcap.label: "xsuaa"
```

Available kinds: `sqlite`, `hana`, `sql`, `mocked`, `xsuaa`, `ias`.

**Decisions taken**

| # | Decision | Rationale |
| --- | --- | --- |
| D18 | Three test users named `emma`, `max`, `admin` after their roles | Same identities from Step 25 (mocked) through Step 42 (real BTP users), so local and cloud tests compare like with like |
| D19 | Hybrid gets its own profile, used for the whole of Phase 5 | Real JWTs with local breakpoints, at zero cost — XSUAA is free, SQLite still stores |
| D20 | `.cdsrc-private.json` and `default-env.json` gitignored at Step 8 | Before Step 39 can create them. A secret committed once is in history for good |

**Key teaching points established**

| # | Point | Where it lands |
| --- | --- | --- |
| A12 | Auth switches mocked → JWT **by profile, automatically**. You configure the exceptions, not the switch | Step 7, Step 39 |
| A13 | Local roles are plain names; cloud scopes carry `$XSAPPNAME.`, which CAP strips. Same `@restrict` works in both | Step 25, Step 37 |
| A14 | `cds env get <path>` answers "what is actually configured", profile overrides included | every config step |
| A15 | Business logic and `@restrict` must be **identical** across environments; only identity source and storage differ | Step 25 onward |

**Open / deferred**

- No open questions from this step.
- Config in §3 is a blueprint; exact keys re-verified with `cds env` at Steps 7,
  20, 39 and 46 rather than trusted from the document.
- **Line endings.** Git reports `LF will be replaced by CRLF` on every file.
  Development is on Windows; CI and the Cloud Foundry buildpack are Linux.
  Step 8 must add a `.gitattributes` to normalise this — shell scripts with CRLF
  fail at deploy time with an unhelpful error.

**Workflow change (2026-10-15)**

Claude now commits and pushes the completed step as the first action of the next
step. Recorded in `ClaudeCodeInstructions.md` §6 "Commit rule". Abhik does not
commit by hand.

---

### Step 4 — Domain model and service boundaries (2026-10-15)

**Done**

- Wrote [domain-model.md](domain-model.md): three functional modules, six
  entities with full field lists, the relationship map, managed vs unmanaged
  associations, and the two service projections.
- Wrote [ADR 003](adr/003-service-boundaries.md) — two services, cut by use case
  rather than by table.

**Decisions taken**

| # | Decision | Rationale |
| --- | --- | --- |
| D10 | Two services: `ProcurementService` and `AdminService` | A CAP service is a use case, not a table. ADR 003 |
| D11 | Entities appear in both services with different projections | `Suppliers` is `@readonly` for employees, CRUD for admins. Authorization shaped structurally, not conditionally |
| D12 | `OrderStatus` is a **code list**, not a CDS enum | Translatable, generates Fiori value help, `criticality` gives free colour coding at Step 31 |
| D13 | `Employees.userId` joins the JWT identity to the domain | `$user` → `userId` → `Employees.ID` → `createdBy`. BR6 is impossible without it |
| D14 | `isActive` flags on `Suppliers` and `Products` | How BR8 is really satisfied — deactivate rather than block the delete |
| D15 | Item `unitPrice` is copied from the product, not looked up | An order records what was agreed, not today's catalogue price |
| D16 | `AuditLog` deliberately omits the `managed` aspect | `modifiedAt` on an append-only table invites someone to use it |
| D17 | One CAP app, modular inside | Splitting is a one-way door; cheap to delay, expensive to reverse. Criteria for splitting recorded |

**Key teaching points established**

| # | Point | Where it lands |
| --- | --- | --- |
| A9 | The database entity is not the API — the service projection is | Step 19 |
| A10 | A to-many association is **always** unmanaged; the FK is on the other table | Step 14 |
| A11 | Composition gives three things: cascade delete, one draft over the tree, and a collapsed authorization surface | Steps 14, 23, 25 |

**Open / deferred**

- **OQ6** — is `MyProfile` (employee reads own record) needed in v1 or deferred?
  Needed by Step 19.
- Field-level personal data protection on `Employees` still outstanding — Step 15
  closes it (carried from Step 2).

---

### Step 3 — Architecture and request flow (2026-10-15)

**Done**

- Wrote [architecture.md](architecture.md): components, cloud topology, the
  OAuth login flow, the steady-state data flow, the three environments, a
  failure-mode table, and pointers to every decision recorded elsewhere.
- Two sequence diagrams in Mermaid (render in GitHub and VS Code), one ASCII
  topology diagram (renders anywhere).

**Key points established**

| # | Point | Why it matters later |
| --- | --- | --- |
| A1 | Only the approuter has a public route; `srv` does not | The approuter is the security perimeter, not a convenience. Step 40, Step 47 |
| A2 | The browser holds a session cookie, never a JWT | The token lives in the approuter's server-side session. Step 40 |
| A3 | UI and API share a hostname, so there is no CORS config | A CORS error means a request escaped the approuter. Step 33 |
| A4 | `srv` validates the JWT itself, not trusting the approuter | Defence in depth. Step 41 |
| A5 | The JWT is a snapshot; role changes need a new token | Explains most "I have the role but get 403" tickets. Step 42 |
| A6 | `@requires` reads the token, `@restrict` writes SQL | Static vs instance-based, the core of learning goal 1. Step 25 |
| A7 | `srv` connects to HDI as a technical user, not as the end user | Row security is application-layer. Explains the `AuditLog` write path |
| A8 | `db-deployer` is a task; "stopped" is success | Avoids a false alarm at Step 50 |

**Open / deferred**

- No open questions from this step.
- `architecture.md` section 2 will need revising at Step 47 once `mta.yaml`
  fixes the real module names and memory sizing.

---

### Step 2 — Business requirements, actors, permissions, NFRs (2026-10-15)

**Done**

- Wrote [requirements.md](requirements.md): actors, entities, order lifecycle,
  five core workflows, eight business rules, ten NFRs, assumptions.
- Wrote [ADR 002](adr/002-authorization-model.md) — role model, role collection
  composition, separation of duties, static vs instance-based authorization.
  Status is **Proposed**; needs confirmation before Step 25.
- Wrote [security-matrix.md](security-matrix.md) as a **skeleton** — the Phase 0
  hands-on exercise. Two worked examples, the rest to be completed by hand.

**Decisions taken (confirm or overrule)**

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | First order status renamed `Draft` → **`Open`** | Avoids collision with CAP's own `IsActiveEntity` draft mechanism (Step 23). Two unrelated concepts, one word. |
| D2 | Role collections compose role templates | `Procurement_Manager` = Employee + Manager, so manager permissions are not duplicated |
| D3 | Administrator **cannot** approve orders | Separation of duties — whoever approves suppliers must not also approve spend against them |
| D4 | BR6 enforced as instance-level `where`, not a scope | "Not your own order" depends on the row, not the token |

**Answered 2026-10-15**

- **OQ1 → BTP trial.** Constraints recorded in [requirements.md §10](requirements.md#10-target-environment-constraint-btp-trial).
  Verified: 90-day lifespan in 30-day extensions; apps auto-stop daily; HANA stops
  nightly and is deleted after 30 days without restart; 4 GB memory, 10 routes,
  40 services; CF Runtime must use the **free** plan; `hana-free` not in all regions.
- **OQ2 → Keep `Open`.** D1 stands.
- **OQ3 → Admin cannot approve.** D3 stands. **ADR 002 promoted to Accepted.**

- **OQ4 → deferred by you.** Trial days remaining not tracked. Accepted risk:
  Phase 6 scheduling is unplanned, and the account could lapse mid-project.
  Mitigated by the rule that everything must be re-creatable from this repo.
- **OQ5 → US region.** `hana-free` plan availability still to be confirmed in the
  cockpit at Step 6; US regions generally carry it, but this is not assumed.

**Security matrix completed (2026-10-15)**

Filled by Claude at your direction, for your review. Decisions embedded in it
that are worth challenging if you disagree:

| # | Decision | Rationale |
| --- | --- | --- |
| D5 | `PurchaseOrderItems` is not exposed standalone; permissions inherit via the composition | Collapses an entire authorization surface. Direct consequence of Step 14 |
| D6 | `AuditLog` has no `C` for any role; written below the service layer | `@restrict` protects the service, not the database |
| D7 | Admin gets `R` only on `PurchaseOrders` — no `C`, `U` or `D` | Admin-created orders would make `createdBy` a lie and poison BR6 |
| D8 | Manager gets `R all` on orders, not `R team` | Deliberate simplification; team-scoping recorded as a known narrowing |
| D9 | Test #6 expects **404, not 403**, for reading another user's order | A `where` clause narrows the query rather than rejecting it; 403 would leak the row's existence |

**Carried forward**

- BR6 (manager cannot approve own order) is the designated teaching vehicle for
  instance-based authorization. Keep it visible through Steps 25, 27 and 41.
- NFR2 is proven, not asserted: Step 41 must show a direct API call being
  refused, not just a hidden button.
- Field-level restriction on `Employees` is **not** expressible in the matrix —
  row access is not field access. Step 15 must close this.

---

### Step 1 — Inspect the environment (2026-10-15)

**Done**

- Inspected OS, Node toolchain, SAP tooling, Git state and existing files.
- Verified CAP's Node requirement from the installed package rather than from
  memory, and the Cloud Foundry buildpack's Node offering from its release notes.
- Recorded the Node version policy in [ADR 001](adr/001-node-version.md).
- Created `docs/` and `docs/adr/`.

**Environment found**

| Component | Version / state | Notes |
| --- | --- | --- |
| OS | Windows 11 (10.0.22000), MINGW64 shell | |
| Node.js | v24.11.1 | CAP's recommended line |
| npm | 10.8.2 | |
| `@sap/cds-dk` | 10.1.0 (global) | bundles `@sap/cds` 10.1.0, `engines.node >=22` |
| `mbt` | 1.2.47 | Cloud MTA Build Tool, needed from Step 48 |
| `cf` CLI | **not installed** | needed from Step 49 |
| `yo` | not installed | not required; `cds init` covers scaffolding |
| Git | repo on branch `dev1`, remote `AbhikRoitech/BTP_CAP` | |
| CAP project | **none yet** | no `package.json`; created in Step 7 |

**Open / deferred**

- `cf` CLI not installed — deferred to Step 49, its first point of use.
- Buildpack Node 24 availability on our landscape unconfirmed — needs
  `cf buildpacks`, checked at Step 49 per ADR 001.
- Branch strategy undecided. Work is currently on `dev1`; the plan calls for a
  protected `main` plus feature branches. Settled in Step 8.
- No BTP subaccount / entitlement details gathered yet — Step 6.
- Fiori app generator (`@sap/generator-fiori`) not installed — needed in Phase 4,
  not before.

**Carried forward**

- cds 10 makes the native `node:sqlite` module the default SQLite driver.
  `better-sqlite3` and `sql.js` now need to be explicit dependencies.
  Relevant at Step 17 when SQLite is configured.
