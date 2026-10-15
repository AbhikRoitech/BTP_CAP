# Security matrix — roles, scopes and permissions

Status: **Complete, awaiting review** (Phase 0 Step 2)
Decisions behind this file: [ADR 002](adr/002-authorization-model.md)

This document is the single source of truth for authorization. It becomes:

- `@requires` / `@restrict` annotations — **Step 25**
- `xs-security.json` scopes, role templates, role collections — **Step 37**
- the authorization test cases — **Step 27**

If this table and the code ever disagree, this table is wrong until proven
otherwise — fix it in the same commit.

---

## Legend

| Symbol | Meaning |
| --- | --- |
| `C` `R` `U` `D` | Create, Read, Update, Delete |
| `—` | No access at all |
| `own` | Only rows where the current user is the creator |
| `team` | Only rows belonging to the user's direct reports |
| `all` | Every row |
| `+ where(...)` | Permitted, but narrowed by an instance-level condition |

**Static vs instance-based** — the distinction from ADR 002, and the thing this
matrix is really teaching:

- A plain `R` / `C` / `U` / `D` is answered by a **scope in the JWT**. Free to check.
- Anything carrying `own`, `team` or `+ where(...)` is answered by a **`where`
  clause against the database**. Costs a query. Expressive, but not free.

---

## Role collections

| Role collection | Role templates | Assigned to |
| --- | --- | --- |
| `Procurement_Employee` | `Employee` | All staff |
| `Procurement_Manager` | `Employee` + `Manager` | Line managers |
| `Procurement_Administrator` | `Admin` | Procurement / master data team |

Because `Procurement_Manager` contains **both** templates, the Manager column
below records only what a manager can do **in addition** to an Employee.

---

## Entity permissions

| Entity | Employee | Manager | Admin |
| --- | --- | --- | --- |
| `Suppliers` | `R` all | (inherits) | `C R U D` all |
| `Products` | `R` all | (inherits) | `C R U D` all |
| `Employees` | `R` own | `R` own + team | `C R U D` all |
| `PurchaseOrders` | `C`; `R` own; `U` own `+ where(status='Open')`; `D` own `+ where(status='Open')` | (inherits) + `R` all | `R` all |
| `PurchaseOrderItems` | *via parent* | *via parent* | *via parent* |
| `AuditLog` | `—` | `—` | `R` all |

### Why each row is what it is

**`Suppliers`, `Products` — `R all` for everyone.**
You cannot raise an order against a supplier you are not allowed to see. Read
access to the catalogue is a precondition of the main workflow, so it is not
restricted. Admin gets `D`, but BR8 still blocks deleting a supplier in use —
**authorization and validation are different layers.** Authorization asks *may
this user attempt this?* Validation asks *is this operation legal right now?*
Both must pass. Merging them is a common and expensive mistake.

**`Employees` — `R own` / `R own + team` / full CRUD.**
This table holds personal data (NFR7), so the default is the narrowest thing
that still lets the workflows run. An employee needs their own record for cost
centre and manager. A manager needs their direct reports, to know whose orders
they are responsible for. Nobody needs the whole staff directory to buy a laptop.

There is a gap here that this matrix cannot express, and it is the answer to the
Step 2 negative test: **a manager has `R` on a team member's row, but should not
see every field of it.** Salary, home address and national ID are not needed to
approve a purchase order. Row-level access is not field-level access. That is
what `@PersonalData` and field-level annotations address in Step 15.

**`PurchaseOrders` — the busiest row.**
- Employee gets `C` outright: raising orders is the whole point.
- `R own` — you see your own orders.
- `U` and `D` are narrowed **twice**: by ownership *and* by status. Once an order
  is submitted it is out of the employee's hands. This is where BR5 becomes a
  `where` clause rather than handler code.
- Manager adds `R all`, because you cannot approve what you cannot read. Manager
  keeps Employee's `C` through role collection composition — managers buy things
  too, and we did not have to write that down twice. That is D2 earning its keep.
- Admin gets `R all` and nothing else. **No `C`** — an admin raising an order on
  someone else's behalf would make `createdBy` a lie and poison BR6. **No `U`,
  no `D`** — orders are business records; an admin who can quietly edit or delete
  one defeats the audit trail. Admin influences orders only through the `cancel`
  action, which is recorded.

> Simplification taken deliberately: Manager gets `R all` rather than `R team`.
> Team-scoping is the enterprise variant and would need the `Employees` manager
> hierarchy walked on every read. Noted as a known narrowing point, not built.

**`PurchaseOrderItems` — *via parent*, and this is the point.**
Items are a **composition**: they have no life without their order. They are not
exposed as a standalone entity in the service, so they are only reachable by
navigating from `PurchaseOrders`. Permissions are therefore inherited from the
parent and are not restated here.

This is the direct consequence of the Step 14 modelling choice. Had items been
an **association** — independently addressable — they would need their own row
in this table, their own `@restrict`, and their own tests, and a bug in any of
those would be a hole. Composition is not just a data-modelling convenience; it
collapses an entire authorization surface.

**`AuditLog` — the row with no `C`.**
W5 says append-only and immutable, *including for administrators*. So:
no `C`, no `U`, no `D` for **any** role. Admin gets `R` only.

Which raises the question the exercise was really asking: if no human role can
create an audit record, who writes them?

**The service writes them, beneath the service layer.** The entity is exposed as
`@readonly`, so no OData request can ever insert into it. The audit rows are
written by handler code going straight to the database layer inside the same
transaction as the business change. CAP's service-level authorization does not
apply to that path, because it is not a service request.

The lesson generalises: **`@restrict` protects the service, not the database.**
That is usually exactly what you want — but it also means any code holding a
database connection is inside the trust boundary. Who may write to the database
directly is a code-review question, not an annotation question.

---

## Action permissions

| Action | Employee | Manager | Admin | Precondition |
| --- | --- | --- | --- | --- |
| `submit` | ✅ `own` | (inherits) | — | `status = 'Open'` and order has ≥ 1 item (BR3) |
| `approve` | — | ✅ | — | `status = 'Submitted'` **and** `where createdBy <> $user` (BR6) |
| `reject` | — | ✅ | — | `status = 'Submitted'` **and** `where createdBy <> $user` (BR6); reason required (BR7) |
| `cancel` | ✅ `own` | (inherits) | ✅ `all` | Employee: `status in ('Open','Submitted')`. Admin: `status not in ('Approved','Rejected','Cancelled')` |

### Why

**`approve` / `reject` — Admin is barred.** This is ADR 002's separation of
duties, stated in one sentence: *whoever decides which suppliers we may buy from
must not also approve the money spent with them.* An admin who genuinely needs
to approve is granted `Procurement_Manager` as well — a visible, deliberate,
auditable grant rather than a silent capability.

**`approve` / `reject` carry the only true instance-level rule in the project.**
`createdBy <> $user` cannot be answered from the token. Two managers hold
identical scopes and get different answers for the same order. The scope check
says *may you approve orders* — the `where` clause says *may you approve **this**
order*. Step 25 implements it, Step 27 tests it, Step 41 proves it against a real
JWT.

**`cancel` has two different preconditions, by design.** An employee may pull
back their own order while it is still in flight (`Open` or `Submitted`). An
admin may cancel anyone's order, but only while it is non-terminal — an
`Approved` order is a commitment and cancelling it is a different business
process we are not modelling. Same action name, two different rules, selected by
the caller's role. Worth noticing now: this is why the action handler cannot be a
single `if` statement.

---

## Negative test cases

Every row above implies a test that something is **refused**. These become
automated tests in Step 27 and are re-proven against real JWTs in Step 41.

| # | Attempt | Expected |
| --- | --- | --- |
| 1 | Employee calls `approve` on another employee's order | **403** — no Manager scope |
| 2 | Manager calls `approve` on an order they created themselves | **403** — BR6, instance-level |
| 3 | Admin calls `approve` on any order | **403** — separation of duties, ADR 002 |
| 4 | Employee calls `PATCH` on their own order while `status='Submitted'` | **403** — `where(status='Open')` fails |
| 5 | Any role calls `POST` or `DELETE` on `AuditLog` | **403** — `@readonly`, no role has `C`/`D` |
| 6 | Employee reads another employee's `PurchaseOrder` by direct key | **404 or empty** — not 403 |
| 7 | Unauthenticated request to any endpoint | **401** — NFR1 |

**Why #6 is a 404 and not a 403.** An instance-level `where` clause does not
reject the request — it narrows the query, and the row simply is not in the
result set. The user is told the order does not exist, not that they are
forbidden from seeing it. That is the correct behaviour: a 403 would confirm the
order exists, leaking information through the error code. Expect this to be a
genuine surprise when testing, and do not "fix" it into a 403.

**A permission that is never tested negatively is a permission you do not
actually have.** Every one of these is a real test, not a note.

---

## Known narrowings, recorded not built

| Item | Why deferred |
| --- | --- |
| Manager `R team` instead of `R all` on orders | Needs the manager hierarchy walked per read. Enterprise variant |
| Field-level restriction on `Employees` | Addressed by `@PersonalData` in Step 15, not by this matrix |
| Value-threshold approval chains | Out of scope per plan §5; the case for SBPA at Step 63 |
