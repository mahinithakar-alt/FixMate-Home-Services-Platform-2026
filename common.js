/* =========================================================
   Home Services Booking Platform — common.js
   Shared seed data, storage layer, business rules & helpers.
   Consumed by customer.js, admin.js and technician.js.
   Frontend demo only — NOT production security.
   ========================================================= */
(function (window) {
  'use strict';

  const STORE_KEY = 'hsp_db_v1';
  const SESSION_KEY = 'hsp_demo_session';

  /* ---------- Status & business rules ---------- */
  const STATUS = {
    NEW: 'New / Pending',
    ASSIGNED: 'Assigned',
    ACCEPTED: 'Accepted',
    ON_WAY: 'On the Way',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    UNABLE: 'Unable to Complete'
  };

  // Allowed status transitions (UI enforces these; admin may cancel any
  // pre-completed booking).
  const TRANSITIONS = {
    [STATUS.NEW]: [STATUS.ASSIGNED, STATUS.CANCELLED],
    [STATUS.ASSIGNED]: [STATUS.ACCEPTED, STATUS.CANCELLED, STATUS.UNABLE],
    [STATUS.ACCEPTED]: [STATUS.ON_WAY, STATUS.CANCELLED, STATUS.UNABLE],
    [STATUS.ON_WAY]: [STATUS.IN_PROGRESS, STATUS.UNABLE],
    [STATUS.IN_PROGRESS]: [STATUS.COMPLETED, STATUS.UNABLE],
    [STATUS.COMPLETED]: [],
    [STATUS.CANCELLED]: [],
    [STATUS.UNABLE]: [STATUS.ASSIGNED, STATUS.CANCELLED]
  };

  const STATUS_BADGE = {
    [STATUS.NEW]: 'secondary',
    [STATUS.ASSIGNED]: 'info',
    [STATUS.ACCEPTED]: 'primary',
    [STATUS.ON_WAY]: 'warning',
    [STATUS.IN_PROGRESS]: 'warning',
    [STATUS.COMPLETED]: 'success',
    [STATUS.CANCELLED]: 'danger',
    [STATUS.UNABLE]: 'dark'
  };

  const TIME_SLOTS = ['09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00'];
  const COMMISSION_RATE = 0.15; // 15% sample platform commission

  /* ---------- Seed data ---------- */
  function seedData() {
    const today = new Date();
    const d = (offset) => {
      const t = new Date(today); t.setDate(t.getDate() + offset);
      return t.toISOString().slice(0, 10);
    };
    const now = (offsetH) => {
      const t = new Date(today); t.setHours(t.getHours() - (offsetH || 0));
      return t.toISOString();
    };
    return {
      version: 1,
      settings: {
        siteName: 'FixMate Home Services',
        logoText: 'FixMate',
        phone: '+1 (555) 012-3456',
        email: 'support@fixmate.demo',
        address: '42 Market Street, Downtown',
        locations: 'Downtown, Riverside, North Park, Old Town',
        businessHours: 'Mon-Sat, 09:00 - 19:00',
        bookingRules: 'Bookings require at least 2 hours notice. Same-day slots subject to technician availability.',
        cancellationRules: 'Free cancellation up to 2 hours before the appointment. Later cancellations may incur a visit fee.',
        notifTemplate: 'Hi {{customer}}, your booking {{bookingId}} for {{service}} is now "{{status}}".',
        adminName: 'Site Administrator',
        adminEmail: 'admin@fixmate.demo'
      },
      categories: [
        { id: 'cat-carpenter', name: 'Carpenter', icon: 'bi-hammer', description: 'Furniture repair, fitting, doors and woodwork.', active: true },
        { id: 'cat-mechanic', name: 'Car Mechanic', icon: 'bi-wrench-adjustable', description: 'Vehicle inspection, repair and breakdown assistance.', active: true },
        { id: 'cat-carwash', name: 'Car Washing', icon: 'bi-droplet', description: 'Doorstep or service-location car cleaning.', active: true },
        { id: 'cat-plumber', name: 'Plumber', icon: 'bi-droplet-half', description: 'Taps, pipes, drainage and water leakage repairs.', active: true },
        { id: 'cat-electrician', name: 'Electrician', icon: 'bi-lightning-charge', description: 'Wiring, switches, fans, lights and electrical faults.', active: true },
        { id: 'cat-houseworker', name: 'House Worker', icon: 'bi-house-heart', description: 'Cleaning and other approved household tasks.', active: true },
        { id: 'cat-ac', name: 'AC Technician', icon: 'bi-thermometer-snow', description: 'AC installation, servicing and repair.', active: true },
        { id: 'cat-mobile', name: 'Mobile Technician', icon: 'bi-phone', description: 'Mobile phone diagnostics and repair.', active: false }
      ],
      services: [
        { id: 'svc-carp-1', catId: 'cat-carpenter', name: 'Furniture Repair', description: 'Fix broken chairs, tables, cabinets and wooden furniture on site.', basePrice: 35, pricingType: 'fixed', duration: '1-2 hours', skills: ['Woodwork', 'Furniture assembly'], active: true },
        { id: 'svc-carp-2', catId: 'cat-carpenter', name: 'Door & Lock Fitting', description: 'Install or replace interior doors, handles and locks.', basePrice: 50, pricingType: 'fixed', duration: '2-3 hours', skills: ['Doors', 'Locks'], active: true },
        { id: 'svc-mech-1', catId: 'cat-mechanic', name: 'Car Inspection', description: 'Full 40-point vehicle condition inspection before purchase or trip.', basePrice: 0, pricingType: 'quote', duration: '1-2 hours', skills: ['Diagnostics', 'Engines'], active: true },
        { id: 'svc-mech-2', catId: 'cat-mechanic', name: 'Battery Jump-start & Replacement', description: 'On-site battery testing, jump-start or replacement.', basePrice: 25, pricingType: 'fixed', duration: '30-60 minutes', skills: ['Electrical', 'Batteries'], active: true },
        { id: 'svc-wash-1', catId: 'cat-carwash', name: 'Doorstep Car Wash', description: 'Exterior wash and interior vacuum at your home.', basePrice: 20, pricingType: 'fixed', duration: '45-60 minutes', skills: ['Detailing'], active: true },
        { id: 'svc-wash-2', catId: 'cat-carwash', name: 'Full Detailing', description: 'Deep cleaning, wax and polish inside and out.', basePrice: 60, pricingType: 'fixed', duration: '2-3 hours', skills: ['Detailing', 'Polish'], active: true },
        { id: 'svc-plumb-1', catId: 'cat-plumber', name: 'Leak Repair', description: 'Fix leaking taps, pipes and visible drainage leaks.', basePrice: 30, pricingType: 'fixed', duration: '1 hour', skills: ['Pipes', 'Fittings'], active: true },
        { id: 'svc-plumb-2', catId: 'cat-plumber', name: 'Bathroom Plumbing Overhaul', description: 'Diagnose and rework bathroom plumbing; quoted after inspection.', basePrice: 0, pricingType: 'quote', duration: '2-4 hours', skills: ['Pipes', 'Tiling basics'], active: true },
        { id: 'svc-elec-1', catId: 'cat-electrician', name: 'Switch & Socket Repair', description: 'Repair or replace faulty switches, sockets and wiring points.', basePrice: 25, pricingType: 'fixed', duration: '1 hour', skills: ['Wiring'], active: true },
        { id: 'svc-elec-2', catId: 'cat-electrician', name: 'Ceiling Fan Installation', description: 'Install or replace ceiling fans, including mounting and balancing.', basePrice: 40, pricingType: 'fixed', duration: '1-2 hours', skills: ['Wiring', 'Mounting'], active: true },
        { id: 'svc-house-1', catId: 'cat-houseworker', name: 'Home Deep Cleaning', description: 'Full-home deep cleaning covering rooms, kitchen and bathrooms.', basePrice: 70, pricingType: 'fixed', duration: '3-5 hours', skills: ['Cleaning'], active: true },
        { id: 'svc-house-2', catId: 'cat-houseworker', name: 'Kitchen Cleaning', description: 'Degrease and deep-clean kitchen counters, cabinets and appliances.', basePrice: 45, pricingType: 'fixed', duration: '2-3 hours', skills: ['Cleaning'], active: true },
        { id: 'svc-ac-1', catId: 'cat-ac', name: 'AC Service & Cleaning', description: 'Filter, coil and drainage cleaning for split or window AC units.', basePrice: 55, pricingType: 'fixed', duration: '1-2 hours', skills: ['HVAC'], active: true },
        { id: 'svc-ac-2', catId: 'cat-ac', name: 'AC Installation', description: 'New split-AC installation incl. bracket and piping; quoted after survey.', basePrice: 0, pricingType: 'quote', duration: '3-4 hours', skills: ['HVAC', 'Installation'], active: true },
        { id: 'svc-mob-1', catId: 'cat-mobile', name: 'Phone Screen Repair', description: 'Cracked screen diagnosis and replacement for major brands.', basePrice: 0, pricingType: 'quote', duration: '1-2 hours', skills: ['Micro-soldering'], active: false },
        { id: 'svc-mob-2', catId: 'cat-mobile', name: 'Battery Replacement', description: 'Mobile battery replacement with genuine parts.', basePrice: 30, pricingType: 'fixed', duration: '45 minutes', skills: ['Battery swap'], active: false }
      ],
      technicians: [
        { id: 'tech-1', name: 'Ravi Kumar', phone: '+1-555-0101', email: 'ravi@fixmate.demo', photo: '', categoryId: 'cat-ac', skills: 'HVAC, Electrical, Refrigerant handling', experience: '6 years', areas: ['Downtown', 'Riverside'], hours: '09:00 - 18:00', status: 'active', verification: 'verified', rating: 4.8, completedJobs: 132, availability: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], slots: TIME_SLOTS.slice(0, 4), breakFrom: '13:00', breakTo: '14:00', unavailableDates: [] } },
        { id: 'tech-2', name: 'Maya Lopez', phone: '+1-555-0102', email: 'maya@fixmate.demo', photo: '', categoryId: 'cat-plumber', skills: 'Pipes, Fittings, Leak detection', experience: '4 years', areas: ['Downtown', 'North Park'], hours: '08:00 - 16:00', status: 'active', verification: 'verified', rating: 4.6, completedJobs: 89, availability: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], slots: TIME_SLOTS, breakFrom: '12:00', breakTo: '13:00', unavailableDates: [] } },
        { id: 'tech-3', name: 'Daniel Okafor', phone: '+1-555-0103', email: 'daniel@fixmate.demo', photo: '', categoryId: 'cat-mechanic', skills: 'Engine diagnostics, Batteries, Breaks', experience: '8 years', areas: ['Riverside', 'Old Town'], hours: '09:00 - 18:00', status: 'active', verification: 'verified', rating: 4.9, completedJobs: 210, availability: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], slots: TIME_SLOTS, breakFrom: '13:00', breakTo: '14:00', unavailableDates: [] } },
        { id: 'tech-4', name: 'Sara Chen', phone: '+1-555-0104', email: 'sara@fixmate.demo', photo: '', categoryId: 'cat-carpenter', skills: 'Woodwork, Furniture, Doors', experience: '3 years', areas: ['North Park', 'Old Town'], hours: '10:00 - 19:00', status: 'pending', verification: 'pending', rating: 4.3, completedJobs: 21, availability: { days: ['Wed', 'Thu', 'Fri', 'Sat', 'Sun'], slots: TIME_SLOTS.slice(1), breakFrom: '14:00', breakTo: '15:00', unavailableDates: [] } }
      ],
      bookings: [
        { id: 'HSP-260910-0012', createdAt: now(240), customer: { name: 'Emily Watson', phone: '+1-555-2001', email: 'emily@mail.demo' }, serviceId: 'svc-ac-1', address: '18 Elm Street, Apt 4B', city: 'Downtown', date: d(0), timeSlot: '11:00-13:00', notes: 'AC cooling poorly for a week.', estPrice: 55, finalPrice: 55, paymentStatus: 'Paid', status: STATUS.COMPLETED, techId: 'tech-1', cancelReason: '', image: '', history: [ { from: STATUS.NEW, to: STATUS.ASSIGNED, actor: 'Super Admin', at: now(238), note: 'Assigned Ravi Kumar' }, { from: STATUS.ASSIGNED, to: STATUS.ACCEPTED, actor: 'Ravi Kumar', at: now(237), note: '' }, { from: STATUS.ACCEPTED, to: STATUS.COMPLETED, actor: 'Ravi Kumar', at: now(230), note: 'Service done, filters replaced' } ] },
        { id: 'HSP-260910-0013', createdAt: now(200), customer: { name: 'James Carter', phone: '+1-555-2002', email: '' }, serviceId: 'svc-plumb-1', address: '7 Riverside Drive', city: 'Riverside', date: d(0), timeSlot: '15:00-17:00', notes: 'Kitchen tap dripping constantly.', estPrice: 30, finalPrice: 0, paymentStatus: 'Pending', status: STATUS.IN_PROGRESS, techId: 'tech-2', cancelReason: '', image: '', history: [ { from: STATUS.NEW, to: STATUS.ASSIGNED, actor: 'Super Admin', at: now(198), note: '' }, { from: STATUS.ASSIGNED, to: STATUS.ACCEPTED, actor: 'Maya Lopez', at: now(195), note: '' }, { from: STATUS.ACCEPTED, to: STATUS.ON_WAY, actor: 'Maya Lopez', at: now(150), note: '' }, { from: STATUS.ON_WAY, to: STATUS.IN_PROGRESS, actor: 'Maya Lopez', at: now(145), note: '' } ] },
        { id: 'HSP-260910-0014', createdAt: now(120), customer: { name: 'Priya Nair', phone: '+1-555-2003', email: 'priya@mail.demo' }, serviceId: 'svc-wash-1', address: '220 North Park Ave', city: 'North Park', date: d(1), timeSlot: '09:00-11:00', notes: 'Sedan, exterior + interior vacuum.', estPrice: 20, finalPrice: 0, paymentStatus: 'Pending', status: STATUS.ASSIGNED, techId: 'tech-3', cancelReason: '', image: '', history: [ { from: STATUS.NEW, to: STATUS.ASSIGNED, actor: 'Super Admin', at: now(118), note: 'Assigned Daniel Okafor' } ] },
        { id: 'HSP-260910-0015', createdAt: now(90), customer: { name: 'Ahmed Hassan', phone: '+1-555-2004', email: '' }, serviceId: 'svc-mech-1', address: '5 Old Town Square', city: 'Old Town', date: d(1), timeSlot: '13:00-15:00', notes: 'Used car inspection before purchase.', estPrice: 0, finalPrice: 0, paymentStatus: 'Pending', status: STATUS.NEW, techId: '', cancelReason: '', image: '', history: [] },
        { id: 'HSP-260910-0016', createdAt: now(60), customer: { name: 'Lucy Bennett', phone: '+1-555-2005', email: 'lucy@mail.demo' }, serviceId: 'svc-elec-2', address: '90 Market Street', city: 'Downtown', date: d(2), timeSlot: '11:00-13:00', notes: 'Install new ceiling fan in bedroom.', estPrice: 40, finalPrice: 0, paymentStatus: 'Pending', status: STATUS.NEW, techId: '', cancelReason: '', image: '', history: [] },
        { id: 'HSP-260910-0017', createdAt: now(48), customer: { name: 'Tom Reynolds', phone: '+1-555-2006', email: '' }, serviceId: 'svc-house-1', address: '31 Willow Lane', city: 'North Park', date: d(3), timeSlot: '09:00-11:00', notes: '2-bedroom apartment deep clean.', estPrice: 70, finalPrice: 0, paymentStatus: 'Pending', status: STATUS.CANCELLED, techId: '', cancelReason: 'Customer travelling; will rebook later.', image: '', history: [ { from: STATUS.NEW, to: STATUS.CANCELLED, actor: 'Super Admin', at: now(40), note: 'Customer travelling; will rebook later.' } ] },
        { id: 'HSP-260910-0018', createdAt: now(24), customer: { name: 'Grace Kim', phone: '+1-555-2007', email: 'grace@mail.demo' }, serviceId: 'svc-carp-1', address: '12 Cherry Street', city: 'Riverside', date: d(2), timeSlot: '15:00-17:00', notes: 'Broken chair leg and loose cabinet door.', estPrice: 35, finalPrice: 0, paymentStatus: 'Pending', status: STATUS.ASSIGNED, techId: 'tech-4', cancelReason: '', image: '', history: [ { from: STATUS.NEW, to: STATUS.ASSIGNED, actor: 'Super Admin', at: now(20), note: 'Assigned Sara Chen (pending verification)' } ] },
        { id: 'HSP-260910-0019', createdAt: now(6), customer: { name: 'Oliver Grant', phone: '+1-555-2008', email: '' }, serviceId: 'svc-wash-2', address: '75 Harbor Road', city: 'Riverside', date: d(4), timeSlot: '17:00-19:00', notes: 'SUV full detailing after road trip.', estPrice: 60, finalPrice: 0, paymentStatus: 'Pending', status: STATUS.NEW, techId: '', cancelReason: '', image: '', history: [] }
      ],
      reviews: [
        { id: 'rev-1', bookingId: 'HSP-260910-0012', rating: 5, comment: 'Ravi arrived on time and the AC works like new. Excellent service!', author: 'Emily Watson', moderated: 'visible' },
        { id: 'rev-2', bookingId: 'HSP-260910-0012', rating: 4, comment: 'Good work, slightly late but called ahead.', author: 'James Carter', moderated: 'visible' },
        { id: 'rev-3', bookingId: 'HSP-260910-0013', rating: 5, comment: 'Maya found the leak quickly and fixed it neatly.', author: 'Priya Nair', moderated: 'visible' },
        { id: 'rev-4', bookingId: 'HSP-260910-0013', rating: 2, comment: 'Visit fee was confusing, otherwise fine.', author: 'Tom Reynolds', moderated: 'flagged' },
        { id: 'rev-5', bookingId: 'HSP-260910-0018', rating: 5, comment: 'The carpenter fixed everything in one visit. Highly recommended.', author: 'Grace Kim', moderated: 'visible' },
        { id: 'rev-6', bookingId: 'HSP-260910-0018', rating: 1, comment: 'Terrible, never again!!! (posted 3 times)', author: 'Anonymous', moderated: 'hidden' }
      ]
    };
  }

  /* ---------- Storage with corrupt-data fallback ---------- */
  function loadDb() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) throw new Error('empty');
      const db = JSON.parse(raw);
      if (!db || db.version !== 1 || !Array.isArray(db.bookings) || !Array.isArray(db.services)) throw new Error('shape');
      return db;
    } catch (e) {
      // Corrupt or missing data — reseed gracefully.
      const db = seedData();
      saveDb(db);
      return db;
    }
  }
  function saveDb(db) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
    catch (e) { console.error('Storage write failed', e); }
  }
  function resetDb() { localStorage.removeItem(STORE_KEY); return loadDb(); }

  /* ---------- Booking ID ---------- */
  function genBookingId(db) {
    const nowD = new Date();
    const prefix = 'HSP-' + String(nowD.getFullYear()).slice(2) + String(nowD.getMonth() + 1).padStart(2, '0') + String(nowD.getDate()).padStart(2, '0');
    let n = 1;
    db.bookings.forEach(b => { if (b.id.startsWith(prefix)) n = Math.max(n, parseInt(b.id.slice(-4), 10) + 1); });
    return prefix + '-' + String(n).padStart(4, '0');
  }

  /* ---------- History logger ---------- */
  function logStatusChange(db, bookingId, from, to, actor, note) {
    const b = db.bookings.find(x => x.id === bookingId);
    if (!b) return false;
    b.history = b.history || [];
    b.history.push({ from: from, to: to, actor: actor, at: new Date().toISOString(), note: note || '' });
    return true;
  }

  /* ---------- Slot-conflict check ----------
     A technician must not have two confirmed bookings in the same slot. */
  function techHasSlotConflict(db, techId, date, slot, excludeBookingId) {
    if (!techId) return false;
    return db.bookings.some(b =>
      b.techId === techId && b.date === date && b.timeSlot === slot &&
      b.id !== excludeBookingId &&
      [STATUS.ASSIGNED, STATUS.ACCEPTED, STATUS.ON_WAY, STATUS.IN_PROGRESS].includes(b.status));
  }

  /* ---------- UI helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function money(n) { return '$' + (Number(n) || 0).toFixed(2); }
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function statusBadge(status) {
    return '<span class="badge rounded-pill text-bg-' + (STATUS_BADGE[status] || 'secondary') + '">' + esc(status) + '</span>';
  }

  function toast(msg, type) {
    type = type || 'success';
    let holder = document.getElementById('hsp-toast-holder');
    if (!holder) {
      holder = document.createElement('div');
      holder.id = 'hsp-toast-holder';
      holder.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      holder.style.zIndex = '1080';
      document.body.appendChild(holder);
    }
    const el = document.createElement('div');
    el.className = 'toast align-items-center border-0 text-bg-' + (type === 'success' ? 'success' : type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'primary');
    el.setAttribute('role', 'alert');
    el.innerHTML = '<div class="d-flex"><div class="toast-body">' + esc(msg) + '</div>' +
      '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>';
    holder.appendChild(el);
    const t = new bootstrap.Toast(el, { delay: 3500 });
    t.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
  }

  /* Confirmation dialog returning a Promise<boolean>. */
  function confirmDialog(title, message, okLabel) {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'modal fade';
      el.innerHTML = '<div class="modal-dialog modal-dialog-centered"><div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title">' + esc(title) + '</h5>' +
        '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>' +
        '<div class="modal-body">' + esc(message) + '</div>' +
        '<div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
        '<button type="button" class="btn btn-primary confirm-ok">' + esc(okLabel || 'Confirm') + '</button></div></div></div></div>';
      document.body.appendChild(el);
      const modal = new bootstrap.Modal(el);
      el.querySelector('.confirm-ok').addEventListener('click', () => { modal.hide(); resolve(true); });
      el.addEventListener('hidden.bs.modal', () => { el.remove(); resolve(false); });
      modal.show();
    });
  }

  /* ---------- CSV export ---------- */
  function exportCsv(filename, rows) {
    if (!rows || !rows.length) { toast('No data to export.', 'warning'); return; }
    const csv = rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Report exported: ' + filename);
  }

  /* ---------- Pagination ---------- */
  function paginate(items, page, perPage) {
    const pages = Math.max(1, Math.ceil(items.length / perPage));
    page = Math.min(Math.max(1, page), pages);
    return { slice: items.slice((page - 1) * perPage, page * perPage), page: page, pages: pages, total: items.length };
  }
  function pagerControls(el, pg, onPage) {
    if (!el) return;
    if (pg.pages <= 1) { el.innerHTML = '<span class="small text-muted">' + pg.total + ' record(s)</span>'; return; }
    let html = '<ul class="pagination pagination-sm mb-0"><li class="page-item' + (pg.page <= 1 ? ' disabled' : '') + '"><a class="page-link" href="#" data-p="' + (pg.page - 1) + '">&laquo;</a></li>';
    for (let i = 1; i <= pg.pages; i++) html += '<li class="page-item' + (i === pg.page ? ' active' : '') + '"><a class="page-link" href="#" data-p="' + i + '">' + i + '</a></li>';
    html += '<li class="page-item' + (pg.page >= pg.pages ? ' disabled' : '') + '"><a class="page-link" href="#" data-p="' + (pg.page + 1) + '">&raquo;</a></li></ul>' +
      '<span class="small text-muted ms-2">' + pg.total + ' record(s)</span>';
    el.innerHTML = html;
    el.querySelectorAll('a[data-p]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); onPage(parseInt(a.dataset.p, 10)); }));
  }

  /* ---------- Validation helpers ---------- */
  const validators = {
    required: v => (v && String(v).trim()) !== '' || 'This field is required.',
    phone: v => /^\+?[0-9][0-9\s\-()]{6,17}$/.test(String(v).trim()) || 'Enter a valid phone number (7-18 digits, may start with +).',
    email: v => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)) || 'Enter a valid email address.',
    pastDate: v => { const d = new Date(v + 'T00:00:00'); const t = new Date(); t.setHours(0, 0, 0, 0); return (v && !isNaN(d) && d >= t) || 'Choose a date not in the past.'; },
    slot: v => TIME_SLOTS.includes(v) || 'Choose a time slot.',
    number: v => v === '' || (!isNaN(Number(v)) && Number(v) >= 0) || 'Enter a non-negative number.'
  };
  /* Validate one input element against a named rule; shows/hides feedback. */
  function validateField(input, rule) {
    const fn = validators[rule];
    const result = fn ? fn(input.value) : true;
    const ok = result === true;
    const fb = input.closest('.col, .col-md, .col-lg, .col-sm, .form-floating, .mb-3, .position-relative')?.querySelector('.invalid-feedback');
    input.classList.toggle('is-invalid', !ok);
    input.classList.toggle('is-valid', ok && input.value !== '');
    if (fb && !ok) fb.textContent = result;
    return ok;
  }

  /* ---------- Image upload: type/size validation + preview ---------- */
  const MAX_IMG_BYTES = 2 * 1024 * 1024;
  const ALLOWED_IMG = ['image/jpeg', 'image/png', 'image/webp'];
  function validateImageFile(file) {
    if (!file) return null;
    if (!ALLOWED_IMG.includes(file.type)) return 'Only JPG, PNG or WebP images are allowed.';
    if (file.size > MAX_IMG_BYTES) return 'Image must be smaller than 2 MB.';
    return null;
  }
  function readImagePreview(file, cb) {
    const r = new FileReader();
    r.onload = () => cb(r.result);
    r.readAsDataURL(file);
  }

  /* ---------- Demo session (role guard) ----------
     sessionStorage only — frontend demo, NOT secure authentication. */
  function setSession(role, techId) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role: role, techId: techId || null, at: Date.now() }));
  }
  function getSession() {
    try { const s = JSON.parse(sessionStorage.getItem(SESSION_KEY)); return s && s.role ? s : null; } catch (e) { return null; }
  }
  function requireRole(role) {
    const s = getSession();
    if (!s || s.role !== role) { window.location.href = role === 'admin' ? '../login.html?role=admin' : '../login.html?role=technician'; return null; }
    return s;
  }
  function logout() { sessionStorage.removeItem(SESSION_KEY); window.location.href = '../login.html'; }

  /* ---------- Query / misc ---------- */
  function qsParam(name) { return new URLSearchParams(location.search).get(name); }
  function getService(db, id) { return db.services.find(s => s.id === id); }
  function getCategory(db, id) { return db.categories.find(c => c.id === id); }
  function getTechnician(db, id) { return db.technicians.find(t => t.id === id); }
  function serviceName(db, id) { const s = getService(db, id); return s ? s.name : '—'; }
  function activePrice(svc) { return svc.pricingType === 'quote' ? null : svc.basePrice; }

  window.HSP = {
    STATUS, TRANSITIONS, STATUS_BADGE, TIME_SLOTS, COMMISSION_RATE,
    loadDb, saveDb, resetDb, seedData, genBookingId, logStatusChange, techHasSlotConflict,
    esc, money, fmtDate, fmtDateTime, statusBadge, toast, confirmDialog, exportCsv,
    paginate, pagerControls, validators, validateField, validateImageFile, readImagePreview,
    setSession, getSession, requireRole, logout, qsParam,
    getService, getCategory, getTechnician, serviceName, activePrice
  };
})(window);
