/* =========================================================
   technician.js — Technician panel logic (scoped to one demo technician)
   ========================================================= */
(function () {
  'use strict';
  const H = window.HSP;
  const session = H.requireRole('technician');
  if (!session) return;
  let db = H.loadDb();
  const save = () => H.saveDb(db);
  const me = () => H.getTechnician(db, session.techId) || db.technicians[0];

  /* ---------- Layout ---------- */
  const toggler = document.getElementById('sb-toggle');
  if (toggler) toggler.addEventListener('click', () => document.getElementById('techSidebar').classList.toggle('show'));
  const nameEl = document.getElementById('tech-name');
  if (nameEl) nameEl.textContent = me().name;
  const lo = document.getElementById('logout-link');
  if (lo) lo.addEventListener('click', e => { e.preventDefault(); H.logout(); });

  function myBookings() { return db.bookings.filter(b => b.techId === me().id); }

  /* =========================================================
     Dashboard
     ========================================================= */
  const dash = document.getElementById('td-cards');
  if (dash) {
    const jobs = myBookings();
    const today = new Date().toISOString().slice(0, 10);
    const todayJobs = jobs.filter(b => b.date === today && ![H.STATUS.COMPLETED, H.STATUS.CANCELLED].includes(b.status));
    const completed = jobs.filter(b => b.status === H.STATUS.COMPLETED);
    const earnings = completed.reduce((a, b) => a + (b.finalPrice || 0), 0);
    dash.innerHTML = [
      ['New / assigned jobs', jobs.filter(b => [H.STATUS.ASSIGNED, H.STATUS.NEW].includes(b.status)).length, 'bi-inbox', 'info'],
      ["Today's schedule", todayJobs.length, 'bi-calendar-day', ''],
      ['In progress', jobs.filter(b => [H.STATUS.ACCEPTED, H.STATUS.ON_WAY, H.STATUS.IN_PROGRESS].includes(b.status)).length, 'bi-hourglass-split', 'warning'],
      ['Completed jobs', completed.length, 'bi-check-circle', 'success'],
      ['Sample earnings (gross)', H.money(earnings), 'bi-cash-coin', 'accent'],
      ['Sample payable (after ' + (H.COMMISSION_RATE * 100) + '% fee)', H.money(earnings * (1 - H.COMMISSION_RATE)), 'bi-wallet2', 'accent']
    ].map(([l, v, i, cls]) => '<div class="col-6 col-lg-4"><div class="card stat-card ' + cls + '"><div class="card-body py-3"><div class="small text-muted">' + l + '</div><div class="stat-value">' + v + '</div></div></div></div>').join('');

    // Alerts: recent assignments / changes (last 24h history entries about me)
    const alerts = [];
    jobs.forEach(b => (b.history || []).forEach(h => {
      if ((h.to === H.STATUS.ASSIGNED || h.note || '').toLowerCase().includes('assigned') && Date.now() - new Date(h.at).getTime() < 864e5)
        alerts.push({ b: b, h: h });
    }));
    const alertWrap = document.getElementById('td-alerts');
    alertWrap.innerHTML = alerts.length ? alerts.slice(-3).reverse().map(a =>
      '<div class="alert alert-job d-flex justify-content-between align-items-center"><div>' +
      '<strong><i class="bi bi-bell"></i> Job assignment update</strong><br><span class="small">' + H.esc(a.b.id) + ' — ' + H.esc(H.serviceName(db, a.b.serviceId)) + ' · ' + H.fmtDateTime(a.h.at) + '</span></div>' +
      '<a class="btn btn-sm btn-navy" href="job-details.html?id=' + a.b.id + '">Open</a></div>').join('')
      : '<div class="empty-state py-3"><i class="bi bi-bell-slash"></i>No new assignment alerts in the last 24 hours.</div>';

    // Upcoming appointments
    const upcoming = jobs.filter(b => ![H.STATUS.COMPLETED, H.STATUS.CANCELLED, H.STATUS.NEW].includes(b.status))
      .sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot));
    document.getElementById('td-upcoming').innerHTML = upcoming.map(b =>
      '<tr><td><a href="job-details.html?id=' + b.id + '" class="fw-semi">' + H.esc(b.id) + '</a></td>' +
      '<td>' + H.esc(b.customer.name) + '</td><td>' + H.esc(H.serviceName(db, b.serviceId)) + '</td>' +
      '<td>' + H.esc(b.address) + ', ' + H.esc(b.city) + '</td>' +
      '<td>' + H.fmtDate(b.date) + '<br><span class="small text-muted">' + H.esc(b.timeSlot) + '</span></td>' +
      '<td>' + H.statusBadge(b.status) + '</td></tr>').join('') ||
      '<tr><td colspan="6"><div class="empty-state"><i class="bi bi-calendar-check"></i>No upcoming appointments.</div></td></tr>';
    document.getElementById('td-today-count').textContent = todayJobs.length + ' job(s) today';
  }

  /* =========================================================
     My Profile
     ========================================================= */
  const profForm = document.getElementById('prof-form');
  if (profForm) {
    const t = me();
    const catSel = document.getElementById('pf-cat');
    db.categories.filter(c => c.active).forEach(c => catSel.insertAdjacentHTML('beforeend', '<option value="' + c.id + '">' + H.esc(c.name) + '</option>'));
    document.getElementById('pf-name').value = t.name;
    document.getElementById('pf-phone').value = t.phone;
    document.getElementById('pf-email').value = t.email;
    catSel.value = t.categoryId;
    document.getElementById('pf-skills').value = t.skills;
    document.getElementById('pf-exp').value = t.experience;
    document.getElementById('pf-areas').value = t.areas.join(', ');
    document.getElementById('pf-readonly').textContent =
      'Verification: ' + t.verification.toUpperCase() + ' · Account status: ' + t.status + ' · Rating: ' + t.rating.toFixed(1) + '/5 · Completed jobs: ' + t.completedJobs + '. Verification status, rating and completed jobs are read-only (managed by the Super Admin).';
    let photoData = t.photo;
    const img = document.getElementById('pf-preview');
    if (t.photo) { img.src = t.photo; img.classList.remove('d-none'); }
    document.getElementById('pf-photo').addEventListener('change', e => {
      const f = e.target.files[0]; const err = H.validateImageFile(f);
      if (err) { H.toast(err, 'error'); e.target.value = ''; return; }
      H.readImagePreview(f, url => { photoData = url; img.src = url; img.classList.remove('d-none'); });
    });
    document.getElementById('prof-save').addEventListener('click', () => {
      let ok = true;
      [['pf-name', 'required'], ['pf-phone', 'phone'], ['pf-email', 'email'], ['pf-skills', 'required'], ['pf-exp', 'required'], ['pf-areas', 'required']]
        .forEach(([fid, rule]) => { if (!H.validateField(document.getElementById(fid), rule)) ok = false; });
      if (!ok) { H.toast('Please fix the highlighted fields.', 'error'); return; }
      Object.assign(t, {
        name: document.getElementById('pf-name').value.trim(),
        phone: document.getElementById('pf-phone').value.trim(),
        email: document.getElementById('pf-email').value.trim(),
        categoryId: catSel.value,
        skills: document.getElementById('pf-skills').value.trim(),
        experience: document.getElementById('pf-exp').value.trim(),
        areas: document.getElementById('pf-areas').value.split(',').map(s => s.trim()).filter(Boolean),
        photo: photoData
      });
      save(); document.getElementById('tech-name').textContent = t.name;
      H.toast('Profile saved. In production, admin approval may be required before changes go public.');
    });
  }

  /* =========================================================
     Availability
     ========================================================= */
  const availWrap = document.getElementById('avail-form');
  if (availWrap) {
    const t = me();
    const av = t.availability || { days: [], slots: [], breakFrom: '13:00', breakTo: '14:00', unavailableDates: [] };
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayWrap = document.getElementById('av-days'), slotWrap = document.getElementById('av-slots');
    DAYS.forEach(d => dayWrap.insertAdjacentHTML('beforeend', '<span class="day-chip pointer" data-day="' + d + '" role="button" tabindex="0">' + d + '</span>'));
    H.TIME_SLOTS.forEach(s => slotWrap.insertAdjacentHTML('beforeend', '<span class="slot-chip pointer" data-slot="' + s + '" role="button" tabindex="0">' + s + '</span>'));
    function paint() {
      dayWrap.querySelectorAll('.day-chip').forEach(c => c.classList.toggle('selected', av.days.includes(c.dataset.day)));
      slotWrap.querySelectorAll('.slot-chip').forEach(c => c.classList.toggle('selected', av.slots.includes(c.dataset.slot)));
    }
    dayWrap.querySelectorAll('.day-chip').forEach(c => c.addEventListener('click', () => {
      const d = c.dataset.day;
      av.days = av.days.includes(d) ? av.days.filter(x => x !== d) : av.days.concat(d); paint();
    }));
    slotWrap.querySelectorAll('.slot-chip').forEach(c => c.addEventListener('click', () => {
      const s = c.dataset.slot;
      av.slots = av.slots.includes(s) ? av.slots.filter(x => x !== s) : av.slots.concat(s); paint();
    }));
    document.getElementById('av-breakfrom').value = av.breakFrom;
    document.getElementById('av-breakto').value = av.breakTo;
    document.getElementById('av-dates').value = (av.unavailableDates || []).join(', ');
    document.getElementById('av-online').checked = t.status === 'active';
    paint();
    document.getElementById('avail-save').addEventListener('click', () => {
      const bf = document.getElementById('av-breakfrom').value, bt = document.getElementById('av-breakto').value;
      if (bf && bt && bf >= bt) { H.toast('Break start must be before break end.', 'error'); return; }
      if (!av.days.length) { H.toast('Select at least one working day.', 'error'); return; }
      if (!av.slots.length) { H.toast('Select at least one available time slot.', 'error'); return; }
      const dates = document.getElementById('av-dates').value.split(',').map(s => s.trim()).filter(Boolean);
      const bad = dates.find(d => !/^\d{4}-\d{2}-\d{2}$/.test(d));
      if (bad) { H.toast('Unavailable dates must be in YYYY-MM-DD format (found: ' + bad + ').', 'error'); return; }
      av.breakFrom = bf; av.breakTo = bt; av.unavailableDates = dates;
      t.availability = av;
      t.status = document.getElementById('av-online').checked ? 'active' : 'unavailable';
      save(); H.toast('Availability saved.');
    });
  }

  /* =========================================================
     Assigned Jobs
     ========================================================= */
  const jobsBody = document.getElementById('jobs-table-body');
  if (jobsBody) {
    function renderJobs() {
      const q = document.getElementById('j-search').value.trim().toLowerCase();
      const st = document.getElementById('j-status').value;
      const list = myBookings().filter(b =>
        (!q || b.id.toLowerCase().includes(q) || b.customer.name.toLowerCase().includes(q) || H.serviceName(db, b.serviceId).toLowerCase().includes(q)) &&
        (!st || b.status === st))
        .sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot));
      jobsBody.innerHTML = list.map(b =>
        '<tr><td><a class="fw-semi" href="job-details.html?id=' + b.id + '">' + H.esc(b.id) + '</a></td>' +
        '<td>' + H.esc(b.customer.name) + '</td><td>' + H.esc(H.serviceName(db, b.serviceId)) + '</td>' +
        '<td>' + H.esc(b.address) + ', ' + H.esc(b.city) + '</td>' +
        '<td>' + H.fmtDate(b.date) + '<br><span class="small text-muted">' + H.esc(b.timeSlot) + '</span></td>' +
        '<td>' + H.statusBadge(b.status) + '</td>' +
        '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="job-details.html?id=' + b.id + '">View Details</a></td></tr>')
        .join('') || '<tr><td colspan="7"><div class="empty-state"><i class="bi bi-inbox"></i>No assigned jobs match the filters.</div></td></tr>';
    }
    Object.values(H.STATUS).forEach(s => document.getElementById('j-status').insertAdjacentHTML('beforeend', '<option>' + s + '</option>'));
    document.getElementById('j-search').addEventListener('input', renderJobs);
    document.getElementById('j-status').addEventListener('change', renderJobs);
    renderJobs();
  }

  /* =========================================================
     Job Details & Status Updates
     ========================================================= */
  const jdWrap = document.getElementById('jd-wrap');
  if (jdWrap) {
    const b = db.bookings.find(x => x.id === H.qsParam('id') && myBookings().some(m => m.id === x.id));
    if (!b) { jdWrap.innerHTML = '<div class="empty-state"><i class="bi bi-question-circle"></i>Job not found or not assigned to you. <a href="assigned-jobs.html">Back to assigned jobs</a></div>'; }
    else {
      const svc = H.getService(db, b.serviceId);
      document.getElementById('jd-title').textContent = 'Job ' + b.id;
      document.getElementById('jd-status').innerHTML = H.statusBadge(b.status);

      let beforeImg = '', afterImg = '';
      const notes = (b.techNotes || []);

      function renderJob() {
        const nexts = H.TRANSITIONS[b.status] || [];
        jdWrap.innerHTML =
          '<div class="row g-4">' +
          '<div class="col-lg-7"><div class="card p-4 mb-3"><h6 class="fw-semi mb-3">Customer &amp; service</h6>' +
          '<dl class="row mb-0">' +
          '<dt class="col-sm-4">Customer</dt><dd class="col-sm-8">' + H.esc(b.customer.name) + '</dd>' +
          '<dt class="col-sm-4">Phone</dt><dd class="col-sm-8"><a href="tel:' + H.esc(b.customer.phone) + '">' + H.esc(b.customer.phone) + '</a></dd>' +
          '<dt class="col-sm-4">Service address</dt><dd class="col-sm-8">' + H.esc(b.address) + ', ' + H.esc(b.city) + '</dd>' +
          '<dt class="col-sm-4">Service</dt><dd class="col-sm-8">' + H.esc(svc ? svc.name : '—') + '</dd>' +
          '<dt class="col-sm-4">Appointment</dt><dd class="col-sm-8">' + H.fmtDate(b.date) + ', ' + H.esc(b.timeSlot) + '</dd>' +
          '<dt class="col-sm-4">Problem</dt><dd class="col-sm-8">' + H.esc(b.notes) + '</dd>' +
          (b.image ? '<dt class="col-sm-4">Customer photo</dt><dd class="col-sm-8"><img src="' + b.image + '" class="upload-preview" alt="Customer photo"></dd>' : '') +
          '<dt class="col-sm-4">Price estimate</dt><dd class="col-sm-8">' + (b.estPrice ? H.money(b.estPrice) : 'Quote after inspection') + '</dd>' +
          '</dl></div>' +
          '<div class="card p-4"><h6 class="fw-semi mb-3">Status history</h6>' +
          '<ul class="hsp-timeline">' +
          '<li class="muted"><div class="small text-muted">' + H.fmtDateTime(b.createdAt) + '</div><div>Booking created — ' + H.STATUS.NEW + '</div></li>' +
          (b.history || []).map(h => '<li class="' + (h === b.history[b.history.length - 1] ? '' : 'muted') + '"><div class="small text-muted">' + H.fmtDateTime(h.at) + ' · ' + H.esc(h.actor) + '</div><div>' + H.esc(h.from) + ' → <strong>' + H.esc(h.to) + '</strong>' + (h.note ? '<br><span class="small text-muted">' + H.esc(h.note) + '</span>' : '') + '</div></li>').join('') +
          '</ul></div></div>' +
          '<div class="col-lg-5">' +
          '<div class="card p-4 mb-3"><h6 class="fw-semi mb-3">Update job status</h6>' +
          (b.status === H.STATUS.NEW
            ? '<div class="alert alert-info small">Waiting for admin assignment.</div>'
            : nexts.length
              ? '<div class="d-grid gap-2" id="jd-transitions">' +
                nexts.filter(s => s !== H.STATUS.CANCELLED).map(s =>
                  '<button class="btn ' + (s === H.STATUS.COMPLETED ? 'btn-success' : s === H.STATUS.UNABLE ? 'btn-outline-danger' : 'btn-navy') + '" data-to="' + s + '"><i class="bi bi-arrow-right"></i> Mark as ' + s + '</button>').join('') +
                (nexts.includes(H.STATUS.CANCELLED) ? '<button class="btn btn-outline-danger" data-to="' + H.STATUS.CANCELLED + '"><i class="bi bi-x-circle"></i> Cancel job</button>' : '') +
                '</div>'
              : '<div class="alert alert-secondary small mb-0">This job is closed — no further status changes allowed.</div>') +
          '</div>' +
          (svc && svc.pricingType === 'quote' && [H.STATUS.IN_PROGRESS, H.STATUS.ACCEPTED, H.STATUS.ON_WAY].includes(b.status)
            ? '<div class="card p-4 mb-3"><h6 class="fw-semi mb-2">Quote-based service</h6>' +
              '<label class="form-label" for="jd-quote">Proposed quote / final amount ($)</label>' +
              '<div class="input-group mb-2"><span class="input-group-text">$</span><input id="jd-quote" type="number" min="0" step="0.01" class="form-control" value="' + (b.quotedPrice || '') + '"></div>' +
              '<button class="btn btn-brand btn-sm" id="jd-quote-save">Submit quote for admin review</button></div>'
            : (b.quotedPrice ? '<div class="alert alert-info small">Quoted amount submitted for admin review: <strong>' + H.money(b.quotedPrice) + '</strong></div>' : '')) +
          '<div class="card p-4 mb-3"><h6 class="fw-semi mb-3">Job notes</h6>' +
          '<div id="jd-notes" class="mb-2">' + (notes.length ? notes.map(n => '<div class="border rounded p-2 mb-2 small"><div class="text-muted">' + H.fmtDateTime(n.at) + '</div>' + H.esc(n.text) + '</div>').join('') : '<p class="small text-muted mb-0">No notes yet.</p>') + '</div>' +
          '<label class="form-label" for="jd-note">Add a note</label><textarea id="jd-note" class="form-control" rows="2"></textarea>' +
          '<button class="btn btn-outline-primary btn-sm mt-2" id="jd-note-save">Add note</button></div>' +
          '<div class="card p-4"><h6 class="fw-semi mb-3">Before / after photos (demo)</h6>' +
          '<div class="row g-2 mb-2" id="jd-photos">' +
          (b.beforePhoto ? '<div class="col-6"><img src="' + b.beforePhoto + '" class="upload-preview w-100" alt="Before photo"><span class="small text-muted">Before</span></div>' : '') +
          (b.afterPhoto ? '<div class="col-6"><img src="' + b.afterPhoto + '" class="upload-preview w-100" alt="After photo"><span class="small text-muted">After</span></div>' : '') +
          '</div>' +
          '<label class="form-label" for="jd-before">Before photo</label><input type="file" id="jd-before" class="form-control form-control-sm mb-2" accept="image/jpeg,image/png,image/webp">' +
          '<label class="form-label" for="jd-after">After photo</label><input type="file" id="jd-after" class="form-control form-control-sm" accept="image/jpeg,image/png,image/webp"></div>' +
          '</div></div>';
        bindJobActions();
      }

      function bindJobActions() {
        jdWrap.querySelectorAll('#jd-transitions [data-to]').forEach(btn => btn.addEventListener('click', () => {
          const to = btn.dataset.to;
          if (to === H.STATUS.COMPLETED) {
            // Completed requires final amount for quote-based services
            const svc2 = H.getService(db, b.serviceId);
            if (svc2 && svc2.pricingType === 'quote' && !b.finalPrice && !b.quotedPrice) {
              H.toast('Enter the final amount in the quote box before completing this job.', 'error'); return;
            }
            if (!b.quotedPrice || !b.finalPrice) b.finalPrice = b.finalPrice || b.quotedPrice || b.estPrice;
          }
          if (to === H.STATUS.CANCELLED || to === H.STATUS.UNABLE) {
            const note = prompt('Add a short reason/note for "' + to + '":') || '';
            if (!note) { H.toast('A note is required for this status.', 'error'); return; }
            const from = b.status; b.status = to; if (to === H.STATUS.CANCELLED) b.cancelReason = note;
            H.logStatusChange(db, b.id, from, to, me().name, note);
          } else {
            const from = b.status; b.status = to;
            H.logStatusChange(db, b.id, from, to, me().name, '');
          }
          save(); document.getElementById('jd-status').innerHTML = H.statusBadge(b.status);
          renderJob(); H.toast('Status updated to "' + b.status + '".');
        }));
        const qs = document.getElementById('jd-quote-save');
        if (qs) qs.addEventListener('click', () => {
          const v = document.getElementById('jd-quote').value;
          if (v === '' || isNaN(Number(v)) || Number(v) < 0) { H.toast('Enter a valid non-negative amount.', 'error'); return; }
          b.quotedPrice = Number(v);
          const from = b.status;
          H.logStatusChange(db, b.id, from, from, me().name, 'Quote of ' + H.money(b.quotedPrice) + ' submitted for admin review');
          save(); renderJob(); H.toast('Quote submitted for admin review.');
        });
        document.getElementById('jd-note-save').addEventListener('click', () => {
          const el = document.getElementById('jd-note');
          if (!el.value.trim()) { H.toast('Note cannot be empty.', 'error'); return; }
          b.techNotes = b.techNotes || [];
          b.techNotes.push({ at: new Date().toISOString(), text: el.value.trim() });
          save(); renderJob(); H.toast('Note added.');
        });
        [['jd-before', 'beforePhoto'], ['jd-after', 'afterPhoto']].forEach(([fid, key]) => {
          const inp = document.getElementById(fid);
          if (inp) inp.addEventListener('change', () => {
            const f = inp.files[0]; const err = H.validateImageFile(f);
            if (err) { H.toast(err, 'error'); inp.value = ''; return; }
            H.readImagePreview(f, url => { b[key] = url; save(); renderJob(); H.toast('Photo attached (demo — stored in browser).'); });
          });
        });
      }
      renderJob();
    }
  }

  /* =========================================================
     Job History
     ========================================================= */
  const histBody = document.getElementById('hist-table-body');
  if (histBody) {
    function renderHist() {
      const from = document.getElementById('h-from').value, to = document.getElementById('h-to').value;
      const st = document.getElementById('h-status').value;
      const list = myBookings().filter(b =>
        [H.STATUS.COMPLETED, H.STATUS.CANCELLED, H.STATUS.UNABLE].includes(b.status) &&
        (!from || b.date >= from) && (!to || b.date <= to) && (!st || b.status === st))
        .sort((a, b) => b.date.localeCompare(a.date));
      histBody.innerHTML = list.map(b =>
        '<tr><td><a class="fw-semi" href="job-details.html?id=' + b.id + '">' + H.esc(b.id) + '</a></td>' +
        '<td>' + H.esc(H.serviceName(db, b.serviceId)) + '</td><td>' + H.esc(b.customer.name) + '</td>' +
        '<td>' + H.fmtDate(b.date) + '</td><td>' + H.statusBadge(b.status) + '</td>' +
        '<td>' + (b.finalPrice ? H.money(b.finalPrice) : '—') + '</td>' +
        '<td>' + ((b.history || []).length + 1) + ' entries</td></tr>')
        .join('') || '<tr><td colspan="7"><div class="empty-state"><i class="bi bi-clock-history"></i>No completed or closed jobs match the filters.</div></td></tr>';
    }
    Object.values(H.STATUS).forEach(s => document.getElementById('h-status').insertAdjacentHTML('beforeend', '<option>' + s + '</option>'));
    ['h-from', 'h-to', 'h-status'].forEach(id => document.getElementById(id).addEventListener('change', renderHist));
    renderHist();
  }

  /* =========================================================
     Earnings (read-only)
     ========================================================= */
  const earnBody = document.getElementById('earn-table-body');
  if (earnBody) {
    function renderEarn() {
      const from = document.getElementById('e-from').value, to = document.getElementById('e-to').value;
      const done = myBookings().filter(b => b.status === H.STATUS.COMPLETED &&
        (!from || b.date >= from) && (!to || b.date <= to)).sort((a, b) => b.date.localeCompare(a.date));
      const gross = done.reduce((a, b) => a + (b.finalPrice || 0), 0);
      const fee = gross * H.COMMISSION_RATE;
      document.getElementById('e-cards').innerHTML = [
        ['Completed jobs (filtered)', done.length, ''],
        ['Gross amount (sample)', H.money(gross), 'info'],
        ['Platform fee (' + (H.COMMISSION_RATE * 100) + '%, sample)', H.money(fee), 'warning'],
        ['Payable balance (sample)', H.money(gross - fee), 'success']
      ].map(([l, v, cls]) => '<div class="col-6 col-lg-3"><div class="card stat-card ' + cls + '"><div class="card-body py-3"><div class="small text-muted">' + l + '</div><div class="stat-value">' + v + '</div></div></div></div>').join('');
      earnBody.innerHTML = done.map(b =>
        '<tr><td><a href="job-details.html?id=' + b.id + '">' + H.esc(b.id) + '</a></td>' +
        '<td>' + H.esc(H.serviceName(db, b.serviceId)) + '</td><td>' + H.fmtDate(b.date) + '</td>' +
        '<td>' + H.money(b.finalPrice || 0) + '</td>' +
        '<td>' + H.money((b.finalPrice || 0) * H.COMMISSION_RATE) + '</td>' +
        '<td>' + H.money((b.finalPrice || 0) * (1 - H.COMMISSION_RATE)) + '</td>' +
        '<td><span class="badge text-bg-success">' + H.esc(b.paymentStatus) + '</span></td></tr>')
        .join('') || '<tr><td colspan="7"><div class="empty-state"><i class="bi bi-cash-coin"></i>No completed jobs in the selected range.</div></td></tr>';
      document.getElementById('e-payout').textContent = 'Payout status (sample): weekly payout every Monday · records are read-only and cannot be edited.';
    }
    document.getElementById('e-from').addEventListener('change', renderEarn);
    document.getElementById('e-to').addEventListener('change', renderEarn);
    renderEarn();
  }
})();
