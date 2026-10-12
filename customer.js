/* =========================================================
   customer.js — logic for public website pages
   ========================================================= */
(function () {
  'use strict';
  const H = window.HSP;
  const db = H.loadDb();

  /* ---------- Shared renderers ---------- */
  function serviceCard(svc) {
    const cat = H.getCategory(db, svc.catId);
    const price = svc.pricingType === 'quote'
      ? '<span class="badge text-bg-info">Quote after inspection</span>'
      : '<span class="price-tag">' + H.money(svc.basePrice) + '</span>';
    const bookable = svc.active && cat && cat.active;
    return '<div class="col-6 col-md-4 col-lg-3">' +
      '<div class="card h-100 hsp-card-hover">' +
      '<div class="card-body d-flex flex-column">' +
      '<div class="cat-icon mb-3"><i class="bi ' + (cat ? cat.icon : 'bi-tools') + '"></i></div>' +
      '<h5 class="card-title mb-1">' + H.esc(svc.name) + '</h5>' +
      '<p class="text-muted small flex-grow-1">' + H.esc(svc.description.length > 90 ? svc.description.slice(0, 90) + '…' : svc.description) + '</p>' +
      '<div class="d-flex justify-content-between align-items-center mb-3">' + price +
      '<span class="small text-muted"><i class="bi bi-clock"></i> ' + H.esc(svc.duration) + '</span></div>' +
      '<div class="d-grid gap-2">' +
      '<a class="btn btn-sm btn-outline-secondary" href="service-details.html?id=' + svc.id + '">View Details</a>' +
      (bookable
        ? '<a class="btn btn-sm btn-brand" href="book-service.html?service=' + svc.id + '">Book Now</a>'
        : '<button class="btn btn-sm btn-secondary" disabled title="Service currently unavailable">Unavailable</button>') +
      '</div></div></div></div>';
  }

  function categoryCard(cat) {
    const count = db.services.filter(s => s.catId === cat.id && s.active).length;
    return '<div class="col-6 col-md-3">' +
      '<a class="text-decoration-none" href="services.html?cat=' + cat.id + '">' +
      '<div class="card h-100 hsp-card-hover text-center"><div class="card-body">' +
      '<div class="cat-icon mb-2"><i class="bi ' + cat.icon + '"></i></div>' +
      '<h6 class="fw-semi mb-1 text-dark">' + H.esc(cat.name) + '</h6>' +
      '<span class="small text-muted">' + count + ' service' + (count === 1 ? '' : 's') + '</span>' +
      '</div></div></a></div>';
  }

  /* ---------- Home page ---------- */
  const homeCats = document.getElementById('home-categories');
  if (homeCats) {
    const activeCats = db.categories.filter(c => c.active);
    homeCats.innerHTML = activeCats.map(categoryCard).join('') ||
      '<div class="col-12 empty-state"><i class="bi bi-inbox"></i>No categories available yet.</div>';

    const popular = db.services.filter(s => s.active && H.getCategory(db, s.catId)?.active).slice(0, 8);
    document.getElementById('popular-services').innerHTML = popular.map(serviceCard).join('') ||
      '<div class="col-12 empty-state"><i class="bi bi-inbox"></i>No services available yet.</div>';

    const reviews = db.reviews.filter(r => r.moderated === 'visible');
    document.getElementById('review-section').innerHTML = reviews.slice(0, 3).map(r =>
      '<div class="col-md-4"><div class="card h-100"><div class="card-body">' +
      '<div class="stars mb-2">' + '★'.repeat(r.rating) + '<span class="text-muted">' + '★'.repeat(5 - r.rating) + '</span></div>' +
      '<p class="mb-2">“' + H.esc(r.comment) + '”</p>' +
      '<div class="small text-muted"><i class="bi bi-person-circle"></i> ' + H.esc(r.author) + ' · sample review</div>' +
      '</div></div></div>').join('');

    // Hero search → services page
    document.getElementById('hero-search-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const q = document.getElementById('hero-search').value.trim();
      window.location.href = 'services.html' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
  }

  /* ---------- Services page ---------- */
  const servicesGrid = document.getElementById('services-grid');
  if (servicesGrid) {
    const catSel = document.getElementById('filter-category');
    db.categories.filter(c => c.active).forEach(c => catSel.insertAdjacentHTML('beforeend', '<option value="' + c.id + '">' + H.esc(c.name) + '</option>'));
    catSel.value = H.qsParam('cat') || '';
    document.getElementById('service-search').value = H.qsParam('q') || '';

    function renderServices() {
      const q = document.getElementById('service-search').value.trim().toLowerCase();
      const cat = catSel.value;
      const list = db.services.filter(s =>
        s.active &&
        H.getCategory(db, s.catId)?.active &&
        (!cat || s.catId === cat) &&
        (!q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)));
      document.getElementById('services-count').textContent = list.length + ' service(s) found';
      servicesGrid.innerHTML = list.length ? list.map(serviceCard).join('') :
        '<div class="col-12 empty-state"><i class="bi bi-search"></i>No services match your search. Try a different keyword or category.</div>';
    }
    document.getElementById('service-search').addEventListener('input', renderServices);
    catSel.addEventListener('change', renderServices);
    document.getElementById('clear-filters').addEventListener('click', () => {
      document.getElementById('service-search').value = ''; catSel.value = ''; renderServices();
    });
    renderServices();
  }

  /* ---------- Service details page ---------- */
  const detailWrap = document.getElementById('service-detail');
  if (detailWrap) {
    const svc = H.getService(db, H.qsParam('id'));
    if (!svc) {
      detailWrap.innerHTML = '<div class="empty-state"><i class="bi bi-exclamation-triangle"></i>Service not found. <a href="services.html">Browse all services</a></div>';
      document.getElementById('detail-actions').classList.add('d-none');
    } else {
      const cat = H.getCategory(db, svc.catId);
      document.title = svc.name + ' — ' + db.settings.siteName;
      document.getElementById('detail-crumb').textContent = svc.name;
      const bookable = svc.active && cat && cat.active;
      detailWrap.innerHTML =
        '<div class="row g-4">' +
        '<div class="col-lg-7"><div class="card"><div class="card-body">' +
        '<div class="cat-icon mb-3"><i class="bi ' + cat.icon + '"></i></div>' +
        '<h1 class="h3">' + H.esc(svc.name) + '</h1>' +
        '<p class="text-muted">Category: <a href="services.html?cat=' + cat.id + '">' + H.esc(cat.name) + '</a></p>' +
        '<p>' + H.esc(svc.description) + '</p>' +
        '<h6 class="fw-semi">Required skills</h6><p>' + svc.skills.map(s => '<span class="badge text-bg-light border me-1">' + H.esc(s) + '</span>').join('') + '</p>' +
        '</div></div></div>' +
        '<div class="col-lg-5"><div class="card"><div class="card-body">' +
        '<h5 class="card-title">Service summary</h5>' +
        '<table class="table table-sm">' +
        '<tr><th>Estimated duration</th><td>' + H.esc(svc.duration) + '</td></tr>' +
        '<tr><th>Pricing type</th><td>' + (svc.pricingType === 'quote' ? 'Inspection / quote-based' : 'Fixed price') + '</td></tr>' +
        '<tr><th>Price</th><td class="price-tag fs-5">' + (svc.pricingType === 'quote' ? 'Quoted after inspection' : H.money(svc.basePrice)) + '</td></tr>' +
        '<tr><th>Availability</th><td>' + (bookable ? '<span class="badge text-bg-success">Bookable</span>' : '<span class="badge text-bg-secondary">Currently unavailable</span>') + '</td></tr>' +
        '</table>' +
        (bookable
          ? '<a href="book-service.html?service=' + svc.id + '" class="btn btn-brand w-100">Book This Service</a>'
          : '<button class="btn btn-secondary w-100" disabled>This service cannot be booked right now</button>') +
        '</div></div></div></div>';
    }
  }

  /* ---------- Book a service page ---------- */
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    const catSel = document.getElementById('b-category');
    const svcSel = document.getElementById('b-service');
    const slotSel = document.getElementById('b-slot');
    const estBox = document.getElementById('b-estimate');
    const dateInput = document.getElementById('b-date');
    const preselect = H.qsParam('service');

    // Populate categories + services (bookable only)
    db.categories.filter(c => c.active).forEach(c => catSel.insertAdjacentHTML('beforeend', '<option value="' + c.id + '">' + H.esc(c.name) + '</option>'));
    H.TIME_SLOTS.forEach(s => slotSel.insertAdjacentHTML('beforeend', '<option value="' + s + '">' + s + '</option>'));
    dateInput.min = new Date().toISOString().slice(0, 10);

    function fillServices(keepId) {
      svcSel.innerHTML = '<option value="">Choose a service…</option>';
      db.services.filter(s => s.active && s.catId === catSel.value).forEach(s =>
        svcSel.insertAdjacentHTML('beforeend', '<option value="' + s.id + '">' + H.esc(s.name) + (s.pricingType === 'quote' ? ' (quote-based)' : ' — ' + H.money(s.basePrice)) + '</option>'));
      if (keepId && db.services.find(s => s.id === keepId && s.active && s.catId === catSel.value)) svcSel.value = keepId;
      updateEstimate();
    }
    function updateEstimate() {
      const svc = H.getService(db, svcSel.value);
      if (!svc) { estBox.innerHTML = '<span class="text-muted">Select a service to see the estimated price.</span>'; return; }
      estBox.innerHTML = svc.pricingType === 'quote'
        ? '<span class="badge text-bg-info">Inspection / quote-based</span> <span class="small text-muted">A technician will inspect and provide a quote; a visit fee may apply.</span>'
        : '<span class="price-tag fs-5">' + H.money(svc.basePrice) + '</span> <span class="small text-muted">estimated ' + H.esc(svc.duration) + '</span>';
    }
    catSel.addEventListener('change', () => fillServices());
    svcSel.addEventListener('change', updateEstimate);

    // Preselect from ?service=
    const pre = H.getService(db, preselect);
    if (pre && pre.active) { catSel.value = pre.catId; fillServices(pre.id); }

    // Optional image upload
    let imageData = '';
    const imgInput = document.getElementById('b-image');
    imgInput.addEventListener('change', () => {
      const file = imgInput.files[0];
      const err = H.validateImageFile(file);
      const fb = document.getElementById('b-image-error');
      if (err) { fb.textContent = err; fb.classList.remove('d-none'); imgInput.value = ''; imageData = ''; document.getElementById('b-image-preview').classList.add('d-none'); return; }
      fb.classList.add('d-none');
      H.readImagePreview(file, url => {
        imageData = url;
        const prev = document.getElementById('b-image-preview');
        prev.src = url; prev.classList.remove('d-none');
      });
    });

    bookingForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const checks = [
        ['b-name', 'required'], ['b-phone', 'phone'], ['b-email', 'email'],
        ['b-category', 'required'], ['b-service', 'required'], ['b-address', 'required'],
        ['b-city', 'required'], ['b-date', 'pastDate'], ['b-slot', 'slot'], ['b-notes', 'required']
      ];
      let ok = true;
      checks.forEach(([id, rule]) => { if (!H.validateField(document.getElementById(id), rule)) ok = false; });
      if (!ok) { H.toast('Please fix the highlighted fields.', 'error'); return; }

      const svc = H.getService(db, svcSel.value);
      if (!svc || !svc.active) { H.toast('This service is no longer bookable.', 'error'); return; }

      const id = H.genBookingId(db);
      const booking = {
        id: id, createdAt: new Date().toISOString(),
        customer: { name: document.getElementById('b-name').value.trim(), phone: document.getElementById('b-phone').value.trim(), email: document.getElementById('b-email').value.trim() },
        serviceId: svc.id, address: document.getElementById('b-address').value.trim(), city: document.getElementById('b-city').value.trim(),
        date: dateInput.value, timeSlot: slotSel.value, notes: document.getElementById('b-notes').value.trim(),
        estPrice: svc.pricingType === 'quote' ? 0 : svc.basePrice, finalPrice: 0, paymentStatus: 'Pending',
        status: H.STATUS.NEW, techId: '', cancelReason: '', image: imageData, history: []
      };
      db.bookings.push(booking);
      H.saveDb(db);
      sessionStorage.setItem('hsp_last_booking', id);
      window.location.href = 'booking-confirmation.html?id=' + id;
    });
  }

  /* ---------- Booking confirmation page ---------- */
  const confirmWrap = document.getElementById('confirm-details');
  if (confirmWrap) {
    const id = H.qsParam('id') || sessionStorage.getItem('hsp_last_booking');
    const b = db.bookings.find(x => x.id === id);
    if (!b) {
      confirmWrap.innerHTML = '<div class="empty-state"><i class="bi bi-question-circle"></i>Booking not found. It may have been created in another browser session.</div>';
    } else {
      const svc = H.getService(db, b.serviceId);
      document.getElementById('confirm-id').textContent = b.id;
      confirmWrap.innerHTML =
        '<dl class="row mb-0">' +
        '<dt class="col-sm-4">Booking ID</dt><dd class="col-sm-8 fw-semi">' + H.esc(b.id) + '</dd>' +
        '<dt class="col-sm-4">Customer</dt><dd class="col-sm-8">' + H.esc(b.customer.name) + ' · ' + H.esc(b.customer.phone) + (b.customer.email ? '<br>' + H.esc(b.customer.email) : '') + '</dd>' +
        '<dt class="col-sm-4">Service</dt><dd class="col-sm-8">' + H.esc(svc ? svc.name : '—') + '</dd>' +
        '<dt class="col-sm-4">Address</dt><dd class="col-sm-8">' + H.esc(b.address) + ', ' + H.esc(b.city) + '</dd>' +
        '<dt class="col-sm-4">Preferred time</dt><dd class="col-sm-8">' + H.fmtDate(b.date) + ', ' + H.esc(b.timeSlot) + '</dd>' +
        '<dt class="col-sm-4">Estimated price</dt><dd class="col-sm-8">' + (b.estPrice ? H.money(b.estPrice) : 'Quote after inspection') + '</dd>' +
        '<dt class="col-sm-4">Status</dt><dd class="col-sm-8">' + H.statusBadge(b.status) + '</dd>' +
        '</dl>';
    }
  }
})();
