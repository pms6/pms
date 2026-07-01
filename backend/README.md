# PMS Backend

REST API for the Property Management Software (PMS/HMO). Node.js + Express +
MongoDB/Mongoose. See the repo-root `DATA_MODEL.md` for the schema source of truth
and `CLAUDE.md` for conventions.

## Quick start

```bash
cd backend
cp .env.example .env        # fill in secrets
npm install
npm run start-dev           # nodemon on PORT (default 5000)
```

Health check: `GET http://localhost:5000/health`
API base: `http://localhost:5000/api/v1`

## API Reference (Postman)

Base URL for all routes below: `http://localhost:5000/api/v1`
All request/response bodies are JSON — set header `Content-Type: application/json`.

Standard success envelope:

```json
{ "success": true, "message": "...", "data": { }, "meta": { } }
```

Standard error envelope:

```json
{ "success": false, "message": "...", "details": [ ] }
```

### Auth (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Create a new Account + first admin user, returns tokens |
| POST | `/auth/login` | Public | Email + password login, returns tokens |
| POST | `/auth/refresh` | Cookie/Body | Rotate tokens — reads the `refreshToken` httpOnly cookie, or a body token |
| POST | `/auth/logout` | Public | Revokes the current session + clears the cookie (idempotent) |
| GET | `/auth/me` | Bearer | Current authenticated user's profile |
| GET | `/auth/sessions` | Bearer | List the caller's active sessions (devices) |
| DELETE | `/auth/sessions/:id` | Bearer | Revoke one of the caller's own sessions |
| POST | `/auth/logout-all` | Bearer | Revoke all the caller's sessions except the current one |

> **Token model:** the **access token** is a short-lived JWT kept in memory and
> carries `{ sub, accountId, role, sid }`. The **refresh token** is opaque
> (`sessionId.secret`) and DB-backed: each one is a `Session` document storing
> only the **SHA-256 hash** of its secret (a DB leak exposes no usable token),
> plus device metadata and a `familyId` rotation lineage.
>
> `register`/`login` set the refresh token as an `httpOnly`, `Secure` (prod),
> `SameSite` cookie scoped to `/api/v1/auth`, and also return it in the body for
> API/mobile clients. Every `/auth/refresh` **rotates** the token: the old
> session is revoked and a child is minted in the same family. Replaying an
> already-rotated token triggers **reuse detection** — the entire family is
> revoked (suspected theft). A TTL index purges expired sessions automatically.

**POST `/auth/register`** — start here, no token needed.

```json
{
  "accountName": "Sharjeel Lettings",
  "accountType": "landlord",
  "name": "Sharjeel",
  "email": "sharjeel@example.com",
  "password": "Passw0rd123"
}
```

- `accountType` optional: `landlord` | `agency` (default `landlord`)
- `password` min 8 chars
- Response `data` contains `account`, `user`, and `tokens.accessToken` / `tokens.refreshToken`.
- Copy `accessToken` — you'll paste it into the `Authorization` header for every protected route.

**POST `/auth/login`**

```json
{
  "email": "sharjeel@example.com",
  "password": "Passw0rd123"
}
```

**POST `/auth/refresh`**

```json
{
  "refreshToken": "<refreshToken from register/login>"
}
```

**GET `/auth/me`** — no body. Header: `Authorization: Bearer <accessToken>`

### Users (`/users`)

All user routes require header `Authorization: Bearer <accessToken>`.
New users are always created inside **your** account (`accountId` comes from the token, never the body).

| Method | Path | Role required | Description |
|--------|------|---------------|-------------|
| POST | `/users` | admin, manager | Create a team member |
| GET | `/users` | any logged-in | List users (paginated + filters) |
| GET | `/users/:id` | any logged-in | Get one user |
| PATCH | `/users/:id` | admin, manager | Update a user |
| DELETE | `/users/:id` | admin, manager | Delete a user (204, no body) |

**POST `/users`**

```json
{
  "name": "Jane Manager",
  "email": "jane.manager@example.com",
  "password": "Passw0rd123",
  "role": "manager",
  "status": "active"
}
```

- `role` optional: `admin` | `manager` | `agent` | `finance` | `tenant` (default `manager`)
- `status` optional: `active` | `invited` | `disabled` (default `invited`)
- `email` must be unique; `password` min 8 chars
- `passwordHash` is never returned.

**GET `/users`** — no body. Optional query params:

| Param | Example | Notes |
|-------|---------|-------|
| `page` | `1` | default 1 |
| `limit` | `20` | default 20, max 100 |
| `sort` | `-createdAt` | any field, `-` prefix for desc |
| `role` | `manager` | filter by role |
| `status` | `active` | filter by status |
| `search` | `jane` | matches name or email (case-insensitive) |

Example: `GET /users?page=1&limit=10&role=manager&search=jane`

**GET `/users/:id`** — no body. Example: `/users/6a42ba5599b6f78c1e32cafd`

**PATCH `/users/:id`** — send only the fields you want to change:

```json
{
  "name": "Jane Smith",
  "role": "finance",
  "status": "disabled",
  "password": "NewPassw0rd123"
}
```

**DELETE `/users/:id`** — no body. Returns `204 No Content`.

### Owners (`/owners`)

All routes require `Authorization: Bearer <accessToken>`. Writes are restricted to **admin / manager**.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/owners` | admin, manager | Create a property owner |
| GET | `/owners` | any | List owners (`?page&limit&sort&search`) |
| GET | `/owners/:id` | any | Get one owner |
| PATCH | `/owners/:id` | admin, manager | Update an owner |
| DELETE | `/owners/:id` | admin, manager | Delete (409 if still referenced by a property) |

### Properties (`/properties`)

Writes restricted to **admin / manager**. Soft-deleted (`isDeleted`); deleting a property cascades a soft-delete to its rooms.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/properties` | admin, manager | Create a property (`ownerId` must exist in your account) |
| GET | `/properties` | any | List (`?page&limit&sort&status&ownerId&search`), owner populated |
| GET | `/properties/:id` | any | Get one property |
| PATCH | `/properties/:id` | admin, manager | Update |
| DELETE | `/properties/:id` | admin, manager | Soft-delete (+ its rooms) |

### Rooms (`/properties/:propertyId/rooms`)

Nested under a property; scoped through it (a room has no `accountId`). Writes restricted to **admin / manager**. `rentAmount` is stored as `Decimal128` and returned as a string. `Property.totalRooms` auto-syncs on create/delete.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/properties/:propertyId/rooms` | admin, manager | Add a room |
| GET | `/properties/:propertyId/rooms` | any | List rooms (`?page&limit&sort&status`) |
| GET | `/properties/:propertyId/rooms/:id` | any | Get one room |
| PATCH | `/properties/:propertyId/rooms/:id` | admin, manager | Update |
| DELETE | `/properties/:propertyId/rooms/:id` | admin, manager | Soft-delete |

### Lettings — Leads / Viewings / Applicants / Listings

Phase-2 lettings. Create/update/delete allowed for **admin / manager / agent**; reads open to any authenticated user. Money fields (`holdingDeposit`, `rentAdvertised`) are `Decimal128`, returned as strings.

| Method | Path | Notes |
|--------|------|-------|
| CRUD | `/leads` | accountId-scoped; `assignedTo` defaults to the creating agent. Filters: `status,source,assignedTo,search` |
| CRUD | `/viewings` | accountId-scoped; `agentId` defaults to creator. Filters: `status,from,to`; `scheduledAt` required on create |
| CRUD | `/applicants` | accountId-scoped. Filters: `referenceStatus,onboardingStatus` |
| CRUD | `/listings` | scoped via room→property→account; create requires a `roomId` you own. Filter: `status` |

Each supports `POST /` , `GET /` (paginated), `GET /:id`, `PATCH /:id`, `DELETE /:id`.

### Maintenance (`/maintenance`)

Scoped by `accountId`. Create/update allowed for **admin / manager / agent**; delete for **admin / manager**. `cost` is `Decimal128`, returned as a string.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/maintenance` | admin, manager, agent | Raise a request (`reportedBy` from token) |
| GET | `/maintenance` | any | List (`?page&limit&sort&status&priority&propertyId`), property populated |
| GET | `/maintenance/:id` | any | Get one |
| PATCH | `/maintenance/:id` | admin, manager, agent | Update |
| DELETE | `/maintenance/:id` | admin, manager | Delete |

### Compliance (`/compliance`)

Scoped via the parent property (a certificate has no `accountId`). Writes restricted to **admin / manager**. `status` (`valid`/`expiring`/`expired`) is auto-derived from `expiryDate` (30-day window).

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/compliance` | admin, manager | Add a certificate (`propertyId` must be in your account) |
| GET | `/compliance` | any | List (`?page&limit&sort&propertyId&certType&status&due`); `due=soon\|expired` |
| GET | `/compliance/:id` | any | Get one |
| PATCH | `/compliance/:id` | admin, manager | Update |
| DELETE | `/compliance/:id` | admin, manager | Delete |

### Common status codes

| Code | Meaning |
|------|---------|
| 200 / 201 | Success |
| 204 | Deleted, no content |
| 400 | Validation failed (see `details`) |
| 401 | Missing/invalid/expired token, or bad login |
| 403 | Authenticated but role not allowed |
| 404 | Resource not found in your account |
| 409 | Duplicate (e.g. email already exists) |

> Postman tip: in your collection, set a variable `baseUrl = http://localhost:5000/api/v1`
> and `token`, then use `{{baseUrl}}/users` with `Authorization: Bearer {{token}}`.
> A test script on the register/login request can auto-save the token:
> `pm.collectionVariables.set("token", pm.response.json().data.tokens.accessToken)`

## Architecture

```text
backend/
├─ server.js           # entry: connect DB, start HTTP server, graceful shutdown
├─ app.js              # express app: middleware, routes, error handling
├─ config/
│  ├─ env.js           # validated environment config
│  └─ db.js            # mongoose connection
├─ models/             # 37 Mongoose models + index.js barrel
├─ controllers/        # thin HTTP handlers (per module)
├─ services/           # business logic (per module)
├─ validations/        # zod request schemas (per module)
├─ routes/             # express routers, mounted under /api/v1
│  └─ index.js         # central router
├─ middleware/
│  ├─ auth.js          # JWT verification -> req.user
│  ├─ rbac.js          # requireRole(...) + ROLES
│  ├─ accountScope.js  # multi-tenant guard -> req.accountId
│  ├─ validate.js      # zod request validation
│  └─ errorHandler.js  # notFound + global error handler
├─ jobs/               # cron jobs (invoices, expiry alerts)
├─ scripts/            # dev helpers (e.g. gen-token.js)
└─ utils/              # logger, ApiError, ApiResponse, asyncHandler, pagination, token
```

## Conventions

- **Multi-tenant:** every tenant-scoped query MUST filter by `accountId` (from JWT).
  Use the `accountScope` middleware to populate `req.accountId`.
- **Auth:** JWT access + refresh; bcrypt password hashing; RBAC on `User.role`
  (`admin` `manager` `agent` `finance` `tenant`).
- **Money:** `Decimal128`, never floats.
- **Files:** upload to Cloudinary, store the URL in the polymorphic `Document` model.
- **Soft delete:** `{ isDeleted, deletedAt }` on Property, Room, Tenancy.
- **Audit log:** append-only.
- Per module, build: **controller + service + route + validation + tests**.

## Build order (phased — see SRS / DATA_MODEL.md)

1. **Core** — Auth/JWT/RBAC, Account, Subscription, User, Owner, Property, Floor, Room, Bed.
2. **Lettings** — Lead, Viewing, Applicant, Tenant, Guarantor, RightToRent, Tenancy, Inventory.
3. **Finance** — Invoice, Payment (Stripe), Deposit, Transaction, RecurringCharge, OwnerSettlement.
4. **Operations & compliance** — MaintenanceRequest, Supplier, Inspection, ComplianceCertificate,
   HmoLicence, UtilityAccount, UtilityBill, CouncilTaxAccount, RoomListing.
5. **Platform** — Action, CalendarEvent, Communication, Notification, Document, AuditLog, reporting.

## Adding a module

1. Model already exists in `models/` (barrel: `require('../models')`).
2. Create `services/<name>.service.js` — business logic, scoped by `accountId`.
3. Create `validations/<name>.validation.js` — zod request schemas.
4. Create `controllers/<name>.controller.js` — thin handlers using `asyncHandler`.
5. Create `routes/<name>.routes.js` — wire `authenticate`, `accountScope`,
   `requireRole`, `validate`.
6. Register the router in `routes/index.js`.
7. Add tests in `tests/`.
