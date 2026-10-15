# ADR 003 — Service boundaries: two services, not one and not five

Date: 2026-10-15
Status: Accepted

## Context

The six entities in [domain-model.md](../domain-model.md) have to be exposed
through one or more CAP services. The choice determines where authorization is
declared, how much of it is declarative, and how much ends up as handler code.

Three constituencies use this system, and they do not overlap much:

- Employees and Managers run the procurement workflow. They need orders, and
  read-only access to the catalogue to fill them in.
- Administrators maintain master data. They need full control of suppliers,
  products and employees, and read-only visibility of orders for support.
- Nobody writes `AuditLog` through an API at all.

## Decision

**Two services:**

- **`ProcurementService`** — the workflow. Orders read-write and draft-enabled;
  catalogue read-only; the four lifecycle actions.
- **`AdminService`** — master data read-write; orders and audit read-only;
  `cancel` only.

Entities appear in **both** services where both need them, with different
projections. `Suppliers` is `@readonly` in `ProcurementService` and full CRUD in
`AdminService`.

The guiding rule: **a CAP service is a use case, not a table.** Services are cut
by who is using them and what they are trying to do, not by which entities exist.

This follows from a principle worth stating on its own:

> The database entity is not the API. The service projection is.
> Authorization is shaped at the service layer.

Projections are therefore where most authorization gets expressed. `@readonly`
on a projection is a whole class of permission that never needs a `@restrict`
clause, never needs a handler, and cannot be got wrong at runtime.

## Alternatives considered

**One service exposing everything.** Simplest to write and to route in
`xs-app.json`. Rejected because every entity would then need `@restrict` to
distinguish admin from employee access, including cases that a projection
settles for free. `Suppliers` would carry a restrict clause enumerating who may
write — instead of simply not being writable in the service employees use.
Authorization that could be structural becomes conditional, and conditional
authorization is what gets tested badly.

**Five services, one per module or per entity group.** Maximum separation.
Rejected as over-engineering: more CSRF boundaries, more routes against a
10-route trial limit, more `xs-app.json` entries, and no benefit while all of it
deploys as a single application. Note this is about *services inside one CAP
app*, which is a cheaper split than separate deployables — but still not free.

**Separate services per role** (`EmployeeService`, `ManagerService`,
`AdminService`). Tempting, because it maps to the role collections. Rejected
because Employee and Manager share almost every entity and projection; the
difference between them is four actions and one `where` clause. Two services
would be near-duplicates, and they would drift. Role differences belong in
`@restrict`, not in the service split.

**Exposing database entities directly.** Rejected outright. It couples the API
to the storage model, so every schema change becomes a breaking API change, and
it leaves no layer in which to vary permissions by consumer.

## Consequences

- `Suppliers`, `Products` and `PurchaseOrders` each appear in two services.
  Changing an entity means checking both projections. Accepted cost.
- `AdminService` is gated with a single `@requires: 'Admin'` at service level, so
  most of the admin permission model is one line rather than per-entity clauses.
- `PurchaseOrderItems` is exposed in neither service as a top-level entity. It is
  reachable only by navigation, inheriting the order's restrictions — the
  authorization-surface collapse recorded in the
  [security matrix](../security-matrix.md#entity-permissions).
- `AuditLog` is `@readonly` in the only service that exposes it, so no OData
  request can insert. Writes happen beneath the service layer, in handler code
  inside the business transaction.
- Two services means two entries in `xs-app.json` at Step 40 and two sets of
  integration tests at Step 27.
- If a third consumer appears later — a mobile app, or a supplier-facing
  portal — it gets its own service rather than new conditions bolted onto these.
  That is the extension path this decision keeps open.
