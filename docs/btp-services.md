# BTP services, entitlements, plans and cost

Status: Phase 0 Step 6 — **nothing provisioned**
Companions: [requirements.md §10](requirements.md#10-target-environment-constraint-btp-trial), [architecture.md](architecture.md)

Target: **BTP trial, US region.**

This document lists what the architecture needs, when each piece is first needed,
and what it costs. It provisions nothing. The last section is a checklist for you
to run in the cockpit, because entitlements are per-subaccount and the cockpit is
the only authoritative source — not this page and not SAP's documentation.

---

## 1. Services the architecture requires

Every box in [architecture.md §2](architecture.md#2-cloud-topology) that is not
our own code is a BTP service. There are seven, plus two optional.

| # | Service (entitlement name in the cockpit) | Expected plan | What it does here | First needed |
| --- | --- | --- | --- | --- |
| 1 | **Cloud Foundry Runtime** | `free` (MEMORY) | Runs `srv` and the approuter | Step 50 |
| 2 | **Authorization and Trust Management** (XSUAA) | `application` | Issues and signs JWTs; holds scopes and role templates | **Step 38** |
| 3 | **Destination** | `lite` | Routes approuter → `srv`, and Work Zone → the app | Step 51 |
| 4 | **HTML5 Application Repository** | `app-host` | Stores the built UI5 apps | Step 51 |
| 5 | **SAP Build Work Zone, standard edition** | subscription | The launchpad; tiles and role-based visibility | Step 51 |
| 6 | **SAP HANA Cloud** | `hana-free` or `trial` | The production database | **Step 45** |
| 7 | **SAP HANA Schemas & HDI Containers** | `hdi-shared` | Our isolated schema inside HANA | Step 50 |

Optional, and expected to be unavailable on trial:

| # | Service | Needed for | If missing |
| --- | --- | --- | --- |
| 8 | **Application Logging** | Step 65, log aggregation | `cf logs` plus structured logging from Step 59 covers the learning |
| 9 | **SAP Build Process Automation** | Step 63, human approval workflow | The CAP-native approval from Phase 3 already works. Document the comparison and skip |

Steps 63–65 are Phase 9 and already marked conditional in the plan. Neither is on
the path to any of your six learning goals.

### Not needed, and worth knowing why

| Service | Why not |
| --- | --- |
| **Connectivity** | Only for reaching on-premise systems through a Cloud Connector. We have none |
| **Business Application Studio** | You develop locally in VS Code. BAS is an alternative, not an addition |
| **Alert Notification** | Operational alerting is out of scope per plan §5 |
| **Credential Store** | XSUAA and service bindings cover every secret we have |

---

## 2. When each gets provisioned

Deliberately staged. This is [requirements.md §10](requirements.md#10-target-environment-constraint-btp-trial)
applied: the trial runs a 90-day clock, and HANA is reclaimed after 30 days
without a restart, so nothing is created before the step that needs it.

| When | Provision | Cost | Clock started |
| --- | --- | --- | --- |
| **Now (Step 6)** | **nothing** | — | — |
| Step 38 (Phase 5) | XSUAA instance + service key | free | none that matters |
| Step 45 (Phase 6) | **HANA Cloud** | free on trial | **nightly stop, 30-day reclaim** |
| Step 50 (Phase 6) | HDI container, via the MTA deploy | free | — |
| Step 51 (Phase 6) | Destination, HTML5 repo, Work Zone subscription | free | — |

The gap between Step 38 and Step 45 is the whole of Phase 5. That is intentional:
XSUAA is free and starts no clock, so real authentication can be learned for as
long as it takes without a database quietly expiring in the background.

**Nothing is provisioned in Step 6.** The plan requires explicit confirmation
before creating cloud resources, and Step 45 asks for it again before HANA.

---

## 3. Cost

On a trial account, every service above is **free**. The real costs are not
monetary:

| Cost | Consequence |
| --- | --- |
| 90-day account lifespan, extended in 30-day steps | Everything must be re-creatable from this repo |
| Applications stop nightly | Each Phase 6+ session starts with a restart |
| HANA stops nightly, reclaimed after 30 idle days | Restart discipline, or the schema is gone |
| 4 GB memory, 10 routes, 40 service instances | `mta.yaml` memory is sized deliberately at Step 47 |
| No SLA | A failed deploy may be the platform, not you. Check status before debugging |

For context, on a **productive** account the same landscape is dominated by HANA
Cloud — compute and memory billed per hour, by far the largest line. XSUAA,
Destination and the HTML5 repository are negligible. Work Zone is licensed
separately. The architectural lesson transfers: **the database is the expensive
part, so it is the part you size and switch off deliberately.**

---

## 4. Prerequisites before Phase 6

| # | Prerequisite | Needed by | Status |
| --- | --- | --- | --- |
| P1 | Trial subaccount exists, US region | Step 38 | to verify |
| P2 | Cloud Foundry environment enabled; org and space created | Step 49 | to verify |
| P3 | Entitlements assigned for services 1–7 | Step 38 onward | **to verify** |
| P4 | Your user has the **Space Developer** role in the space | Step 50 | to verify |
| P5 | `cf` CLI installed | Step 49 | **not installed** — deferred by design |
| P6 | Subaccount **subdomain** noted | Step 37 | to capture |
| P7 | CF **API endpoint** noted | Step 49 | to capture |

P6 and P7 are small but easy to lose an hour to later. The subdomain appears in
`xs-security.json` and the API endpoint in every `cf login` and in the CI deploy
job at Step 56.

---

## 5. Your checklist — run this in the cockpit

I cannot verify any of this. Entitlements vary by subaccount, region and the age
of the trial, and published plan names drift. The cockpit is the only source of
truth, so this is yours to run.

### A. Capture the basics

1. Open the BTP cockpit and your trial subaccount.
2. From the **Overview** page, write down:
   - **Subdomain** (P6)
   - **Region** and its technical name, e.g. `us10` (P1)
   - **Cloud Foundry API endpoint** (P7)
   - **Org name** and **Space name** (P2)

### B. Check entitlements

Go to **Entitlements → Service Assignments** and confirm each of services 1–7 is
assigned to your subaccount. For each one, record the plan name **as the cockpit
shows it** — not as this document predicts it.

If a service is missing, use **Configure Entitlements → Add Service Plans** to
add it. Trial subaccounts usually carry most of these already.

The two that most often need adding by hand:

- **SAP HANA Cloud** — check the `hana-free` plan is offered. **It is not
  available in every region**, which is why this is a verification step and not
  an assumption.
- **SAP Build Work Zone, standard edition** — a subscription rather than a
  service instance, so it may sit under a different tab.

### C. Check your role

**Security → Users** → find yourself → confirm you hold **Space Developer** on
the space. Without it, `cf push` and `cf deploy` fail at Step 50 with a
permission error that reads like a credentials problem.

### D. Report back

Paste back the plan name actually offered for each of the seven services, plus
the subdomain, region and API endpoint. Anything missing or named differently
changes `mta.yaml` at Step 47, so it is worth getting right now rather than
discovering it mid-deploy.

---

## 6. If something is not entitled

| Missing | Impact | Fallback |
| --- | --- | --- |
| **HANA Cloud** / `hana-free` | Phase 6 cannot deploy a realistic database | Try another trial region; or deploy on `@cap-js/postgres`; or deploy with SQLite to prove the pipeline and document the gap. **Learning goals 3 and 4 survive all three** |
| **Work Zone** | No launchpad | The approuter serves the apps directly. Step 51 shrinks; nothing else changes |
| **HTML5 App Repository** | UI apps cannot be deployed separately | Serve the UI from the approuter's own `resources` folder. Simpler, slightly less production-realistic |
| **Destination** | Approuter cannot resolve `srv` by destination | Use a `destinations` env var on the approuter instead. Works, less flexible |
| **XSUAA** | **Blocking.** No auth, no learning goal 1 | None. XSUAA is in every trial; if it is missing the subaccount is broken |

Only XSUAA is genuinely blocking. Every other gap has a documented route through,
which is the point of checking now rather than at Step 45.

---

## 7. What this does not cover

- Creating anything. Step 38 creates the first instance, and only after you
  confirm.
- `cf` CLI installation — Step 49, deliberately at its first point of use.
- `xs-security.json` contents — Step 37, once the subdomain from §5A is known.
- MTA resource definitions — Step 47, once the plan names from §5B are known.
