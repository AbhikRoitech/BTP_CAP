# ADR 004 — CI scope, test runner and lint setup

Date: 2026-10-15
Status: Accepted

## Context

Phase 1 establishes the quality gate that every later phase grows. Three choices
had to be made before writing any of it: what CI runs, what runs the tests, and
what there is to test when no domain model exists yet.

The plan (§6, Phase 1) calls for CI from Step 10 rather than Phase 9, and for it
to be improved incrementally rather than written once.

## Decision

### 1. CI runs `lint → test → build`, and nothing else yet

No packaging, no deployment, no cloud credentials. Those arrive in Phase 7 once
there is something worth deploying. A pipeline that deploys nothing cannot leak
a secret or destroy an environment.

`npm run ci` runs the same three commands locally, so a developer can reproduce
the gate exactly. A green local run means a green CI run, which is the property
that stops people pushing to find out.

The production build is in the gate from day one on purpose: `cds build
--production` targets HANA, so a model that compiles for SQLite but not for HANA
fails in seconds here instead of during a Phase 6 deployment.

### 2. Node's built-in test runner, not Jest or Mocha

`node --test` with `node:assert` is enough for what this project tests, and adds
zero dependencies. Jest and Mocha both bring a large tree, and Jest additionally
needs configuration to handle ESM — this project is `"type": "module"`.

If CAP's own `cds.test` helpers are needed from Step 27, they work under
`node --test` without a runner change.

### 3. ESLint 10, using CAP's shipped config

`eslint.config.mjs` is two lines: import `@sap/cds/eslint.config.mjs`, spread
`cds.recommended`. CAP already knows what CDS and CAP projects should look like,
so writing our own rule set would be inventing opinions we do not hold.

**ESLint 10, not 9.** `@sap/cds@10.1.1` peer-depends on `@eslint/js@^9 || ^10`,
and npm resolved `@eslint/js@10`, which requires `eslint@^10`. Pinning `^9`
produced an `ERESOLVE` failure. Resolved by moving to `^10` rather than by
passing `--legacy-peer-deps`: suppressing a peer conflict leaves the conflict in
place and defers it to whoever next runs a clean install.

### 4. Phase 1 tests assert the configuration

There is no domain model, so there is no behaviour to test. There are, however,
Phase 0 decisions now encoded in `package.json` — and configuration is exactly
what gets "tidied" by someone who does not know why it is shaped that way.

`test/config.test.js` asserts nine of them, each citing the decision it guards:
the `engines` contract (ADR 001), the three test users and their roles (D18,
ADR 002, including that `admin` is **not** a Manager), the profile overrides
(A12), and the local database kind.

The production and hybrid profile overrides are asserted **against
`package.json` directly**, not by resolving a second profile in-process. CAP's
profile resolution is CAP's business and was verified by hand at Step 5. What
needs guarding is that our override blocks exist and say the right thing.

These are replaced by real service tests from Step 27 and kept as a floor.

## Alternatives considered

- **Defer CI to Phase 9**, as the original plan did. Rejected: a pipeline added
  at the end is written against a codebase it has never tested, and the first
  run finds a dozen problems at once.
- **Jest.** The CAP community default, and well documented. Rejected for this
  project: ESM configuration overhead and a large dependency tree, for features
  we do not use. Reconsider if Step 27 needs snapshot testing or sophisticated
  mocking — it is a contained change.
- **`--legacy-peer-deps` to keep ESLint 9.** Rejected; see above.
- **Custom ESLint rules.** Rejected as premature. Adopt CAP's, and add rules
  only when a real disagreement appears.
- **No tests until there is a model.** Rejected: `npm test` would then be a lie
  that passes, and CI would have a placeholder step. A gate that does not gate
  teaches the team to ignore it.

## Consequences

- CI is fast — install, lint, test, build, no cloud calls.
- The gate is reproducible locally with one command.
- `test/config.test.js` must be updated whenever a Phase 0 decision legitimately
  changes. That is the intended friction: changing it means stating that the
  decision changed.
- Node's test runner is less featureful than Jest. Accepted until proven
  limiting.
- CI currently triggers on `main` and `dev1`. The branch list narrows to `main`
  plus feature branches once `main` is protected.
- Dependency caching is deliberately absent; it arrives at Step 54 where the
  plan puts it, so the reason for it is visible when it appears.
