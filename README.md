# Home Services Booking Platform — Frontend Prototype

A complete, responsive frontend prototype (Phase 1 UI) for a home-services marketplace, built with **HTML5, CSS3, Bootstrap 5, Bootstrap Icons and vanilla JavaScript**. No backend, no frameworks — all data lives in your browser.

## Running locally

No build step required. Either:

- **Option A (recommended):** serve over HTTP so localStorage works consistently:
  ```bash
  cd home-services-platform
  python3 -m http.server 8000
  # open http://localhost:8000
  ```
- **Option B:** open `index.html` directly in a modern browser.

> Note: opening via `file://` works in most browsers, but some restrict storage — prefer Option A.

## Demo roles

| Role | Where | Demo credentials |
|---|---|---|
| Customer | Public website | No login needed |
| Super Admin | `admin/` panel | `admin@fixmate.demo` / `demo123` (choose "Super Admin" role) |
| Technician | `technician/` panel | `ravi@fixmate.demo` / `demo123` (choose "Technician" role) |

Login is **demo-only**: the chosen role is stored in `sessionStorage`. It is **not** secure authentication — a production deployment requires a backend with server-side auth and role-based authorization (see "Limitations").

## Pages

### Customer website (root)
- `index.html` — hero + search, 8 service categories, popular services, How It Works, Why Choose Us, sample reviews, footer
- `services.html` — search by name, filter by category, bookable services only
- `service-details.html?id=…` — description, duration, pricing type (fixed / quote), Book button
- `book-service.html` — validated booking form with image upload (type/size checks + preview), live price estimate
- `booking-confirmation.html?id=…` — unique booking ID, full details, demo notice
- `login.html` — role-based demo entry points

### Super Admin panel (`admin/`)
`dashboard.html` (summary cards, filters, recent bookings, booking-trend + popular-category canvas charts) · `technicians.html` (search/filter/sort/paginate, add/edit, details, approve/reject/suspend/reactivate, delete with confirm) · `categories.html` (CRUD + activate/deactivate) · `services.html` (CRUD, fixed vs quote pricing, activate/deactivate) · `bookings.html` (search, date/category/technician/area/status filters, pagination) · `booking-details.html` (assign/reassign with slot-conflict blocking, allowed status transitions, reschedule, cancel with reason, timestamped status history, pricing/payment block) · `pricing.html` (estimated/final price, payment status, sample commission split) · `reports.html` (review moderation + booking/category/technician/revenue reports with date filters and CSV export) · `settings.html` (identity, contacts, locations, hours, booking & cancellation rules, notification template, admin profile)

### Technician panel (`technician/`)
`dashboard.html` (job cards, today's schedule, alerts, upcoming appointments) · `profile.html` (editable fields vs read-only verification/rating) · `availability.html` (working days, slots, break, unavailable dates, online toggle — with validation) · `assigned-jobs.html` (scoped to the demo technician, search + status filter) · `job-details.html` (customer details, allowed status chain Assigned → Accepted → On the Way → In Progress → Completed / Unable to Complete, job notes, before/after photos, quote submission for quote-based services) · `job-history.html` (closed jobs with date/status filters) · `earnings.html` (completed jobs, sample fee/deductions, payable balance, read-only records)

## Code organization

```
home-services-platform/
├── index.html, services.html, service-details.html,
│   book-service.html, booking-confirmation.html, login.html
├── admin/      (9 pages)
├── technician/ (7 pages)
└── assets/
    ├── css/  style.css · admin.css · technician.css
    └── js/   common.js · customer.js · admin.js · technician.js
```

- `common.js` — shared seed data, versioned localStorage layer (auto-reseeds on corrupt data), status-transition map, slot-conflict check, history logger, toasts, confirm dialogs, CSV export, pagination, validation and image helpers, role guard.
- All business logic (charts, dashboards, tables) is vanilla JS; Bootstrap comes from CDN.

## Business rules implemented

- Unique booking IDs (`HSP-YYMMDD-NNNN`) + creation timestamp on every booking.
- New bookings start as **New / Pending**; admin assigns/reassigns technicians.
- A technician cannot hold two confirmed bookings in the same slot (conflicting options are disabled in the assign dialog).
- Status changes record previous status → new status, actor, timestamp and note; invalid transitions are blocked in the UI.
- Cancelled bookings retain history and cancellation reason and are never deleted.
- Completed jobs and payment records are read-only where required; inactive services cannot be booked anywhere.

## Limitations (frontend demo)

- **No backend/security:** "login" is a sessionStorage flag; there is no real authentication, server-side validation, concurrency protection or audit logging. The requirements doc's production phases (backend/database, gateway payments, notifications) are out of scope.
- Data persists per-browser via `localStorage` (reset available from the Admin dashboard menu: *Reset demo data*).
- Payments, reviews and reports use **sample data only**; online payment gateway integration is a separate decision.
- Photos are previewed/stored as data URLs in the browser (demo only).
- Charts are lightweight vanilla-JS canvas drawings (no chart library dependency).

## Future backend integration

All reads/writes go through `HSP.loadDb()` / `HSP.saveDb()` in `common.js`. Replacing those two functions with API calls (or an adapter with the same shape) migrates the whole UI to a real backend without touching page logic.

---

# Running the Full Application (Frontend + Backend + MySQL)

The frontend is unchanged — it is now served by the Express backend and talks to a REST API backed by MySQL instead of browser localStorage.

## 1. Prerequisites
- Node.js 18+
- MySQL 8+ (or MariaDB 10.6+)

## 2. Database setup
```bash
cd backend
mysql -u root -p < sql/schema.sql     # creates DB `fixmate`, tables, indexes, FKs
mysql -u root -p < sql/seed.sql       # catalog: 8 categories, 16 services, settings row
```

## 3. Backend setup
```bash
cd backend
npm install
cp .env.example .env        # edit DB credentials + JWT_SECRET (see .env.example)
npm run create-admin        # creates the first Super Admin from ADMIN_* env vars (bcrypt-hashed)
npm run seed-demo-users     # optional: demo customer/technicians/bookings (Password123!)
npm start                   # serves API + frontend at http://localhost:3000
```

## 4. Sign in (roles verified by the backend, never the browser)
| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@fixmate.demo` | value of `ADMIN_PASSWORD` (default `Admin123!`) |
| Technician | `ravi@fixmate.demo` | `Password123!` |
| Customer | `customer@fixmate.demo` | `Password123!` (or register at `/register.html`) |

## 5. Run the automated workflow tests
```bash
npm test                    # runs tests/smoke.sh against http://localhost:3000
```
Covers: registration, login (all roles), wrong-password rejection, unauthorized access,
booking creation with server-side pricing, price-tampering rejection, past-date rejection,
cross-customer ownership checks, technician assignment + slot-overlap blocking, invalid
status-transition blocking, full technician workflow (Accepted → On the Way → In Progress →
Completed), quote submission, payment records, review submission + duplicate blocking,
reports, settings and logout.

## 6. API documentation
See [docs/API.md](docs/API.md) for every endpoint with request/response examples.

## Security notes
- Passwords: bcrypt (cost 10), never stored or logged in plaintext.
- JWT: HS256, 12h expiry, secret from env; roles embedded from the DB at login.
- All SQL is parameterized (mysql2 prepared statements); no string-built queries.
- helmet, CORS (allow-list from `FRONTEND_URL`) and express-rate-limit are enabled.
- Payments: pending by default; only explicitly demo-labelled records can be marked paid without a gateway.
