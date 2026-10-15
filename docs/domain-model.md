# Domain model and service boundaries

Status: Phase 0 Step 4
Implemented in: Phase 2 (Steps 12–18) and Phase 3 (Step 19)
Companions: [requirements.md](requirements.md), [security-matrix.md](security-matrix.md), [ADR 003](adr/003-service-boundaries.md)

This is the blueprint Phase 2 builds from. Nothing here is code yet — but every
field, type and relationship below becomes a line of CDS, so it is worth
disagreeing with now rather than in Step 13.

---

## 1. Functional modules

| Module | Owns | Consumed by |
| --- | --- | --- |
| **Master Data** | `Suppliers`, `Products`, `Employees` | Administrators maintain; everyone reads |
| **Procurement** | `PurchaseOrders`, `PurchaseOrderItems`, `OrderStatus` | Employees and Managers |
| **Audit** | `AuditLog` | Written by the system, read by Administrators |

These are **modules inside one CAP application**, not separate deployables.

### Why not microservices

Three services would mean three Cloud Foundry apps, three sets of bindings,
network calls where there are currently joins, and distributed transactions
across a purchase order and its audit record. The trial's 4 GB memory and 10
routes would also notice.

Separate services become justified when one of these is true, and none is:

- A module needs to **scale independently** — procurement traffic spikes while
  master data stays flat.
- A module has a **different release cadence** or a different owning team.
- A module needs **different availability guarantees**.
- A module must be **reused by a different application**.

The honest version: start modular inside one deployable, and split only when a
specific pressure forces it. Splitting is a one-way door that is cheap to delay
and expensive to reverse. Modules kept clean today make that split tractable
later — which is the actual reason to care about module boundaries now.

---

## 2. Entities

CAP's built-in aspects from `@sap/cds/common` do a lot of the work:

- **`cuid`** — adds `ID : UUID` as the key.
- **`managed`** — adds `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy`,
  filled automatically. **`createdBy` is what BR6 compares against `$user`.**
- **`Currency`**, **`Country`** — code-list types with built-in value help.

### `Suppliers`

| Field | Type | Notes |
| --- | --- | --- |
| `ID` | UUID | via `cuid` |
| `name` | String(100) | mandatory |
| `email` | String(100) | |
| `phone` | String(30) | |
| `street`, `city`, `postalCode` | String | |
| `country` | `Country` | code list, built-in |
| `isActive` | Boolean, default `true` | **how BR8 is really satisfied** |
| `products` | Association to many `Products` | unmanaged, on-condition |
| *(managed)* | | created/modified tracking |

`isActive` matters more than it looks. BR8 says a supplier in use cannot be
hard-deleted. The resolution is not to block the delete and leave the user
stuck — it is to **deactivate**. Active suppliers appear in value help; inactive
ones keep historical orders readable. Deletion stays available only for
suppliers never referenced.

### `Products`

| Field | Type | Notes |
| --- | --- | --- |
| `ID` | UUID | via `cuid` |
| `name` | String(100) | mandatory |
| `description` | String(1000) | |
| `category` | String(50) | |
| `listPrice` | Decimal(11,2) | the catalogue price |
| `currency` | `Currency` | |
| `unitOfMeasure` | String(3) | EA, KG, BOX |
| `supplier` | Association to `Suppliers` | mandatory, managed |
| `isActive` | Boolean, default `true` | same reasoning as suppliers |

`listPrice` is the catalogue price. The order item carries its **own**
`unitPrice`, copied at the time of ordering. If the catalogue price changes next
month, last month's order must not silently change with it. Copying a value that
could be looked up is correct here — the order records what was agreed, not what
is currently advertised.

### `Employees`

| Field | Type | Notes |
| --- | --- | --- |
| `ID` | UUID | via `cuid` |
| `userId` | String(60) | **the link to the identity in the JWT** |
| `firstName`, `lastName` | String(50) | personal data |
| `email` | String(100) | personal data |
| `costCenter` | String(10) | |
| `manager` | Association to `Employees` | self-association |

**`userId` is the most important field in this model.** The JWT gives CAP a user
identity in `$user` — typically an email or a login name. The domain knows
employees by `ID`. `userId` is the join between the two worlds, and without it
"is this order mine?" cannot be answered.

Everything the authorization model does rests on this one column:

```
  JWT  ──►  $user  ──►  Employees.userId  ──►  Employees.ID  ──►  PurchaseOrders.createdBy
```

Personal data (`firstName`, `lastName`, `email`) gets `@PersonalData` annotations
in Step 15. That is where the field-level gap the security matrix could not
express finally gets closed.

The `manager` self-association is also what a future `R team` restriction would
walk — recorded as a known narrowing, not built.

### `OrderStatus` — a code list, not an enum

| Field | Type | Notes |
| --- | --- | --- |
| `code` | String(10), key | `OPEN`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `name`, `descr` | localized String | via `sap.common.CodeList` |
| `criticality` | Integer | drives Fiori colour coding |

A CDS `enum` would be simpler, so this choice needs defending:

- A code list is a **table**, so status names translate through the same i18n
  mechanism as everything else (NFR8).
- Fiori Elements generates **value help** from a code list automatically. An
  enum does not get that.
- `criticality` lets the List Report colour `APPROVED` green and `REJECTED` red
  with no custom UI code at all — Step 31 gets that for free.

The cost is one more table and one more CSV file. Worth it.

### `PurchaseOrders`

| Field | Type | Notes |
| --- | --- | --- |
| `ID` | UUID | via `cuid` |
| `orderNumber` | String(20) | human-readable, generated on create |
| `supplier` | Association to `Suppliers` | mandatory |
| `status` | Association to `OrderStatus` | default `OPEN` |
| `orderDate` | Date | |
| `requestedDeliveryDate` | Date | |
| `totalAmount` | Decimal(11,2) | **calculated** from items — Step 24 |
| `currency` | `Currency` | |
| `notes` | String(1000) | |
| `rejectionReason` | String(500) | **required on reject** — BR7 |
| `approvedBy` | Association to `Employees` | who decided |
| `approvedAt` | Timestamp | when |
| `items` | **Composition** of many `PurchaseOrderItems` | cascade delete |
| *(managed)* | | **`createdBy` drives BR6** |

`orderNumber` exists because `ID` is a UUID and no human will ever read one
aloud. Users need something to quote in an email.

`approvedBy` and `approvedAt` are stored on the order even though `AuditLog`
records the same transition. That duplication is deliberate: the order should
answer "who approved this?" without a join into the audit table, and the audit
table must remain the independent record.

### `PurchaseOrderItems`

| Field | Type | Notes |
| --- | --- | --- |
| `ID` | UUID | via `cuid` |
| `order` | Association to `PurchaseOrders` | the back-link of the composition |
| `position` | Integer | 10, 20, 30 |
| `product` | Association to `Products` | mandatory |
| `quantity` | Integer | mandatory, > 0 — BR1 |
| `unitPrice` | Decimal(11,2) | copied from the product at creation |
| `currency` | `Currency` | |
| `totalPrice` | Decimal(11,2) | calculated: `quantity × unitPrice` |

### `AuditLog`

| Field | Type | Notes |
| --- | --- | --- |
| `ID` | UUID | via `cuid` |
| `timestamp` | Timestamp | |
| `user` | String(60) | the `$user` who acted |
| `action` | String(30) | `SUBMIT`, `APPROVE`, `REJECT`, `CANCEL`, `CREATE`, `UPDATE`, `DELETE` |
| `entityName` | String(50) | which entity |
| `entityKey` | String(36) | which row |
| `oldValue` | LargeString | JSON |
| `newValue` | LargeString | JSON |

No `managed` aspect here. `managed` implies modification tracking, and this
entity is never modified. Adding `modifiedAt` to an append-only table would
invite someone to use it.

---

## 3. Relationships

```
   Suppliers ──1:N──► Products
       │                  │
       │ assoc            │ assoc
       ▼                  ▼
   PurchaseOrders ──1:N──► PurchaseOrderItems
       │   ▲                      COMPOSITION
       │   │ assoc                (cascade delete)
       │   └── OrderStatus (code list)
       │
       └── assoc ──► Employees ──┐
                         ▲       │ manager
                         └───────┘ self-association
```

| From | To | Kind | Why |
| --- | --- | --- | --- |
| `PurchaseOrders` | `PurchaseOrderItems` | **Composition** | Items have no life without the order. Delete the order, delete the items |
| `PurchaseOrderItems` | `Products` | Association | The product existed before this item and survives it |
| `PurchaseOrders` | `Suppliers` | Association | Same |
| `PurchaseOrders` | `OrderStatus` | Association | Code list |
| `Products` | `Suppliers` | Association | Managed — CAP generates `supplier_ID` |
| `Suppliers` | `Products` | Association to many | **Unmanaged** — needs an explicit `on` condition |
| `Employees` | `Employees` | Association | Self, for the manager hierarchy |

### Managed vs unmanaged, concretely

```cds
// MANAGED — CAP creates the foreign key column supplier_ID for you
supplier : Association to Suppliers;

// UNMANAGED — you write the join. No column is generated.
products : Association to many Products on products.supplier = $self;
```

A to-one association can be managed. A **to-many association is always
unmanaged**, because the foreign key lives on the other table — there is nothing
for CAP to generate on this one. That is the rule, and it is why
`Suppliers.products` is the unmanaged example the plan asks for in Step 14.

### Why composition matters beyond cascade delete

Three consequences follow from making items a composition, and only the first is
the obvious one:

1. **Cascade delete.** Deleting an order deletes its items in one transaction.
2. **Draft handling.** A CAP draft covers the composition tree. Editing an order
   and its items is **one** draft, saved atomically — exactly the behaviour a
   user expects from a document with line items. Associations do not give this.
3. **Authorization surface.** Items are reachable only by navigating from the
   order, so they inherit the order's `@restrict`. As the
   [security matrix](security-matrix.md#entity-permissions) records, that
   removes an entire row from the permissions table — and with it, an entire
   class of hole.

Point 3 is the one people miss. Composition is not only a data-modelling
convenience; it collapses an authorization surface.

---

## 4. Service boundaries

Two services. Full reasoning in [ADR 003](adr/003-service-boundaries.md).

### `ProcurementService` — for Employees and Managers

| Exposed as | Source | Projection |
| --- | --- | --- |
| `PurchaseOrders` | `PurchaseOrders` | full, **draft-enabled** |
| `PurchaseOrderItems` | — | reachable **only** via the composition |
| `Suppliers` | `Suppliers` | `@readonly`, active only |
| `Products` | `Products` | `@readonly`, active only |
| `OrderStatus` | `OrderStatus` | `@readonly` |
| `MyProfile` | `Employees` | `@readonly`, the current user's row only |

Actions: `submit`, `approve`, `reject`, `cancel` — bound to `PurchaseOrders`.

### `AdminService` — for Administrators

| Exposed as | Source | Projection |
| --- | --- | --- |
| `Suppliers` | `Suppliers` | full CRUD |
| `Products` | `Products` | full CRUD |
| `Employees` | `Employees` | full CRUD |
| `PurchaseOrders` | `PurchaseOrders` | **`@readonly`** |
| `AuditLog` | `AuditLog` | **`@readonly`** |

Action: `cancel` only. No `approve` or `reject` — separation of duties, ADR 002.

### The lesson hiding in those two tables

`Suppliers` appears **twice**: read-only in one service, full CRUD in the other.
Same database entity, two service projections, two permission sets.

This is the thing to take from Step 4:

> **The database entity is not the API. The service projection is.**
> Authorization is shaped at the service layer, not the persistence layer.

It is also why the database entities are never exposed directly, and why Step 19
spends time on projections rather than treating them as boilerplate. An admin
and an employee are not using "the Suppliers table with different filters" —
they are using two different APIs that happen to share storage.

---

## 5. What Phase 2 builds from this

| Step | Builds |
| --- | --- |
| 12 | Aspects, types, `_i18n` keys for every label above |
| 13 | The six entities |
| 14 | The relationships, managed and unmanaged |
| 15 | Keys, constraints, `OrderStatus` code list, `@PersonalData` on `Employees` |
| 16 | CSV seed data for all six |
| 19 | The two services and their projections |

## 6. Resolved questions

| # | Question | Answer (2026-10-15) |
| --- | --- | --- |
| OQ6 | Is `MyProfile` needed in v1? | **Yes.** `ProcurementService` exposes `MyProfile` as a read-only projection of `Employees` restricted to `userId = $user` |

`MyProfile` is a small entity with a large lesson: it is the first projection
whose *entire purpose* is an instance-level restriction. There is no scope called
"may read own profile" — every authenticated user may, but only one row each.
It is the simplest possible example of the `where` clause pattern that BR6 needs
in a harder form, which makes it a good one to implement first in Step 19.
