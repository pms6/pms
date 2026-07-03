# Admin Section — Flows & Data Map

Design-only reference for the **admin** portal. Every screen renders from manual
arrays in a single data store — **no backend calls**. Interactions (create / edit /
delete / filter) run on local React state and reset on a full page refresh.

- **Data store:** `src/app/admin/_data/dummy.js` (all `export const` arrays/objects)
- **Shell / nav:** `src/app/admin/layout.js` → `Shared/RoleShell.js` (role guard = `admin`)
- **Shared UI:** `Shared/ui.js` (`StatCard`, `PageHeader`, `Card`, `Badge`)
- **Images:** `img(seed)` → `picsum.photos` seeded URLs (stable)
- **Money:** `money(n)` → `£1,234`
- Colour system: brand orange `#F47C3C`, navy `#0F253B`; light theme forced in
  `globals.css` (`color-scheme: light`) so inputs stay readable in OS dark mode.

---

## Navigation order (`layout.js`)
Dashboard · Properties · Property Owners · Leads · Viewings · Onboarding ·
Occupancy · Welcome Pack · Inspection · Rent Collection · Rent Review ·
Finances · Deposits · Maintenance · Reports · Feedback · Team · Account

---

## 1. Dashboard — `/admin/dashboard`
**Flow:** Landing overview → hero greeting + portfolio stats → KPI cards (revenue,
occupancy, properties, tenancies) → revenue bar chart + occupancy donut → alert
tiles (leads, viewings, compliance) → recent activity feed + today's viewings.
**Data:** `stats`, `revenueSeries`, `activity`, `viewings`.

## 2. Properties — `/admin/properties` (+ `/[id]`)
**Flow:** Grid of property cards (cover image, type + tenant-type badges, rent,
occupancy). **Add Property** modal follows the rental-type flow:
Address + Area → **Assign Owner** → Photos (drag-drop) → **Rental Type**
(HMO / Single Let / Short-term Let / Block) → **Tenant Type** → type-specific fields:
- **HMO** → Rooms builder (Room Name, Monthly Rent, Tenant Money Held, Guarantor
  Requirement, Room Status, optional Tenant).
- **Single Let** → Monthly Rent, Tenant Money Held, Guarantor, Property Status, Tenant.
- **Short-term Let** → tenant type only.
- **Block** → Payment Term (Days), Hide Tenant Rent (Yes/No).

Card shows the **tenant** when present (single name or "N tenants"). Detail page
(`/[id]`) = cover + quick stats + **Rooms manager** (HMO) or **Letting Details** (others).
**Data:** `properties`, `owners`, `RENTAL_TYPES`, `TENANT_TYPES`, `GUARANTOR_REQ`,
`LETTING_STATUS`, `LETTING_STATUS_TONE`. New properties `unshift` into `properties`
so they're navigable on the detail page in-session.

## 3. Property Owners — `/admin/owners`
**Flow:** Summary tiles (owners, properties managed, rent roll, live) → search →
owners **table** with Status / Properties count + names / income / payout / actions.
**Add / Edit Owner** modal: name, type, **Status** (Lead / In Progress / Live),
email, phone, maintenance £, account no., property assignment, **Files**, **Notes**.
Edit + Delete per row.
**Data:** `owners`, `OWNER_STATUS`, `properties` (assignment).

## 4. Leads — `/admin/leads`
**Flow:** Kanban pipeline (New → Qualified → Viewing → Converted → Lost) with
counts per column; **New Lead** modal (name, email, phone, source, budget,
interested-in, stage). Cards show source, budget, assigned agent.
**Data:** `leads`, `LEAD_STAGES`, `properties`.

## 5. Viewings — `/admin/viewings`
**Flow:** Status filter chips → schedule grouped by day (time rail, lead,
property/room, agent, status). **Schedule Viewing** modal (date, time, lead,
property, room).
**Data:** `viewings`, `leads`, `properties`.

## 6. Onboarding — `/admin/onboarding`
**Flow:** Pipeline summary → master–detail. Left = applicant list w/ progress.
Right = 7-stage **stepper** (Application → Referencing → Right to Rent → Guarantor
→ Deposit → Agreement → Move-in) + sections: Tenancy Terms, Personal, Employment
& Affordability, Right to Rent, References, Guarantor, Deposit Protection, Documents.
**Data:** `onboarding`, `ONBOARDING_STAGES`.

## 7. Occupancy — `/admin/occupancy`
**Flow:** Overview (Units, Occupants, Onboardings, Tenancy Changes, Renewals) →
status filter chips (All / Fixed Term / Becoming Periodic / Periodic / Ending) →
Property filter + **Invite All Tenants** + exports (Current / Past / Cancelled /
Revenue CSV) → list (Property & Unit, Tenant, Rent, Start, Term End / Periodic,
Availability, Status) → View detail modal + per-tenant onboarding invite.
**Data:** `occupancy`, `occupancyOverview`, `TENANCY_STATUS`, `TENANCY_STATUS_TONE`.

## 8. Welcome Pack — `/admin/welcome-pack`
**Flow:** Quick Info items (phone numbers/codes) + Info Cards (rich content, files,
video) shown to tenants; add/edit/delete; "New Information Card" form.
*(Page is currently static; data array provided in the store to wire up.)*
**Data:** `welcomePack` ( `quickInfo[]`, `infoCards[]` ).

## 9. Inspection — `/admin/Inspection`
**Flow:** Filters (date range, property, search) → inspections table
(Date, Property, Room, Type, Inspector, Status, Notes) with empty-state +
"Schedule Inspection".
**Data:** `inspections`, `INSPECTION_TYPES`, `INSPECTION_STATUS_TONE`.

## 10. Rent Collection — `/admin/rent-collection`
**Flow:** KPIs (collected, due, outstanding, rate) → collection progress bar →
status filter → rent table (Tenant, Property/Room, Amount, Due, Method, Status,
send-reminder/paid).
**Data:** `rentCharges`, `rentSummary`.

## 11. Rent Review — `/admin/rent-review`
**Flow:** Summary (Tenancies to Review, Units to Review) → Property filter +
Due-Only toggle → list (Tenant, Property/Room, Fixed Term End, Next Review,
Current Rent, Unit Target, Target %) → **View** detail (Tenancy + Unit panels,
rent-review **history** or "no rent reviews available", **Review Tenancy Rent** &
**Generate Section 13 Form**) → Export CSV.
**Data:** `rentReviews`, `properties`.

## 12. Finances — `/admin/finances`
**Flow:** Sub-section tabs → **Financial Graph** (KPIs, income-vs-expenses,
revenue by property) · **Settlement** (owner payouts table) · **Financial Items**
(income/expense ledger) · **Other Reports** (P&L, rent roll, VAT, etc.).
**Data:** `finances` ( `summary`, `cashflow`, `revenueByProperty`, `settlements`,
`items`, `otherReports` ).

## 13. Deposits — `/admin/deposits`
**Flow:** Status summary (Pending / Active / Closing / Closed) + Active value →
filters (Property, Tags, Deposit Type, Scheme, Protection Type) + search → list
(Property/Room, Tenant, Amount, Deposit Type, Status) → **View** (Protection info
+ Deposit History) → Export CSV.
**Data:** `deposits`, `DEPOSIT_STATUS`, `DEPOSIT_STATUS_TONE`, `DEPOSIT_TYPES`,
`PROTECTION_SCHEMES`, `PROTECTION_TYPES`, `DEPOSIT_TAGS`.

## 14. Maintenance — `/admin/maintenance`
**Flow:** Summary tiles → status filter → photo cards (priority + status badges,
reporter, supplier, cost, category).
**Data:** `maintenance`.

## 15. Reports — `/admin/reports`
**Flow:** Period selector → KPIs → income-vs-expenses + occupancy trend charts →
expense donut + lead sources + arrears → filterable **Report Library** (export).
**Data:** `reports` ( `incomeExpenses`, `occupancyTrend`, `leadSources`,
`expenseBreakdown`, `arrears`, `files` ), `stats`, `rentSummary`.

## 16. Feedback — `/admin/feedback`
**Flow:** **Tenant Satisfaction** (avg overall + monthly bar chart, tap month to
select) → **Feedbacks for Selected Month** (filter by Type / Score / Property) →
**Tenant Feedback** reviews (Date, Tenant, Property/Room, Overall, **View** full
review) → Export (Monthly Summaries / Raw Feedback / Reviews CSV).
**Data:** `satisfaction`, `feedbackRecords`, `reviews`, `FEEDBACK_TYPES`.

## 17. Team — `/admin/users`
**Flow:** Search → member cards (avatar, role badge, status, email) + add/edit/delete.
**Data:** `team`.

## 18. Account — `/admin/settings`
**Flow:** Plan comparison (Free / Pro / Enterprise) + account profile form
(name, type, contact email).
**Data:** `subscriptionPlans` (store) — page currently uses an inline copy.

---

## Data store index (`_data/dummy.js`)

| Export | Type | Used by |
|--------|------|---------|
| `stats` | object | Dashboard, Reports |
| `revenueSeries` | array | Dashboard |
| `activity` | array | Dashboard |
| `RENTAL_TYPES` | array | Properties |
| `TENANT_TYPES`, `GUARANTOR_REQ`, `LETTING_STATUS`, `LETTING_STATUS_TONE` | arrays/map | Properties |
| `properties` | array | Properties, Leads, Viewings, Rent Review, Occupancy, Deposits |
| `LEAD_STAGES`, `leads` | array | Leads, Viewings |
| `viewings` | array | Dashboard, Viewings |
| `ONBOARDING_STAGES`, `onboarding` | array | Onboarding |
| `team` | array | Team |
| `OWNER_STATUS`, `owners` | array | Property Owners, Properties |
| `rentSummary`, `rentCharges` | object/array | Rent Collection, Reports |
| `maintenance` | array | Maintenance |
| `reports` | object | Reports |
| `finances` | object | Finances |
| `FEEDBACK_TYPES`, `satisfaction`, `feedbackRecords`, `reviews` | array | Feedback |
| `DEPOSIT_*`, `PROTECTION_*`, `deposits` | array/map | Deposits |
| `rentReviews` | array | Rent Review |
| `TENANCY_STATUS`, `TENANCY_STATUS_TONE`, `occupancyOverview`, `occupancy` | array/obj | Occupancy |
| `INSPECTION_TYPES`, `INSPECTION_STATUS_TONE`, `inspections` | array/map | Inspection |
| `welcomePack` | object | Welcome Pack |
| `subscriptionPlans` | array | Account |
| `img(seed)`, `money(n)` | helpers | all |
