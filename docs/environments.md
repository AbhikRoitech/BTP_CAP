# Environments and CAP profiles

Status: Phase 0 Step 5
Implemented in: Step 7 (`package.json`), Step 20 (SQLite), Step 39 (hybrid), Step 46 (production)
Companion: [architecture.md §5](architecture.md#5-the-same-system-in-three-environments)

Three environments run the same code. This document says what differs, what must
never differ, and the mechanism CAP uses to switch between them.

---

## 1. The three environments

| | **Local** | **Hybrid** | **Cloud** |
| --- | --- | --- | --- |
| Used in | Phases 2, 3, 4 | Phase 5 | Phase 6 onward |
| Runs on | your laptop | your laptop | Cloud Foundry |
| Database | SQLite file | SQLite file | HANA via HDI |
| Auth | mocked users | **real XSUAA** | real XSUAA |
| Token | none (basic auth) | real JWT | real JWT |
| Approuter | none | local | deployed |
| Costs money | no | no | HANA does |
| Start-up | instant | seconds | minutes |

**Local** is where almost all development happens. Fast, offline, disposable.
Delete the SQLite file and you have a clean system.

**Hybrid** is the one people skip and shouldn't. Your code runs locally — with
breakpoints, with `console.log`, with instant restart — while authentication is
genuinely real: a real login, a real JWT you can decode, real scopes derived
from real role collections. It is the best place in this entire project to learn
authentication, and it is free, because XSUAA is free and SQLite is still doing
the storage.

**Cloud** is the truth. Nothing is proven until it runs here.

---

## 2. CAP profiles — the mechanism

A **profile** is a named set of configuration that CAP activates by name.
Configuration lives under `cds` in `package.json` (or in `.cdsrc.json`), and any
key can be overridden per profile with a `[profile]` block.

```jsonc
{
  "cds": {
    "requires": {
      "db": {
        "kind": "sqlite",                    // the default
        "[production]": { "kind": "hana" }   // overridden in production
      }
    }
  }
}
```

### How a profile gets activated

| How | When it applies |
| --- | --- |
| `development` | the default when nothing says otherwise |
| `production` | automatically when `NODE_ENV=production` — which Cloud Foundry sets |
| `--profile <name>` | explicitly, e.g. `cds watch --profile hybrid` |
| `CDS_ENV=<name>` | environment variable, useful in CI |

You rarely activate `production` by hand. Cloud Foundry sets `NODE_ENV=production`
in the container, CAP notices, and the `[production]` blocks take effect.

### What CAP already does for you — verified on this machine

Run against the installed `@sap/cds` 10.1.0:

```
$ cds env get requires.auth
{ "kind": "mocked", "users": { "alice": {...}, "bob": {...}, "carol": {...} } }

$ cds env get requires.auth --profile production
{ "kind": "jwt", "vcap": { "label": "xsuaa" } }
```

**Authentication switches by profile on its own.** Locally you get mocked users —
alice, bob and carol exist before you write a single line of config. In
production CAP looks for a bound XSUAA service in `VCAP_SERVICES` and validates
real JWTs.

This is the point to absorb:

> You do not configure the switch between mocked and real auth.
> You configure the **exceptions**. The switch is CAP's default behaviour.

Most CAP configuration works this way. Fighting the defaults produces long
config blocks; learning them produces short ones. `cds env get <path>` is how
you find out what the default already is — use it before writing config, not
after something breaks.

Available `kind` values on this installation: `sqlite`, `hana`, `sql`, `mocked`,
`xsuaa`, `ias`.

---

## 3. Configuration per environment

The shape Step 7 implements. Exact keys get re-verified against `cds env` at
each implementing step rather than trusted from this page.

```jsonc
{
  "cds": {
    "requires": {
      "db": {
        "kind": "sqlite",
        "credentials": { "url": "db.sqlite" },
        "[production]": { "kind": "hana", "deploy-format": "hdbtable" }
      },
      "auth": {
        "kind": "mocked",
        "users": {
          "emma":  { "roles": ["Employee"] },
          "max":   { "roles": ["Employee", "Manager"] },
          "admin": { "roles": ["Admin"] }
        },
        "[hybrid]":     { "kind": "xsuaa" },
        "[production]": { "kind": "xsuaa" }
      }
    }
  }
}
```

### The three test users

Named after the roles they carry, not after CAP's defaults, so a failing test
names its own cause:

| User | Role collection equivalent | Exists to prove |
| --- | --- | --- |
| `emma` | `Procurement_Employee` | the ordinary path, and that she cannot approve |
| `max` | `Procurement_Manager` | approval works — **and BR6 blocks his own orders** |
| `admin` | `Procurement_Administrator` | master data works, and approval is refused |

These same three identities become real BTP users with real role collections in
Step 42. Keeping the names stable from Step 25 to Step 42 means a test that
passes locally and fails in the cloud is comparing like with like.

Note the local `roles` are plain names — `Employee`, `Manager`, `Admin`. In the
cloud those same names arrive as **scopes** inside the JWT, prefixed with
`$XSAPPNAME.`. CAP strips the prefix before populating `cds.context.user.roles`,
which is why the same `@restrict` annotation works in both worlds unchanged.

---

## 4. Running each environment

### Local

```bash
cds watch
```

Serves OData and the UI from `http://localhost:4004`. Mocked users, basic auth —
log in as `emma` with any password. Same origin, so no CORS.

### Hybrid

```bash
cds bind --to <xsuaa-instance-name>     # once, writes .cdsrc-private.json
cds watch --profile hybrid
```

`cds bind` pulls the real service credentials from Cloud Foundry and stores them
locally. Your code still runs on your laptop; the tokens are real.

### Cloud

Not run by hand. Built and deployed as an MTA in Phase 6, where Cloud Foundry
sets `NODE_ENV=production` and the `[production]` blocks activate.

---

## 5. Secrets

`cds bind` writes real service credentials into **`.cdsrc-private.json`**.

**That file must never be committed.** It goes into `.gitignore` at Step 8,
before Step 39 ever creates it — the ordering is deliberate, since a secret
committed once is in the history for good.

| File | Contains | Committed? |
| --- | --- | --- |
| `package.json` | profile structure, non-secret config | yes |
| `.cdsrc.json` | additional non-secret config | yes |
| `.cdsrc-private.json` | **real service credentials** | **never** |
| `default-env.json` | a local copy of `VCAP_SERVICES` | **never** |

NFR3 says no secrets in source, workflow files or logs. This is where that rule
first has something real to protect.

---

## 6. What must never differ

| Differs by environment | Identical everywhere |
| --- | --- |
| where user identity comes from | **the business logic** |
| where rows are stored | **`@requires` and `@restrict`** |
| whether an approuter is in front | the CDS model |
| log destination and verbosity | the service projections |

The right-hand column is the one that matters. Authorization and business logic
do **not** vary by environment. If a rule only holds in production, it is not a
rule — it is an accident waiting for someone to run the code somewhere else.

This is why `@restrict` is enforced against mocked users from Step 25 and not
deferred to Phase 5. Phase 5 changes *where the identity comes from*. It does not
change *what that identity is allowed to do*.

---

## 7. Debugging by environment

| Symptom | First thing to check |
| --- | --- |
| Works locally, fails in hybrid | the user has the role collection — and has logged in **since** it was assigned |
| Works in hybrid, fails in cloud | SQLite accepted something HANA rejects. `cf logs` |
| Auth seems not to apply at all | which profile is active — `cds env get requires.auth --profile <name>` |
| `cds bind` succeeds, auth still mocked | `--profile hybrid` missing from the `cds watch` command |
| Config change has no effect | a `[profile]` block is overriding it. Check with `cds env get` |

`cds env get <path>` answers "what is actually configured right now", including
every profile override. It is the fastest debugging tool CAP ships and the least
used.

---

## 8. What each phase runs in

| Phase | Environment | Why |
| --- | --- | --- |
| 2 — domain model | local | no auth or cloud needed |
| 3 — services, authorization | local | `@restrict` against mocked users |
| 4 — Fiori and UI5 | local | understand the UI before cloud complexity |
| 5 — real authentication | **hybrid** | real JWTs, local breakpoints, zero cost |
| 6 — HANA and deployment | cloud | the first time money is spent |
| 7 — CI/CD | local + cloud | CI builds locally, CD deploys to cloud |
| 8 — observability | cloud | logs only exist there |
