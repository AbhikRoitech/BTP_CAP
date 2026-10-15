# Project progress

Living log. Updated at the end of every step, in the same commit as the code.
See `ClaudeCodeInstructions.md` for the full plan, and `docs/adr/` for decisions.

---

## Current position

**Phase 0 — Orientation and architecture**
**Step 5 — Environments and CAP profiles: DONE, awaiting verification.**

Next: Step 6 — required BTP services, plans, entitlements, prerequisites, cost.
Last step of Phase 0.

---

## Step log

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
