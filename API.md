# FixMate API Documentation

Base URL: `http://localhost:3000/api` — all bodies are JSON. Authentication uses
`Authorization: Bearer <JWT>` where the JWT payload contains `{ id, role, name, technicianId }`
issued by the server after verifying bcrypt credentials against the `users` table.
Roles are **never** accepted from the client.

Error shape: `{ "error": { "message": "..." } }` with proper HTTP codes
(401 unauthenticated · 403 wrong role/ownership · 409 duplicate/conflict · 422 validation/business rule).

---

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Customer registration |
| POST | `/auth/login` | — | Login for all roles (role read from DB) |
| GET | `/auth/me` | any | Current user |
| POST | `/auth/logout` | — | Stateless logout acknowledgment |

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Jane Doe","email":"jane@mail.demo","phone":"+1-555-123-4567","password":"Password123!"}'
# → 201 {"token":"eyJ...","user":{"id":7,"role":"customer",...}}

# Login
curl -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@fixmate.demo","password":"Admin123!"}'
# → {"token":"eyJ...","user":{"id":1,"name":"Site Administrator","role":"admin"}}
```

## Catalog (public)

| Method | Path | Description |
|---|---|---|
| GET | `/categories` | Active categories with service counts. Admin may pass `?all=1` |
| GET | `/services` | Active, bookable services. Filters: `?category=4&search=leak`. Admin: `?all=1` |
| GET | `/settings` | Public website settings |

```bash
curl "http://localhost:3000/api/services?search=leak"
# → {"services":[{"id":7,"name":"Leak Repair","base_price":30,"pricing_type":"fixed",...}]}
```

## Customer (role: customer, JWT required — every query scoped to `req.user.id`)

| Method | Path | Description |
|---|---|---|
| GET | `/bookings` | My bookings |
| POST | `/bookings` | Create booking. Body: `{serviceId, address, city, date, timeSlot, notes, image?}`. **Price is computed server-side from the DB** — any client-supplied price is ignored. Validations: future date, `HH:MM-HH:MM` slot, active service |
| GET | `/bookings/:id` | My booking + full status history (403/404 for other users' bookings) |
| POST | `/bookings/:id/cancel` | Cancel eligible booking (`New / Pending` or `Assigned`), reason required |
| POST | `/bookings/:id/review` | Review a **completed** booking, `{rating: 1-5, comment}`, one per booking |

```bash
curl -X POST http://localhost:3000/api/bookings -H "Authorization: Bearer $CUST" -H 'Content-Type: application/json' \
  -d '{"serviceId":13,"address":"1 Test Street","city":"Downtown","date":"2026-10-12","timeSlot":"09:00-11:00","notes":"AC not cooling"}'
# → 201 {"booking":{"id":"HSP-261012-0001","status":"New / Pending","estimated_price":55,...}}
```

## Super Admin (role: admin — every route behind `authenticate` + `authorize('admin')`)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/dashboard` | Status counts, revenue, 7-day trend, popular categories |
| GET | `/admin/bookings` | All bookings. Filters: `search, from, to, category, technician, area, status` |
| POST | `/admin/bookings/:id/assign` | `{technicianId}` — rejects with 409 on same-slot overlap; reassignment allowed |
| POST | `/admin/bookings/:id/status` | `{status, note?}` — only transitions in the server-side map; cancel needs a note |
| POST | `/admin/bookings/:id/reschedule` | `{date, timeSlot}` — checks the assigned technician's overlap |
| GET/POST | `/admin/technicians` | List (filters: `search, category, area, status, verification`) / create (bcrypt-hashed password) |
| PUT/DELETE | `/admin/technicians/:id` | Update / delete (cascades user + availability) |
| GET | `/admin/payments` | Payment records + commission summary. Filters: `status, search` |
| PUT | `/admin/payments/:id` | Update method; `status:'paid'` accepted **only** for explicitly demo-labelled records |
| GET | `/admin/reviews` | All reviews with author and booking |
| PUT | `/admin/reviews/:id` | `{moderated: 'visible'|'hidden'|'flagged'}` |
| GET | `/admin/reports` | `?from=&to=` — bookings, per-category, technician performance, revenue summary |
| PUT | `/admin/settings` | Update website settings |

```bash
# Assign Ravi (id 1) — second assignment in the same slot returns 409
curl -X POST http://localhost:3000/api/admin/bookings/HSP-261012-0001/assign \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"technicianId":1}'

# Invalid transition is rejected server-side
curl -X POST http://localhost:3000/api/admin/bookings/HSP-261012-0001/status \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"status":"Completed"}'
# → 422 {"error":{"message":"Invalid status transition: \"New / Pending\" → \"Completed\". Allowed: Assigned, Cancelled."}}
```

## Technician (role: technician — every job query scoped to the token's `technicianId`)

| Method | Path | Description |
|---|---|---|
| GET | `/tech/dashboard` | Cards (assigned/active/completed/today), sample earnings, upcoming jobs, alerts |
| GET | `/tech/jobs` | My jobs. Filters: `search, status` |
| GET | `/tech/jobs/:id` | My job + customer contact (404 if not mine) |
| POST | `/tech/jobs/:id/status` | `{status, note?}` — valid transitions incl. `Unable to Complete`; quote-based jobs need a quote before `Completed` |
| POST | `/tech/jobs/:id/quote` | `{amount}` — submitted for admin review |
| POST | `/tech/jobs/:id/note` | `{note}` — appended to status history |
| GET | `/tech/history` | Closed jobs. Filters: `from, to, status` |
| GET | `/tech/earnings` | Completed jobs with 15% sample fee and payable balance (read-only) |
| GET/PUT | `/tech/availability` | Working days, slots, break, unavailable dates, online toggle (validated) |
| GET/PUT | `/tech/profile` | Permitted fields only; verification/rating are read-only |

## Booking status model (single server-side source of truth: `services/bookingService.js`)

```
New / Pending → Assigned → Accepted → On the Way → In Progress → Completed
       ↕              ↘ (any pre-completed state may go to Cancelled with a reason,
    Unable to Complete ─┘        or to Unable to Complete where the map allows)
```

Completing a job sets `final_price` (quoted or estimated, from the DB) and creates a
`payments` row with status `pending`. A payment only becomes `paid` through the
explicitly demo-labelled admin action or a real gateway integration.
