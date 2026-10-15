# Requirements — Enterprise Procurement and Order Management Platform

Status: Draft, Phase 0 Step 2
Companion documents: [security-matrix.md](security-matrix.md), [architecture.md](architecture.md) (Step 3)

---

## 1. Business context

A company buys goods from approved suppliers. Today the process runs on email and
spreadsheets: there is no reliable record of who ordered what, who approved it, or
why. The platform replaces that with a single system of record for purchase
orders, with approval enforced by the application rather than by convention.

## 2. Actors

| Actor | Who they are | What they fundamentally do |
| --- | --- | --- |
| **Employee** | Any staff member who needs to buy something | Raises purchase orders and tracks their own |
| **Manager** | Line manager with spending authority | Approves or rejects orders raised by others |
| **Administrator** | Procurement / master data team | Maintains suppliers, products and employee records |
| **Technical user** | A machine, not a person | Service-to-service calls (deferred to Step 43) |

Note that a Manager is also an Employee — managers raise their own orders too.
This is modelled by composing role collections, not by duplicating permissions.
See [security-matrix.md](security-matrix.md).

## 3. Domain entities

| Entity | Purpose | Owned by |
| --- | --- | --- |
| `Suppliers` | Approved vendors we may buy from | Administrator |
| `Products` | Catalogue of purchasable items, with list price | Administrator |
| `Employees` | Staff, their manager, and cost centre | Administrator |
| `PurchaseOrders` | The order header: who, when, which supplier, status | Employee |
| `PurchaseOrderItems` | Line items: product, quantity, price | Employee |
| `AuditLog` | Append-only record of significant business actions | System |

`PurchaseOrderItems` has no life of its own — delete the order and the items go
with it. `Suppliers` and `Products` outlive any order that references them. That
distinction is what drives the composition-versus-association modelling in
Step 14.

## 4. Order lifecycle

```
            submit              approve
  Open  ──────────────>  Submitted  ──────────────>  Approved
   │                         │
   │                         │  reject
   │                         └──────────────────────>  Rejected
   │                         │
   │  cancel                 │  cancel
   └─────────────────────────┴──────────────────────>  Cancelled
```

- `Approved`, `Rejected` and `Cancelled` are **terminal**. Nothing leaves them.
- Only `Open` orders are editable.
- A rejected order is not reopened; the employee raises a new one. This keeps the
  audit trail honest about what was actually decided.

### Naming decision you need to confirm

The original plan called the first state `Draft`. I have renamed it **`Open`**,
because CAP has its own concept called *draft* — the `IsActiveEntity` mechanism
that lets a user edit a record over several requests before saving it (Step 23).

These are two unrelated things:

- **CAP draft** = an *editing* state. Technical. "This record is being typed."
- **Business status** = a *process* state. Functional. "This order awaits approval."

An order can be `Open` and simultaneously have an unsaved CAP draft. Calling both
"draft" guarantees confusion in code review, in tests and in the handlers at
Step 22. Say the word if you would rather keep `Draft` and I will change it back.

## 5. Core workflows

**W1 — Raise an order (Employee)**
Create order → add line items → system validates quantity and price → submit.
Status moves `Open` → `Submitted`. The order becomes read-only to its creator.

**W2 — Approve or reject (Manager)**
Manager sees orders awaiting approval → opens one → approves or rejects with a
reason. Status moves to `Approved` or `Rejected`. **A manager may not approve an
order they raised themselves.**

**W3 — Cancel (Employee or Administrator)**
An employee cancels their own order while it is `Open` or `Submitted`.
An administrator cancels any non-terminal order.

**W4 — Maintain master data (Administrator)**
Full create, read, update and delete on suppliers, products and employees.

**W5 — Audit (System)**
Every status transition and every master data change is written to `AuditLog`
with actor, timestamp, entity, old value and new value. Append-only — no one
can edit or delete audit records, including administrators.

## 6. Business rules

| # | Rule | Enforced at |
| --- | --- | --- |
| BR1 | Quantity must be a positive integer | Step 21 |
| BR2 | Price must be non-negative; currency required when price is set | Step 21 |
| BR3 | An order must have at least one line item before it can be submitted | Step 22 |
| BR4 | Only transitions on the Step 4 diagram are permitted | Step 22 |
| BR5 | Only `Open` orders may be edited or deleted | Step 22 / Step 25 |
| BR6 | A manager cannot approve their own order | Step 25 (instance-level) |
| BR7 | Rejection requires a reason | Step 21 |
| BR8 | A supplier or product in use cannot be hard-deleted | Step 21 |

BR6 is the interesting one. It cannot be expressed as "does this user hold the
Manager scope?" — it depends on the *row being acted on*. That is the difference
between static and instance-based authorization, and it is the single most
useful thing in this project for learning goal 1.

## 7. Non-functional requirements

| # | Requirement | Where it is satisfied |
| --- | --- | --- |
| NFR1 | Every endpoint authenticated; no anonymous access | Step 25, Step 40 |
| NFR2 | Authorization enforced at the backend, never only in the UI | Step 25, proven in Step 41 |
| NFR3 | No secrets in source, workflow files or logs | Step 8, Step 55 |
| NFR4 | All business actions auditable, audit records immutable | Step 20, W5 |
| NFR5 | Structured logs with a correlation ID per request | Step 59, Step 60 |
| NFR6 | Service is stateless, so Cloud Foundry can scale it horizontally | Step 47 |
| NFR7 | Personal data in `Employees` annotated for data privacy | Step 15 |
| NFR8 | All user-facing text externalised for translation | Step 12 |
| NFR9 | Every change reaches production through CI — no manual deploys to prod | Step 58 |
| NFR10 | A failed deployment can be rolled back with a documented procedure | Step 52 |

Deliberately **not** requirements here: high availability targets, response-time
SLAs and load figures. They would be invented numbers on a learning project, and
inventing them teaches the wrong habit. Section 5 of the plan lists what is out
of scope and why.

## 8. Assumptions

- A single tenant. One company, one subaccount.
- Users and their manager relationships already exist in the identity provider;
  we do not build user management.
- One currency per order. No FX conversion.
- Approval is a single step. No multi-level or value-threshold approval chains —
  that is where SAP Build Process Automation would earn its place (Step 63).

## 9. Resolved questions

| # | Question | Answer (2026-10-15) |
| --- | --- | --- |
| OQ1 | BTP trial, or company subaccount? | **Trial.** Constraints recorded in §10 below |
| OQ2 | Keep `Open`, or revert to `Draft`? | **Keep `Open`.** D1 stands |
| OQ3 | Should an Administrator approve orders? | **No.** Separation of duties confirmed; ADR 002 accepted |

## 10. Target environment constraint: BTP trial

The deployment target is a **BTP trial account**, not a company subaccount. This
is a hard architectural constraint, not an inconvenience, and it shapes Phases 6,
7 and 9.

| Constraint | Consequence for this project |
| --- | --- |
| 90-day total account lifespan, extended in 30-day steps | Everything must be re-creatable from this repository. Nothing may exist only as a click in the cockpit |
| Applications stop automatically every day | Phase 6 onward starts each session with a restart. Needs a documented procedure, and smoke tests (Step 57) must tolerate a cold start |
| HANA instance stops nightly; deleted after 30 days without a restart | Reinforces deferring HANA to Phase 6. Restart discipline becomes an operational habit, which is the lesson |
| 4 GB application memory, 10 routes, 40 service instances | The MTA at Step 47 must be sized deliberately. Default module memory will not be accepted blindly |
| CF Runtime must use the **free** plan, not Standard | Checked at Step 6 before provisioning |
| `hana-free` plan is not available in every region | Region must be verified at Step 6, not assumed |
| SAP Build Process Automation, Application Logging likely not entitled | Confirms Phase 9 (Steps 63–65) as genuinely optional. Alternatives documented instead |

The 90-day clock turns "the repository is the memory" into something stronger:
**the repository is also the infrastructure.** If the account is lost, `mta.yaml`,
`xs-security.json` and the deployment scripts must be enough to rebuild
everything. That is good practice on a paid account and a survival requirement
on a trial one.

## 11. Open questions

| # | Question | Needed by |
| --- | --- | --- |
| OQ4 | How many days remain on the trial account? | Step 6 — determines Phase 6 scheduling |
| OQ5 | Which region is the trial subaccount in? | Step 6 — `hana-free` availability varies |
