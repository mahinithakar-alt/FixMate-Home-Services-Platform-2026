/* =========================================================
   admin.js — Super Admin panel logic
   ========================================================= */
(function () {
  'use strict';
  const H = window.HSP;
  if (!H.requireRole('admin')) return;
  let db = H.loadDb();
  const ACTOR = 'Super Admin';
  const save = () => H.saveDb(db);

  /* ---------- Shared layout ---------- */
  // Sidebar toggle (mobile)
  const toggler = document.getElementById('sb-toggle');
  if (toggler) {
    toggler.addEventListener('click', () => {
      document.getElementById('adminSidebar').classList.toggle('show');
      document.getElementById('sbBackdrop').classList.toggle('show');
    });
    document.getElementById('sbBackdrop').addEventListener('click', () => {
      document.getElementById('adminSidebar').classList.remove('show');
      document.getElementById('sbBackdrop').classList.remove('show');
    });
  }
  // Notification count = new bookings
  const notifBadge = document.getElementById('notif-count');
  if (notifBadge) {
    const n = db.bookings.filter(b => b.status === H.STATUS.NEW).length;
    if (!n) notifBadge.classList.add('d-none');
  }
  const lo = document.getElementById('logout-link');
  if (lo) lo.addEventListener('click', e => { e.preventDefault(); H.logout(); });
  const reset = document.getElementById('reset-demo-link');
  if (reset) reset.addEventListener('click', async e => {
    e.preventDefault();
    if (await H.confirmDialog('Reset demo data', 'This restores all sample bookings, technicians and settings in this browser. Continue?', 'Reset')) {
      db = H.resetDb(); save(); location.reload();
    }
  });

  /* ---------- Simple canvas charts (vanilla JS) ---------- */
  function drawBarChart(canvas, labels, values, color) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.parentElement.clientWidth || 400;
    const Hh = canvas.height = 220;
    ctx.clearRect(0, 0, W, Hh);
    const max = Math.max(1, ...values), pad = 30, bw = (W - pad * 2) / labels.length;
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    values.forEach((v, i) => {
      const h = (Hh - 40) * (v / max);
      const x = pad + i * bw + bw * 0.15, y = Hh - 25 - h;
      ctx.fillStyle = color || '#143059';
      ctx.fillRect(x, y, bw * 0.7, h);
      ctx.fillStyle = '#5b6b83';
      ctx.fillText(labels[i], pad + i * bw + bw / 2, Hh - 8);
      ctx.fillText(String(v), pad + i * bw + bw / 2, y - 4);
    });
  }
  function drawLineChart(canvas, labels, values) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.parentElement.clientWidth || 400;
    const Hh = canvas.height = 220;
    ctx.clearRect(0, 0, W, Hh);
    const max = Math.max(1, ...values), pad = 34;
    ctx.strokeStyle = '#e3e8ef';
    [0, .25, .5, .75, 1].forEach(f => {
      const y = 20 + (Hh - 45) * (1 - f);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - 10, y); ctx.stroke();
      ctx.fillStyle = '#5b6b83'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(max * f), pad - 5, y + 3);
    });
    ctx.strokeStyle = '#143059'; ctx.lineWidth = 2; ctx.beginPath();
    labels.forEach((l, i) => {
      const x = pad + (W - pad - 20) * (labels.length === 1 ? 0 : i / (labels.length - 1));
      const y = 20 + (Hh - 45) * (1 - values[i] / max);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = '#143059';
    labels.forEach((l, i) => {
      const x = pad + (W - pad - 20) * (labels.length === 1 ? 0 : i / (labels.length - 1));
      const y = 20 + (Hh - 45) * (1 - values[i] / max);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#5b6b83'; ctx.fillText(l, x, Hh - 8);
    });
  }

  /* =========================================================
     Dashboard
     ========================================================= */
  const dashCards = document.getElementById('dash-cards');
  if (dashCards) {
    function renderDash() {
      const from = document.getElementById('f-from').value;
      const to = document.getElementById('f-to').value;
      const cat = document.getElementById('f-cat').value;
      const tech = document.getElementById('f-tech').value;
      const st = document.getElementById('f-status').value;

      let list = db.bookings.slice();
      if (from) list = list.filter(b => b.date >= from);
      if (to) list = list.filter(b => b.date <= to);
      if (cat) list = list.filter(b => { const s = H.getService(db, b.serviceId); return s && s.catId === cat; });
      if (tech) list = list.filter(b => b.techId === tech);
      if (st) list = list.filter(b => b.status === st);

      const count = s => list.filter(b => b.status === s).length;
      const revenue = list.filter(b => b.status === H.STATUS.COMPLETED).reduce((a, b) => a + (b.finalPrice || 0), 0);

      dashCards.innerHTML = [
        ['Total bookings', list.length, 'bi-list-check', ''],
        ['New requests', count(H.STATUS.NEW), 'bi-inbox', 'info'],
        ['Confirmed (assigned/accepted)', list.filter(b => [H.STATUS.ASSIGNED, H.STATUS.ACCEPTED, H.STATUS.ON_WAY].includes(b.status)).length, 'bi-check2-square', ''],
        ['In progress', count(H.STATUS.IN_PROGRESS), 'bi-hourglass-split', 'warning'],
        ['Completed', count(H.STATUS.COMPLETED), 'bi-check-circle', 'success'],
        ['Cancelled', count(H.STATUS.CANCELLED), 'bi-x-circle', 'danger'],
        ['Revenue (sample)', H.money(revenue), 'bi-cash-coin', 'accent'],
        ['Commission (15%, sample)', H.money(revenue * H.COMMISSION_RATE), 'bi-percent', 'accent']
      ].map(([label, val, icon, cls]) =>
        '<div class="col-6 col-lg-3"><div class="card stat-card ' + cls + '"><div class="card-body py-3">' +
        '<div class="d-flex justify-content-between align-items-center"><span class="small text-muted">' + label + '</span><i class="bi ' + icon + ' text-brand"></i></div>' +
        '<div class="stat-value">' + val + '</div></div></div></div>').join('');

      // Recent bookings table (latest 8 in filter)
      const tbody = document.getElementById('dash-recent');
      const recent = list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
      tbody.innerHTML = recent.map(b => {
        const svc = H.getService(db, b.serviceId);
        const t = H.getTechnician(db, b.techId);
        return '<tr>' +
          '<td><a href="booking-details.html?id=' + b.id + '" class="fw-semi">' + H.esc(b.id) + '</a></td>' +
          '<td>' + H.esc(b.customer.name) + '</td>' +
          '<td>' + H.esc(svc ? svc.name : '—') + '</td>' +
          '<td>' + H.esc(t ? t.name : 'Unassigned') + '</td>' +
          '<td>' + H.fmtDate(b.date) + '<br><span class="small text-muted">' + H.esc(b.timeSlot) + '</span></td>' +
          '<td>' + H.statusBadge(b.status) + '</td>' +
          '<td class="text-end">' + (b.finalPrice ? H.money(b.finalPrice) : (b.estPrice ? H.money(b.estPrice) : '—')) + '</td>' +
          '</tr>';
      }).join('') || '<tr><td colspan="7"><div class="empty-state"><i class="bi bi-inbox"></i>No bookings match the selected filters.</div></td></tr>';

      // Charts: bookings per day (last 7 days with data) & popular categories
      const dayMap = {};
      list.forEach(b => { dayMap[b.date] = (dayMap[b.date] || 0) + 1; });
      const days = Object.keys(dayMap).sort().slice(-7);
      drawLineChart(document.getElementById('chart-trend'), days.map(d => d.slice(5)), days.map(d => dayMap[d]));
      const catMap = {};
      list.forEach(b => { const s = H.getService(db, b.serviceId); if (s) catMap[s.catId] = (catMap[s.catId] || 0) + 1; });
      const cats = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]).slice(0, 6);
      drawBarChart(document.getElementById('chart-cats'), cats.map(c => H.getCategory(db, c)?.name.split(' ')[0] || c), cats.map(c => catMap[c]), '#f5a623');
    }
    // Filters
    db.categories.forEach(c => document.getElementById('f-cat').insertAdjacentHTML('beforeend', '<option value="' + c.id + '">' + H.esc(c.name) + '</option>'));
    db.technicians.forEach(t => document.getElementById('f-tech').insertAdjacentHTML('beforeend', '<option value="' + t.id + '">' + H.esc(t.name) + '</option>'));
    Object.values(H.STATUS).forEach(s => document.getElementById('f-status').insertAdjacentHTML('beforeend', '<option>' + s + '</option>'));
    ['f-from', 'f-to', 'f-cat', 'f-tech', 'f-status'].forEach(id => document.getElementById(id).addEventListener('change', renderDash));
    renderDash();
  }

  /* =========================================================
     Technician Management
     ========================================================= */
  const techTable = document.getElementById('tech-table-body');
  if (techTable) {
    let page = 1;
    const PER = 6;
    function techFilters() {
      return {
        q: document.getElementById('t-search').value.trim().toLowerCase(),
        cat: document.getElementById('t-cat').value,
        area: document.getElementById('t-area').value,
        avail: document.getElementById('t-avail').value,
        ver: document.getElementById('t-ver').value
      };
    }
    function filteredTechs() {
      const f = techFilters();
      return db.technicians.filter(t =>
        (!f.q || t.name.toLowerCase().includes(f.q) || t.email.toLowerCase().includes(f.q)) &&
        (!f.cat || t.categoryId === f.cat) &&
        (!f.area || t.areas.includes(f.area)) &&
        (!f.avail || t.status === f.avail) &&
        (!f.ver || t.verification === f.ver));
    }
    function renderTechs() {
      const sortKey = document.getElementById('t-sort').value;
      let list = filteredTechs();
      const sorters = {
        name: (a, b) => a.name.localeCompare(b.name),
        rating: (a, b) => b.rating - a.rating,
        jobs: (a, b) => b.completedJobs - a.completedJobs
      };
      list.sort(sorters[sortKey] || sorters.name);
      const pg = H.paginate(list, page, PER);
      techTable.innerHTML = pg.slice.map(t => {
        const cat = H.getCategory(db, t.categoryId);
        const initials = t.name.split(' ').map(x => x[0]).join('').slice(0, 2);
        const verBadge = t.verification === 'verified' ? '<span class="badge text-bg-success">Verified</span>' : t.verification === 'pending' ? '<span class="badge text-bg-warning">Pending</span>' : '<span class="badge text-bg-danger">Rejected</span>';
        const stBadge = t.status === 'active' ? '<span class="badge text-bg-primary">Active</span>' : t.status === 'pending' ? '<span class="badge text-bg-warning">Pending</span>' : '<span class="badge text-bg-secondary">Suspended</span>';
        return '<tr>' +
          '<td><div class="d-flex align-items-center gap-2"><span class="avatar-sm">' + H.esc(initials) + '</span><div><div class="fw-semi">' + H.esc(t.name) + '</div><div class="small text-muted">' + H.esc(t.phone) + '</div></div></div></td>' +
          '<td>' + H.esc(cat ? cat.name : '—') + '</td>' +
          '<td>' + t.areas.map(H.esc).join(', ') + '</td>' +
          '<td>' + stBadge + ' ' + verBadge + '</td>' +
          '<td><i class="bi bi-star-fill text-warning"></i> ' + t.rating.toFixed(1) + '</td>' +
          '<td>' + t.completedJobs + '</td>' +
          '<td class="text-end">' +
          '<button class="btn btn-sm btn-outline-primary me-1" data-view="' + t.id + '"><i class="bi bi-eye"></i></button>' +
          '<button class="btn btn-sm btn-outline-secondary me-1" data-edit="' + t.id + '"><i class="bi bi-pencil"></i></button>' +
          '<div class="dropdown d-inline"><button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-label="More actions"></button>' +
          '<ul class="dropdown-menu dropdown-menu-end">' +
          (t.status === 'pending' ? '<li><a class="dropdown-item" href="#" data-approve="' + t.id + '">Approve</a></li><li><a class="dropdown-item text-danger" href="#" data-reject="' + t.id + '">Reject</a></li>' : '') +
          (t.status === 'active' ? '<li><a class="dropdown-item text-danger" href="#" data-suspend="' + t.id + '">Suspend</a></li>' : '') +
          (t.status === 'suspended' ? '<li><a class="dropdown-item" href="#" data-reactivate="' + t.id + '">Reactivate</a></li>' : '') +
          '<li><a class="dropdown-item text-danger" href="#" data-del="' + t.id + '">Delete</a></li>' +
          '</ul></div></td></tr>';
      }).join('') || '<tr><td colspan="7"><div class="empty-state"><i class="bi bi-people"></i>No technicians match the filters.</div></td></tr>';
      H.pagerControls(document.getElementById('tech-pager'), pg, p => { page = p; renderTechs(); });

      // bind actions
      techTable.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => techDetails(b.dataset.view)));
      techTable.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => techForm(b.dataset.edit)));
      const act = (attr, fn, msg, type) => techTable.querySelectorAll('[' + attr + ']').forEach(a => a.addEventListener('click', async e => {
        e.preventDefault();
        if (msg && !await H.confirmDialog('Confirm', msg, 'Yes')) return;
        fn(a.getAttribute(attr)); save(); renderTechs(); H.toast('Updated.', type || 'success');
      }));
      act('data-approve', id => { const t = db.technicians.find(x => x.id === id); t.status = 'active'; t.verification = 'verified'; });
      act('data-reject', id => { const t = db.technicians.find(x => x.id === id); t.status = 'suspended'; t.verification = 'rejected'; });
      act('data-suspend', id => { const t = db.technicians.find(x => x.id === id); t.status = 'suspended'; }, 'Suspend this technician? Their future assignments will be blocked.');
      act('data-reactivate', id => { const t = db.technicians.find(x => x.id === id); t.status = 'active'; });
      act('data-del', id => { db.technicians = db.technicians.filter(x => x.id !== id); }, 'Delete this technician? Assigned bookings will show as Unassigned.', 'warning');
    }
    ['t-search', 't-cat', 't-area', 't-avail', 't-ver', 't-sort'].forEach(id =>
      document.getElementById(id).addEventListener(id === 't-search' ? 'input' : 'change', () => { page = 1; renderTechs(); }));
    document.getElementById('t-clear').addEventListener('click', () => {
      ['t-search', 't-cat', 't-area', 't-avail', 't-ver'].forEach(id => document.getElementById(id).value = '');
      page = 1; renderTechs();
    });
    db.categories.forEach(c => {
      document.getElementById('t-cat').insertAdjacentHTML('beforeend', '<option value="' + c.id + '">' + H.esc(c.name) + '</option>');
      document.getElementById('tf-cat').insertAdjacentHTML('beforeend', '<option value="' + c.id + '">' + H.esc(c.name) + '</option>');
    });
    [...new Set(db.technicians.flatMap(t => t.areas))].forEach(a => document.getElementById('t-area').insertAdjacentHTML('beforeend', '<option>' + H.esc(a) + '</option>'));

    // Details modal
    function techDetails(id) {
      const t = H.getTechnician(db, id);
      const cat = H.getCategory(db, t.categoryId);
      const jobs = db.bookings.filter(b => b.techId === t.id);
      const done = jobs.filter(b => b.status === H.STATUS.COMPLETED);
      const earnings = done.reduce((a, b) => a + (b.finalPrice || 0), 0);
      document.getElementById('td-body').innerHTML =
        '<div class="text-center mb-3"><span class="avatar-sm" style="width:64px;height:64px;font-size:1.4rem">' + H.esc(t.name.split(' ').map(x => x[0]).join('').slice(0, 2)) + '</span>' +
        '<h5 class="mt-2 mb-0">' + H.esc(t.name) + '</h5><p class="small text-muted">' + H.esc(cat ? cat.name : '') + ' · ' + H.esc(t.experience) + ' experience</p></div>' +
        '<table class="table table-sm">' +
        '<tr><th>Phone</th><td>' + H.esc(t.phone) + '</td></tr>' +
        '<tr><th>Email</th><td>' + H.esc(t.email) + '</td></tr>' +
        '<tr><th>Skills</th><td>' + H.esc(t.skills) + '</td></tr>' +
        '<tr><th>Service areas</th><td>' + t.areas.map(H.esc).join(', ') + '</td></tr>' +
        '<tr><th>Working hours</th><td>' + H.esc(t.hours) + '</td></tr>' +
        '<tr><th>Verification</th><td>' + H.esc(t.verification) + '</td></tr>' +
        '<tr><th>Assigned jobs</th><td>' + jobs.length + ' (' + done.length + ' completed)</td></tr>' +
        '<tr><th>Rating</th><td>' + t.rating.toFixed(1) + ' / 5</td></tr>' +
        '<tr><th>Earnings (sample)</th><td>' + H.money(earnings) + ' gross · ' + H.money(earnings * (1 - H.COMMISSION_RATE)) + ' payable</td></tr>' +
        '</table>';
      new bootstrap.Modal('#techDetailsModal').show();
    }

    // Add/Edit form (modal)
    let editId = null, photoData = '';
    function techForm(id) {
      editId = id || null; photoData = '';
      const t = id ? H.getTechnician(db, id) : null;
      document.getElementById('tf-title').textContent = t ? 'Edit Technician' : 'Add Technician';
      document.getElementById('tf-form').reset();
      document.getElementById('tf-preview').classList.add('d-none');
      ['tf-name', 'tf-phone', 'tf-email', 'tf-skills', 'tf-exp', 'tf-hours'].forEach(fid => document.getElementById(fid).classList.remove('is-invalid', 'is-valid'));
      if (t) {
        document.getElementById('tf-name').value = t.name;
        document.getElementById('tf-phone').value = t.phone;
        document.getElementById('tf-email').value = t.email;
        document.getElementById('tf-cat').value = t.categoryId;
        document.getElementById('tf-skills').value = t.skills;
        document.getElementById('tf-exp').value = t.experience;
        document.getElementById('tf-areas').value = t.areas.join(', ');
        document.getElementById('tf-hours').value = t.hours;
        document.getElementById('tf-ver').value = t.verification;
      }
      new bootstrap.Modal('#techFormModal').show();
    }
    document.getElementById('add-tech-btn').addEventListener('click', () => techForm(null));
    document.getElementById('tf-photo').addEventListener('change', e => {
      const f = e.target.files[0];
      const err = H.validateImageFile(f);
      if (err) { H.toast(err, 'error'); e.target.value = ''; return; }
      H.readImagePreview(f, url => { photoData = url; const p = document.getElementById('tf-preview'); p.src = url; p.classList.remove('d-none'); });
    });
    document.getElementById('tf-save').addEventListener('click', () => {
      let ok = true;
      [['tf-name', 'required'], ['tf-phone', 'phone'], ['tf-email', 'email'], ['tf-skills', 'required'], ['tf-exp', 'required'], ['tf-hours', 'required']]
        .forEach(([fid, rule]) => { if (!H.validateField(document.getElementById(fid), rule)) ok = false; });
      if (!ok) { H.toast('Please fix the highlighted fields.', 'error'); return; }
      const areas = document.getElementById('tf-areas').value.split(',').map(s => s.trim()).filter(Boolean);
      const data = {
        name: document.getElementById('tf-name').value.trim(),
        phone: document.getElementById('tf-phone').value.trim(),
        email: document.getElementById('tf-email').value.trim(),
        categoryId: document.getElementById('tf-cat').value,
        skills: document.getElementById('tf-skills').value.trim(),
        experience: document.getElementById('tf-exp').value.trim(),
        areas: areas.length ? areas : ['Downtown'],
        hours: document.getElementById('tf-hours').value.trim(),
        verification: document.getElementById('tf-ver').value,
        photo: photoData
      };
      if (editId) Object.assign(H.getTechnician(db, editId), data);
      else db.technicians.push(Object.assign({
        id: 'tech-' + Date.now(), status: data.verification === 'verified' ? 'active' : 'pending',
        rating: 0, completedJobs: 0,
        availability: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], slots: H.TIME_SLOTS, breakFrom: '13:00', breakTo: '14:00', unavailableDates: [] }
      }, data));
      save();
      bootstrap.Modal.getInstance(document.getElementById('techFormModal')).hide();
      renderTechs();
      H.toast(editId ? 'Technician updated.' : 'Technician added.');
    });
    renderTechs();
  }

  /* =========================================================
     Category Management
     ========================================================= */
  const catBody = document.getElementById('cat-table-body');
  if (catBody) {
    function renderCats() {
      catBody.innerHTML = db.categories.map(c => {
        const n = db.services.filter(s => s.catId === c.id).length;
        return '<tr><td><i class="bi ' + c.icon + ' text-brand me-2"></i>' + H.esc(c.name) + '</td>' +
          '<td>' + H.esc(c.description) + '</td><td>' + n + '</td>' +
          '<td>' + (c.active ? '<span class="badge text-bg-success">Active</span>' : '<span class="badge text-bg-secondary">Inactive</span>') + '</td>' +
          '<td class="text-end"><button class="btn btn-sm btn-outline-secondary me-1" data-edit="' + c.id + '"><i class="bi bi-pencil"></i></button>' +
          '<button class="btn btn-sm btn-outline-' + (c.active ? 'warning' : 'success') + ' me-1" data-toggle="' + c.id + '">' + (c.active ? 'Deactivate' : 'Activate') + '</button>' +
          '<button class="btn btn-sm btn-outline-danger" data-del="' + c.id + '"><i class="bi bi-trash"></i></button></td></tr>';
      }).join('') || '<tr><td colspan="5"><div class="empty-state"><i class="bi bi-tags"></i>No categories yet.</div></td></tr>';
      catBody.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => catForm(b.dataset.edit)));
      catBody.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
        const c = H.getCategory(db, b.dataset.toggle); c.active = !c.active; save(); renderCats();
        H.toast('Category ' + (c.active ? 'activated' : 'deactivated') + '. Customer listing updated.');
      }));
      catBody.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
        const c = H.getCategory(db, b.dataset.del);
        const n = db.services.filter(s => s.catId === c.id).length;
        if (!await H.confirmDialog('Delete category', 'Delete "' + c.name + '"' + (n ? ' and its ' + n + ' service(s)?' : '?') + ' This cannot be undone in the demo.', 'Delete')) return;
        db.services = db.services.filter(s => s.catId !== c.id);
        db.categories = db.categories.filter(x => x.id !== c.id);
        save(); renderCats(); H.toast('Category deleted.', 'warning');
      }));
    }
    function catForm(id) {
      const c = id ? H.getCategory(db, id) : null;
      document.getElementById('cf-title').textContent = c ? 'Edit Category' : 'Add Category';
      document.getElementById('cf-name').value = c ? c.name : '';
      document.getElementById('cf-desc').value = c ? c.description : '';
      document.getElementById('cf-icon').value = c ? c.icon : 'bi-tools';
      document.getElementById('cf-active').checked = c ? c.active : true;
      document.getElementById('cf-id').value = id || '';
      new bootstrap.Modal('#catFormModal').show();
    }
    document.getElementById('add-cat-btn').addEventListener('click', () => catForm(null));
    document.getElementById('cf-save').addEventListener('click', () => {
      if (!H.validateField(document.getElementById('cf-name'), 'required') ||
          !H.validateField(document.getElementById('cf-desc'), 'required')) { H.toast('Name and description are required.', 'error'); return; }
      const id = document.getElementById('cf-id').value;
      const data = {
        name: document.getElementById('cf-name').value.trim(),
        description: document.getElementById('cf-desc').value.trim(),
        icon: document.getElementById('cf-icon').value.trim() || 'bi-tools',
        active: document.getElementById('cf-active').checked
      };
      if (id) Object.assign(H.getCategory(db, id), data);
      else db.categories.push(Object.assign({ id: 'cat-' + Date.now() }, data));
      save(); bootstrap.Modal.getInstance(document.getElementById('catFormModal')).hide();
      renderCats(); H.toast(id ? 'Category updated.' : 'Category added.');
    });
    renderCats();
  }

  /* =========================================================
     Service Management
     ========================================================= */
  const svcBody = document.getElementById('svc-table-body');
  if (svcBody) {
    function renderSvcs() {
      const q = document.getElementById('s-search').value.trim().toLowerCase();
      const cat = document.getElementById('s-cat').value;
      const st = document.getElementById('s-status').value;
      let list = db.services.filter(s =>
        (!q || s.name.toLowerCase().includes(q)) && (!cat || s.catId === cat) &&
        (!st || String(s.active) === st));
      svcBody.innerHTML = list.map(s => {
        const c = H.getCategory(db, s.catId);
        return '<tr><td class="fw-semi">' + H.esc(s.name) + '</td>' +
          '<td>' + H.esc(c ? c.name : '—') + '</td>' +
          '<td>' + (s.pricingType === 'quote' ? '<span class="badge text-bg-info">Quote-based</span>' : H.money(s.basePrice)) + '</td>' +
          '<td>' + H.esc(s.duration) + '</td>' +
          '<td>' + (s.active ? '<span class="badge text-bg-success">Active</span>' : '<span class="badge text-bg-secondary">Inactive</span>') + '</td>' +
          '<td class="text-end"><button class="btn btn-sm btn-outline-secondary me-1" data-edit="' + s.id + '"><i class="bi bi-pencil"></i></button>' +
          '<button class="btn btn-sm btn-outline-' + (s.active ? 'warning' : 'success') + ' me-1" data-toggle="' + s.id + '">' + (s.active ? 'Deactivate' : 'Activate') + '</button>' +
          '<button class="btn btn-sm btn-outline-danger" data-del="' + s.id + '"><i class="bi bi-trash"></i></button></td></tr>';
      }).join('') || '<tr><td colspan="6"><div class="empty-state"><i class="bi bi-tools"></i>No services match the filters.</div></td></tr>';
      svcBody.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => svcForm(b.dataset.edit)));
      svcBody.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
        const s = H.getService(db, b.dataset.toggle); s.active = !s.active; save(); renderSvcs();
        H.toast(s.active ? 'Service activated and bookable.' : 'Service deactivated — it can no longer be booked.', 'warning');
      }));
      svcBody.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
        const s = H.getService(db, b.dataset.del);
        if (!await H.confirmDialog('Delete service', 'Delete "' + s.name + '"? Past bookings keep their records.', 'Delete')) return;
        db.services = db.services.filter(x => x.id !== s.id);
        save(); renderSvcs(); H.toast('Service deleted.', 'warning');
      }));
    }
    function svcForm(id) {
      const s = id ? H.getService(db, id) : null;
      document.getElementById('sf-title').textContent = s ? 'Edit Service' : 'Add Service';
      document.getElementById('sf-form').reset();
      document.getElementById('sf-id').value = id || '';
      db.categories.forEach(c => document.getElementById('sf-cat').insertAdjacentHTML('beforeend', '<option value="' + c.id + '">' + H.esc(c.name) + '</option>'));
      if (s) {
        document.getElementById('sf-cat').value = s.catId;
        document.getElementById('sf-name').value = s.name;
        document.getElementById('sf-desc').value = s.description;
        document.getElementById('sf-price').value = s.basePrice;
        document.getElementById('sf-ptype').value = s.pricingType;
        document.getElementById('sf-duration').value = s.duration;
        document.getElementById('sf-skills').value = s.skills.join(', ');
        document.getElementById('sf-active').checked = s.active;
      }
      new bootstrap.Modal('#svcFormModal').show();
    }
    document.getElementById('add-svc-btn').addEventListener('click', () => svcForm(null));
    document.getElementById('sf-ptype').addEventListener('change', () => {
      document.getElementById('sf-price-wrap').style.display = document.getElementById('sf-ptype').value === 'quote' ? 'none' : '';
    });
    document.getElementById('sf-save').addEventListener('click', () => {
      if (!H.validateField(document.getElementById('sf-name'), 'required') ||
          !H.validateField(document.getElementById('sf-desc'), 'required') ||
          !H.validateField(document.getElementById('sf-cat'), 'required') ||
          !H.validateField(document.getElementById('sf-price'), 'number')) { H.toast('Please fix the highlighted fields.', 'error'); return; }
      const id = document.getElementById('sf-id').value;
      const quote = document.getElementById('sf-ptype').value === 'quote';
      const data = {
        catId: document.getElementById('sf-cat').value,
        name: document.getElementById('sf-name').value.trim(),
        description: document.getElementById('sf-desc').value.trim(),
        basePrice: quote ? 0 : Number(document.getElementById('sf-price').value),
        pricingType: document.getElementById('sf-ptype').value,
        duration: document.getElementById('sf-duration').value.trim() || '1-2 hours',
        skills: document.getElementById('sf-skills').value.split(',').map(x => x.trim()).filter(Boolean),
        active: document.getElementById('sf-active').checked
      };
      if (id) Object.assign(H.getService(db, id), data);
      else db.services.push(Object.assign({ id: 'svc-' + Date.now() }, data));
      save(); bootstrap.Modal.getInstance(document.getElementById('svcFormModal')).hide();
      renderSvcs(); H.toast(id ? 'Service updated.' : 'Service added.');
    });
    db.categories.forEach(c => document.getElementById('s-cat').insertAdjacentHTML('beforeend', '<option value="' + c.id + '">' + H.esc(c.name) + '</option>'));
    ['s-search', 's-cat', 's-status'].forEach(id => document.getElementById(id).addEventListener(id === 's-search' ? 'input' : 'change', renderSvcs));
    renderSvcs();
  }

  /* =========================================================
     Booking Management (list)
     ========================================================= */
  const bkBody = document.getElementById('bk-table-body');
  if (bkBody) {
    let page = 1;
    const PER = 8;
    function bkList() {
      const q = document.getElementById('bk-search').value.trim().toLowerCase();
      const from = document.getElementById('bk-from').value, to = document.getElementById('bk-to').value;
      const cat = document.getElementById('bk-cat').value, tech = document.getElementById('bk-tech').value;
      const area = document.getElementById('bk-area').value, st = document.getElementById('bk-status').value;
      return db.bookings.filter(b => {
        const svc = H.getService(db, b.serviceId);
        return (!q || b.id.toLowerCase().includes(q) || b.customer.name.toLowerCase().includes(q)) &&
          (!from || b.date >= from) && (!to || b.date <= to) &&
          (!cat || (svc && svc.catId === cat)) && (!tech || b.techId === tech) &&
          (!area || b.city === area) && (!st || b.status === st);
      }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    function renderBk() {
      const list = bkList();
      const pg = H.paginate(list, page, PER);
      bkBody.innerHTML = pg.slice.map(b => {
        const svc = H.getService(db, b.serviceId);
        const t = H.getTechnician(db, b.techId);
        return '<tr><td><a class="fw-semi" href="booking-details.html?id=' + b.id + '">' + H.esc(b.id) + '</a></td>' +
          '<td>' + H.esc(b.customer.name) + '</td><td>' + H.esc(svc ? svc.name : '—') + '</td>' +
          '<td>' + H.esc(t ? t.name : '—') + '</td>' +
          '<td>' + H.fmtDate(b.date) + '<br><span class="small text-muted">' + H.esc(b.timeSlot) + '</span></td>' +
          '<td>' + H.esc(b.city) + '</td><td>' + H.statusBadge(b.status) + '</td>' +
          '<td class="text-end"><a class="btn btn-sm btn-outline-primary" href="booking-details.html?id=' + b.id + '">View</a></td></tr>';
      }).join('') || '<tr><td colspan="8"><div class="empty-state"><i class="bi bi-inbox"></i>No bookings match the filters.</div></td></tr>';
      H.pagerControls(document.getElementById('bk-pager'), pg, p => { page = p; renderBk(); });
    }
    db.categories.forEach(c => document.getElementById('bk-cat').insertAdjacentHTML('beforeend', '<option value="' + c.id + '">' + H.esc(c.name) + '</option>'));
    db.technicians.forEach(t => document.getElementById('bk-tech').insertAdjacentHTML('beforeend', '<option value="' + t.id + '">' + H.esc(t.name) + '</option>'));
    [...new Set(db.bookings.map(b => b.city))].forEach(a => document.getElementById('bk-area').insertAdjacentHTML('beforeend', '<option>' + H.esc(a) + '</option>'));
    Object.values(H.STATUS).forEach(s => document.getElementById('bk-status').insertAdjacentHTML('beforeend', '<option>' + s + '</option>'));
    ['bk-search', 'bk-from', 'bk-to', 'bk-cat', 'bk-tech', 'bk-area', 'bk-status'].forEach(id =>
      document.getElementById(id).addEventListener(id === 'bk-search' ? 'input' : 'change', () => { page = 1; renderBk(); }));
    document.getElementById('bk-clear').addEventListener('click', () => {
      ['bk-search', 'bk-from', 'bk-to', 'bk-cat', 'bk-tech', 'bk-area', 'bk-status'].forEach(id => document.getElementById(id).value = '');
      page = 1; renderBk();
    });
    renderBk();
  }

  /* =========================================================
     Booking Details (single booking operations)
     ========================================================= */
  const bkDetail = document.getElementById('bd-wrap');
  if (bkDetail) {
    const b = db.bookings.find(x => x.id === H.qsParam('id'));
    if (!b) { bkDetail.innerHTML = '<div class="empty-state"><i class="bi bi-question-circle"></i>Booking not found. <a href="bookings.html">Back to all bookings</a></div>'; }
    else {
      const svc = H.getService(db, b.serviceId);
      const cat = svc ? H.getCategory(db, svc.catId) : null;
      const t = H.getTechnician(db, b.techId);
      document.getElementById('bd-title').textContent = 'Booking ' + b.id;
      document.getElementById('bd-status').innerHTML = H.statusBadge(b.status);

      function renderDetail() {
        const tNow = H.getTechnician(db, b.techId);
        bkDetail.innerHTML =
          '<div class="row g-4">' +
          '<div class="col-lg-7"><div class="card p-4 mb-3"><h6 class="fw-semi mb-3">Customer &amp; service</h6>' +
          '<dl class="row mb-0">' +
          '<dt class="col-sm-4">Customer</dt><dd class="col-sm-8">' + H.esc(b.customer.name) + '</dd>' +
          '<dt class="col-sm-4">Phone</dt><dd class="col-sm-8">' + H.esc(b.customer.phone) + '</dd>' +
          '<dt class="col-sm-4">Email</dt><dd class="col-sm-8">' + (b.customer.email ? H.esc(b.customer.email) : '—') + '</dd>' +
          '<dt class="col-sm-4">Service</dt><dd class="col-sm-8">' + H.esc(svc ? svc.name : '—') + ' <span class="text-muted small">(' + H.esc(cat ? cat.name : '') + ')</span></dd>' +
          '<dt class="col-sm-4">Pricing type</dt><dd class="col-sm-8">' + (svc && svc.pricingType === 'quote' ? 'Inspection / quote-based' : 'Fixed price') + '</dd>' +
          '<dt class="col-sm-4">Address</dt><dd class="col-sm-8">' + H.esc(b.address) + ', ' + H.esc(b.city) + '</dd>' +
          '<dt class="col-sm-4">Appointment</dt><dd class="col-sm-8">' + H.fmtDate(b.date) + ', ' + H.esc(b.timeSlot) + '</dd>' +
          '<dt class="col-sm-4">Problem</dt><dd class="col-sm-8">' + H.esc(b.notes) + '</dd>' +
          (b.image ? '<dt class="col-sm-4">Photo</dt><dd class="col-sm-8"><img src="' + b.image + '" class="upload-preview" alt="Customer photo"></dd>' : '') +
          '</dl></div>' +
          '<div class="card p-4"><h6 class="fw-semi mb-3">Status history <span class="badge text-bg-light border">timestamped</span></h6>' +
          '<ul class="hsp-timeline">' +
          '<li class="' + (b.history.length ? 'muted' : '') + '"><div class="small text-muted">' + H.fmtDateTime(b.createdAt) + ' · ' + ACTOR + '</div><div>Booking created — ' + H.STATUS.NEW + '</div></li>' +
          (b.history || []).map(h => '<li class="' + (h === b.history[b.history.length - 1] ? '' : 'muted') + '"><div class="small text-muted">' + H.fmtDateTime(h.at) + ' · ' + H.esc(h.actor) + '</div><div>' + H.esc(h.from) + ' → <strong>' + H.esc(h.to) + '</strong>' + (h.note ? '<br><span class="text-muted small">' + H.esc(h.note) + '</span>' : '') + '</div></li>').join('') +
          '</ul></div></div>' +
          '<div class="col-lg-5">' +
          '<div class="card p-4 mb-3"><h6 class="fw-semi mb-3">Assignment</h6>' +
          '<p class="mb-2">Technician: <strong>' + H.esc(tNow ? tNow.name : 'Unassigned') + '</strong></p>' +
          '<div class="d-grid gap-2">' +
          '<button class="btn btn-navy" id="bd-assign"><i class="bi bi-person-plus"></i> ' + (tNow ? 'Reassign technician' : 'Assign technician') + '</button>' +
          '<button class="btn btn-outline-primary" id="bd-status"><i class="bi bi-arrow-repeat"></i> Update status</button>' +
          '<button class="btn btn-outline-secondary" id="bd-resched"><i class="bi bi-calendar-event"></i> Reschedule</button>' +
          (b.status !== H.STATUS.CANCELLED && b.status !== H.STATUS.COMPLETED ? '<button class="btn btn-outline-danger" id="bd-cancel"><i class="bi bi-x-circle"></i> Cancel booking</button>' : '') +
          '</div>' + (b.cancelReason ? '<div class="alert alert-danger mt-3 mb-0 small"><strong>Cancellation reason:</strong> ' + H.esc(b.cancelReason) + '</div>' : '') +
          '</div>' +
          '<div class="card p-4"><h6 class="fw-semi mb-3">Pricing &amp; payment</h6>' +
          '<table class="table table-sm mb-0">' +
          '<tr><th>Estimated price</th><td class="text-end">' + (b.estPrice ? H.money(b.estPrice) : 'Quote after inspection') + '</td></tr>' +
          '<tr><th>Final price</th><td class="text-end">' + (b.finalPrice ? H.money(b.finalPrice) : '—') + '</td></tr>' +
          '<tr><th>Payment status</th><td class="text-end">' + H.esc(b.paymentStatus) + '</td></tr>' +
          '</table></div></div></div>';
        bindActions();
      }

      function bindActions() {
        // Assign / reassign
        document.getElementById('bd-assign').addEventListener('click', () => {
          const sel = document.getElementById('assign-tech');
          sel.innerHTML = '<option value="">Choose a technician…</option>' + db.technicians.filter(t => t.status === 'active').map(t => {
            const conflict = H.techHasSlotConflict(db, t.id, b.date, b.timeSlot, b.id);
            return '<option value="' + t.id + '"' + (conflict ? ' disabled' : '') + '>' + H.esc(t.name) + (conflict ? ' — slot conflict' : '') + '</option>';
          }).join('');
          new bootstrap.Modal('#assignModal').show();
        });
        document.getElementById('assign-save').addEventListener('click', () => {
          const tid = document.getElementById('assign-tech').value;
          if (!tid) { H.toast('Choose a technician.', 'error'); return; }
          if (H.techHasSlotConflict(db, tid, b.date, b.timeSlot, b.id)) { H.toast('Slot conflict: this technician already has a confirmed booking in that slot.', 'error'); return; }
          const from = b.status;
          b.techId = tid;
          if (b.status === H.STATUS.NEW) { b.status = H.STATUS.ASSIGNED; H.logStatusChange(db, b.id, from, H.STATUS.ASSIGNED, ACTOR, 'Assigned ' + H.getTechnician(db, tid).name); }
          else H.logStatusChange(db, b.id, from, b.status, ACTOR, 'Reassigned to ' + H.getTechnician(db, tid).name);
          save(); bootstrap.Modal.getInstance(document.getElementById('assignModal')).hide();
          document.getElementById('bd-status').innerHTML = H.statusBadge(b.status);
          renderDetail(); H.toast('Technician assigned.');
        });
        // Status update (allowed transitions only)
        document.getElementById('bd-status').addEventListener('click', () => {
          const nexts = H.TRANSITIONS[b.status] || [];
          const sel = document.getElementById('status-next');
          sel.innerHTML = nexts.length ? nexts.map(s => '<option>' + s + '</option>').join('') : '<option value="">No transition allowed from "' + b.status + '"</option>';
          document.getElementById('status-save').disabled = !nexts.length;
          new bootstrap.Modal('#statusModal').show();
        });
        document.getElementById('status-save').addEventListener('click', () => {
          const to = document.getElementById('status-next').value;
          const note = document.getElementById('status-note').value.trim();
          if (!to) return;
          if (to === H.STATUS.CANCELLED && !note) { H.toast('A cancellation reason is required.', 'error'); return; }
          if (!H.TRANSITIONS[b.status].includes(to)) { H.toast('Invalid status transition.', 'error'); return; }
          if (to === H.STATUS.ASSIGNED && !b.techId) { H.toast('Assign a technician first.', 'error'); return; }
          const from = b.status;
          b.status = to;
          if (to === H.STATUS.CANCELLED) b.cancelReason = note;
          if (to === H.STATUS.COMPLETED && !b.finalPrice) b.finalPrice = b.estPrice;
          H.logStatusChange(db, b.id, from, to, ACTOR, note);
          save(); bootstrap.Modal.getInstance(document.getElementById('statusModal')).hide();
          document.getElementById('bd-status').innerHTML = H.statusBadge(b.status);
          renderDetail(); H.toast('Status updated to "' + to + '".');
        });
        // Reschedule
        document.getElementById('bd-resched').addEventListener('click', () => {
          document.getElementById('resched-date').value = b.date;
          document.getElementById('resched-date').min = new Date().toISOString().slice(0, 10);
          const sel = document.getElementById('resched-slot');
          sel.innerHTML = H.TIME_SLOTS.map(s => '<option' + (s === b.timeSlot ? ' selected' : '') + '>' + s + '</option>').join('');
          new bootstrap.Modal('#reschedModal').show();
        });
        document.getElementById('resched-save').addEventListener('click', () => {
          const d = document.getElementById('resched-date').value, s = document.getElementById('resched-slot').value;
          const dt = new Date(d + 'T00:00:00');
          if (!d || isNaN(dt) || dt < new Date(new Date().setHours(0, 0, 0, 0))) { H.toast('Choose a valid future date.', 'error'); return; }
          if (b.techId && H.techHasSlotConflict(db, b.techId, d, s, b.id)) { H.toast('Slot conflict for the assigned technician. Pick another slot.', 'error'); return; }
          const from = b.status;
          b.date = d; b.timeSlot = s;
          H.logStatusChange(db, b.id, from, from, ACTOR, 'Rescheduled to ' + d + ' ' + s);
          save(); bootstrap.Modal.getInstance(document.getElementById('reschedModal')).hide();
          renderDetail(); H.toast('Booking rescheduled.');
        });
        // Cancel
        const cancelBtn = document.getElementById('bd-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', () => new bootstrap.Modal('#cancelModal').show());
        document.getElementById('cancel-save').addEventListener('click', () => {
          const reason = document.getElementById('cancel-reason').value.trim();
          if (!reason) { H.toast('A cancellation reason is required.', 'error'); return; }
          const from = b.status;
          b.status = H.STATUS.CANCELLED; b.cancelReason = reason;
          H.logStatusChange(db, b.id, from, H.STATUS.CANCELLED, ACTOR, reason);
          save(); bootstrap.Modal.getInstance(document.getElementById('cancelModal')).hide();
          renderDetail(); H.toast('Booking cancelled. History retained.', 'warning');
        });
      }
      renderDetail();
    }
  }

  /* =========================================================
     Pricing & Payments
     ========================================================= */
  const priceBody = document.getElementById('pr-table-body');
  if (priceBody) {
    function renderPricing() {
      const st = document.getElementById('pr-status').value;
      const q = document.getElementById('pr-search').value.trim().toLowerCase();
      const list = db.bookings.filter(b =>
        (!st || b.paymentStatus === st) &&
        (!q || b.id.toLowerCase().includes(q) || b.customer.name.toLowerCase().includes(q)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const done = list.filter(b => b.status === H.STATUS.COMPLETED);
      const gross = done.reduce((a, b) => a + (b.finalPrice || 0), 0);
      const cards = document.getElementById('pr-cards');
      cards.innerHTML = [
        ['Recorded final revenue (sample)', H.money(gross), ''],
        ['Platform commission (' + (H.COMMISSION_RATE * 100) + '%, sample)', H.money(gross * H.COMMISSION_RATE), 'accent'],
        ['Technician payable (sample)', H.money(gross * (1 - H.COMMISSION_RATE)), 'success'],
        ['Pending payments', String(list.filter(b => b.paymentStatus !== 'Paid').length), 'warning']
      ].map(([l, v, cls]) => '<div class="col-6 col-lg-3"><div class="card stat-card ' + cls + '"><div class="card-body py-3"><div class="small text-muted">' + l + '</div><div class="stat-value">' + v + '</div></div></div></div>').join('');

      priceBody.innerHTML = list.map(b => {
        const svc = H.getService(db, b.serviceId);
        const gross2 = b.finalPrice || b.estPrice || 0;
        return '<tr><td><a href="booking-details.html?id=' + b.id + '">' + H.esc(b.id) + '</a></td>' +
          '<td>' + H.esc(b.customer.name) + '</td><td>' + H.esc(svc ? svc.name : '—') + '</td>' +
          '<td>' + (b.estPrice ? H.money(b.estPrice) : '<span class="text-muted">quote</span>') + '</td>' +
          '<td>' + (b.finalPrice ? H.money(b.finalPrice) : '—') + '</td>' +
          '<td>Cash on completion (sample)</td>' +
          '<td>' + (b.paymentStatus === 'Paid' ? '<span class="badge text-bg-success">Paid</span>' : '<span class="badge text-bg-warning">Pending</span>') + '</td>' +
          '<td>' + H.money(gross2 * H.COMMISSION_RATE) + ' / ' + H.money(gross2 * (1 - H.COMMISSION_RATE)) + '</td></tr>';
      }).join('') || '<tr><td colspan="8"><div class="empty-state"><i class="bi bi-cash-coin"></i>No payment records match the filters.</div></td></tr>';
      document.getElementById('pr-note').textContent = 'All amounts are sample/demo data. Online payment gateway integration is a separate implementation decision.';
    }
    document.getElementById('pr-status').addEventListener('change', renderPricing);
    document.getElementById('pr-search').addEventListener('input', renderPricing);
    renderPricing();
  }

  /* =========================================================
     Reviews & Reports
     ========================================================= */
  const reportsPage = document.getElementById('reports-tabs');
  if (reportsPage) {
    // Reviews moderation
    function renderReviews() {
      const wrap = document.getElementById('rev-list');
      wrap.innerHTML = db.reviews.map(r => {
        const mod = r.moderated === 'visible' ? ['Hide', 'outline-warning', 'bi-eye-slash'] : r.moderated === 'flagged' ? ['Restore', 'outline-success', 'bi-arrow-counterclockwise'] : ['Restore', 'outline-success', 'bi-arrow-counterclockwise'];
        return '<div class="card mb-2 ' + (r.moderated !== 'visible' ? 'opacity-75' : '') + '"><div class="card-body py-3">' +
          '<div class="d-flex justify-content-between">' +
          '<div><span class="stars">' + '★'.repeat(r.rating) + '</span><span class="text-muted">' + '★'.repeat(5 - r.rating) + '</span> ' +
          '<strong class="ms-2">' + H.esc(r.author) + '</strong> <span class="text-muted small">on ' + H.esc(r.bookingId) + '</span>' +
          (r.moderated !== 'visible' ? ' <span class="badge text-bg-secondary">' + r.moderated + '</span>' : '') +
          '<p class="mb-1 mt-1">' + H.esc(r.comment) + '</p></div>' +
          '<div class="text-nowrap"><button class="btn btn-sm btn-' + mod[1] + ' me-1" data-mod="' + r.id + '"><i class="bi ' + mod[2] + '"></i> ' + mod[0] + '</button>' +
          '<button class="btn btn-sm btn-outline-danger" data-flag="' + r.id + '"><i class="bi bi-flag"></i> Flag</button></div></div></div></div>';
      }).join('') || '<div class="empty-state"><i class="bi bi-star"></i>No reviews yet.</div>';
      wrap.querySelectorAll('[data-mod]').forEach(btn => btn.addEventListener('click', () => {
        const r = db.reviews.find(x => x.id === btn.dataset.mod);
        r.moderated = r.moderated === 'visible' ? 'hidden' : 'visible';
        save(); renderReviews(); H.toast('Review ' + r.moderated + '.');
      }));
      wrap.querySelectorAll('[data-flag]').forEach(btn => btn.addEventListener('click', () => {
        const r = db.reviews.find(x => x.id === btn.dataset.flag);
        r.moderated = 'flagged'; save(); renderReviews(); H.toast('Review flagged for moderation.', 'warning');
      }));
    }
    renderReviews();

    // Reports
    const repFrom = document.getElementById('rep-from'), repTo = document.getElementById('rep-to');
    function inRange(b) { return (!repFrom.value || b.date >= repFrom.value) && (!repTo.value || b.date <= repTo.value); }
    function renderReports() {
      const list = db.bookings.filter(inRange);
      const done = list.filter(b => b.status === H.STATUS.COMPLETED);

      // Booking report
      document.getElementById('rep-bookings').innerHTML = '<thead><tr><th>Booking ID</th><th>Customer</th><th>Service</th><th>Date</th><th>Status</th><th>Amount</th></tr></thead><tbody>' +
        list.map(b => { const s = H.getService(db, b.serviceId); return '<tr><td>' + H.esc(b.id) + '</td><td>' + H.esc(b.customer.name) + '</td><td>' + H.esc(s ? s.name : '—') + '</td><td>' + H.fmtDate(b.date) + '</td><td>' + H.statusBadge(b.status) + '</td><td>' + (b.finalPrice || b.estPrice ? H.money(b.finalPrice || b.estPrice) : '—') + '</td></tr>'; }).join('') +
        '</tbody>';

      // Category report
      const catMap = {};
      list.forEach(b => { const s = H.getService(db, b.serviceId); if (!s) return; catMap[s.catId] = catMap[s.catId] || { n: 0, rev: 0 }; catMap[s.catId].n++; if (b.status === H.STATUS.COMPLETED) catMap[s.catId].rev += b.finalPrice || 0; });
      document.getElementById('rep-cats').innerHTML = '<thead><tr><th>Category</th><th>Bookings</th><th>Revenue (sample)</th></tr></thead><tbody>' +
        (Object.keys(catMap).map(cid => '<tr><td>' + H.esc(H.getCategory(db, cid)?.name || cid) + '</td><td>' + catMap[cid].n + '</td><td>' + H.money(catMap[cid].rev) + '</td></tr>').join('') || '<tr><td colspan="3" class="text-muted">No data in range</td></tr>') + '</tbody>';

      // Technician performance
      document.getElementById('rep-techs').innerHTML = '<thead><tr><th>Technician</th><th>Assigned</th><th>Completed</th><th>Completion rate</th><th>Revenue (sample)</th><th>Rating</th></tr></thead><tbody>' +
        db.technicians.map(t => {
          const mine = list.filter(b => b.techId === t.id);
          const c = mine.filter(b => b.status === H.STATUS.COMPLETED).length;
          const rev = mine.reduce((a, b) => a + (b.status === H.STATUS.COMPLETED ? b.finalPrice || 0 : 0), 0);
          return '<tr><td>' + H.esc(t.name) + '</td><td>' + mine.length + '</td><td>' + c + '</td><td>' + (mine.length ? Math.round(c / mine.length * 100) : 0) + '%</td><td>' + H.money(rev) + '</td><td>' + t.rating.toFixed(1) + '</td></tr>';
        }).join('') + '</tbody>';

      // Revenue summary
      const rev = done.reduce((a, b) => a + (b.finalPrice || 0), 0);
      document.getElementById('rep-revenue').innerHTML = '<thead><tr><th>Metric</th><th>Value (sample)</th></tr></thead><tbody>' +
        '<tr><td>Completed jobs</td><td>' + done.length + '</td></tr>' +
        '<tr><td>Gross revenue</td><td>' + H.money(rev) + '</td></tr>' +
        '<tr><td>Platform commission (' + (H.COMMISSION_RATE * 100) + '%)</td><td>' + H.money(rev * H.COMMISSION_RATE) + '</td></tr>' +
        '<tr><td>Technician payable</td><td>' + H.money(rev * (1 - H.COMMISSION_RATE)) + '</td></tr></tbody>';

      // CSV exports
      document.getElementById('exp-bookings').onclick = () => H.exportCsv('booking-report.csv', [['Booking ID', 'Customer', 'Service', 'Date', 'Status', 'Amount'], ...list.map(b => { const s = H.getService(db, b.serviceId); return [b.id, b.customer.name, s ? s.name : '', b.date, b.status, b.finalPrice || b.estPrice || 0]; })]);
      document.getElementById('exp-cats').onclick = () => H.exportCsv('category-report.csv', [['Category', 'Bookings', 'Revenue'], ...Object.keys(catMap).map(cid => [H.getCategory(db, cid)?.name || cid, catMap[cid].n, catMap[cid].rev])]);
      document.getElementById('exp-techs').onclick = () => H.exportCsv('technician-performance.csv', [['Technician', 'Assigned', 'Completed', 'Revenue'], ...db.technicians.map(t => { const mine = list.filter(b => b.techId === t.id); return [t.name, mine.length, mine.filter(b => b.status === H.STATUS.COMPLETED).length, mine.reduce((a, b) => a + (b.finalPrice || 0), 0)]; })]);
      document.getElementById('exp-revenue').onclick = () => H.exportCsv('revenue-report.csv', [['Metric', 'Value'], ['Completed jobs', done.length], ['Gross revenue', rev], ['Commission', rev * H.COMMISSION_RATE], ['Technician payable', rev * (1 - H.COMMISSION_RATE)]]);
    }
    repFrom.addEventListener('change', renderReports);
    repTo.addEventListener('change', renderReports);
    renderReports();
  }

  /* =========================================================
     Website Settings
     ========================================================= */
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    const map = { 'st-name': 'siteName', 'st-logo': 'logoText', 'st-phone': 'phone', 'st-email': 'email', 'st-address': 'address', 'st-locations': 'locations', 'st-hours': 'businessHours', 'st-booking': 'bookingRules', 'st-cancel': 'cancellationRules', 'st-notif': 'notifTemplate', 'st-admin': 'adminName', 'st-adminemail': 'adminEmail' };
    Object.keys(map).forEach(fid => document.getElementById(fid).value = db.settings[map[fid]] || '');
    document.getElementById('settings-save').addEventListener('click', () => {
      let ok = true;
      Object.keys(map).forEach(fid => { if (!H.validateField(document.getElementById(fid), fid === 'st-email' ? 'email' : 'required')) ok = false; });
      if (!ok) { H.toast('Please fix the highlighted fields.', 'error'); return; }
      Object.keys(map).forEach(fid => db.settings[map[fid]] = document.getElementById(fid).value.trim());
      save(); H.toast('Settings saved to browser storage (demo).');
    });
  }
})();
