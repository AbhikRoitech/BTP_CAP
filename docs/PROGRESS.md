# Project progress

Living log. Updated at the end of every step, in the same commit as the code.
See `ClaudeCodeInstructions.md` for the full plan, and `docs/adr/` for decisions.

---

## Current position

**Phase 0 — Orientation and architecture**
**Step 1 — Environment inspection: DONE, awaiting verification**

Next: Step 2 — business requirements, actors, permissions matrix, NFRs.

---

## Step log

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
