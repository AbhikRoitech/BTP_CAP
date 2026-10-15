# ADR 002 — Authorization model: roles, role collections and separation of duties

Date: 2026-10-15
Status: **Accepted** — confirmed 2026-10-15

## Context

Learning goal 1 is authentication and authorization. The role model decided here
is not a document that gets filed away — it turns into working code twice:

- **Step 25** — `@requires` and `@restrict` annotations on CAP services and actions.
- **Step 37** — scopes, role templates and role collections in `xs-security.json`.

If the model is wrong, both get rewritten. So it is worth deciding properly now.

Three questions need answering:

1. How do we handle the fact that a Manager is also an Employee?
2. Can an Administrator approve orders?
3. How do we express "a manager cannot approve their own order"?

## Decision

### 1. Role collections compose; role templates do not

Define three **role templates**, each a thin bundle of scopes, and three
**role collections** that combine them:

| Role collection | Contains role templates | Given to |
| --- | --- | --- |
| `Procurement_Employee` | `Employee` | All staff |
| `Procurement_Manager` | `Employee` + `Manager` | Line managers |
| `Procurement_Administrator` | `Admin` | Procurement team |

A manager therefore holds the Employee scopes *and* the Manager scopes, and can
raise their own orders without us duplicating a single permission.

This matters beyond convenience: it is how BTP is designed to work. Role
templates are the application's vocabulary; role collections are the customer's
org chart. Keeping them separate means a customer can recompose roles without
the application changing.

### 2. An Administrator cannot approve orders

Administrators maintain master data and can read everything. They **cannot**
approve, reject or submit orders.

This is separation of duties. The person who can add a supplier to the approved
list should not also be able to approve spending with that supplier — that single
combination is the classic procurement fraud path, and it is the first thing an
SAP audit review asks about.

An administrator who genuinely needs to approve is given the
`Procurement_Manager` collection as well. That grant is visible, deliberate and
auditable, which is exactly the point.

### 3. Instance-level restriction for "not your own order"

"Manager cannot approve their own order" (BR6) is not a scope check. Two managers
hold identical scopes but get different answers for the same order, because the
answer depends on the row.

This is expressed with a `where` clause in `@restrict`, comparing the order's
creator against `$user`, not with a separate scope.

The distinction to carry forward:

- **Static authorization** — "may this user call approve at all?" → scope, in the JWT.
- **Instance-based authorization** — "may this user approve *this* order?" → `where` clause, evaluated per row against the database.

A scope lives in the token and is free to check. A `where` clause becomes part of
the SQL query and is not. That cost is the trade-off for the expressiveness.

## Alternatives considered

- **One role per user type, with all permissions inlined.** Simpler to read in
  `xs-security.json`. Rejected: the Employee permissions get duplicated into the
  Manager role, and the two copies drift the first time a permission changes.
- **Administrator as a superuser with every permission.** Common in demos and
  convenient for testing. Rejected: it destroys separation of duties, and it
  teaches a habit that fails an enterprise security review.
- **Enforce BR6 in handler code instead of `@restrict`.** Would work. Rejected
  as the primary mechanism because it scatters authorization across handlers
  where it cannot be reviewed as a whole — but note that CAP's `where` clauses
  cannot express every rule, and some logic will legitimately live in handlers.
  The rule is: declare it if it can be declared.
- **Make approval limits value-based** (e.g. above €10,000 needs a director).
  Deferred, not rejected. This is the case where SAP Build Process Automation
  earns its place, and it is revisited at Step 63.

## Consequences

- Three role templates and three role collections to define in Step 37. Each
  role collection must be assigned to a test user in Step 42, which is why Phase 5
  needs **three** test users, not one.
- BR6 forces instance-based authorization into the design early. That is the
  point — it is the most instructive part of learning goal 1.
- Separation of duties means testing needs an Administrator who is refused
  approval. That negative test is part of Step 27.
- If a value-threshold approval chain is ever wanted, this model does not stretch
  to it. That is a deliberate boundary, recorded in the plan's non-goals.
