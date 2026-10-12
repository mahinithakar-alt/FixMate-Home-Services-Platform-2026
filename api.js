/* =========================================================
   api.js — centralized frontend API helper for the FixMate backend.
   Include AFTER bootstrap and BEFORE customer/admin/technician scripts:
     <script src="assets/js/common.js"></script>
     <script src="assets/js/api.js"></script>
   Replaces the localStorage demo data flow with backend API calls.
   JWT is kept in localStorage (token only — never credentials).
   ========================================================= */
(function (window) {
  'use strict';

  const TOKEN_KEY = 'hsp_jwt';
  const USER_KEY = 'hsp_user';
  const API = '/api'; // same origin — served by the Express server

  async function request(method, path, body, opts) {
    opts = opts || {};
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && !opts.skipAuth) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (res.status === 401 && !opts.skipAuth) {
      clearSession();
      window.location.href = '/login.html';
      throw new Error('Session expired. Please sign in again.');
    }
    if (!res.ok) throw new Error((data.error && data.error.message) || 'Request failed (' + res.status + ').');
    return data;
  }

  function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; }
  }
  function saveSession(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }

  /* Auth — role comes from the backend user record, never selected client-side. */
  const auth = {
    async register(payload) { const d = await request('POST', '/auth/register', payload, { skipAuth: true }); saveSession(d); return d; },
    async login(email, password) {
      const d = await request('POST', '/auth/login', { email: email, password: password }, { skipAuth: true });
      saveSession(d);
      return d;
    },
    async me() { return request('GET', '/auth/me'); },
    logout() { fetch(API + '/auth/logout', { method: 'POST' }).catch(() => {}); clearSession(); window.location.href = '/login.html'; },
    // Backend-decided redirect target by role
    homeFor(role) { return role === 'admin' ? '/admin/dashboard.html' : role === 'technician' ? '/technician/dashboard.html' : '/index.html'; },
    requireRole(role) {
      const u = getUser();
      if (!getToken() || !u || u.role !== role) { window.location.href = '/login.html'; return null; }
      return u;
    },
    getToken: getToken, getUser: getUser
  };

  /* Public catalog */
  const catalog = {
    categories: () => request('GET', '/categories', null, { skipAuth: true }),
    services: (params) => request('GET', '/services' + (params ? '?' + new URLSearchParams(params) : ''), null, { skipAuth: true }),
    settings: () => request('GET', '/settings', null, { skipAuth: true })
  };

  /* Customer */
  const customer = {
    bookings: () => request('GET', '/bookings'),
    createBooking: (payload) => request('POST', '/bookings', payload),
    booking: (id) => request('GET', '/bookings/' + encodeURIComponent(id)),
    cancelBooking: (id, reason) => request('POST', '/bookings/' + encodeURIComponent(id) + '/cancel', { reason: reason }),
    review: (id, rating, comment) => request('POST', '/bookings/' + encodeURIComponent(id) + '/review', { rating: rating, comment: comment })
  };

  /* Admin */
  const admin = {
    dashboard: () => request('GET', '/admin/dashboard'),
    bookings: (params) => request('GET', '/admin/bookings?' + new URLSearchParams(params || {})),
    assign: (id, technicianId) => request('POST', '/admin/bookings/' + encodeURIComponent(id) + '/assign', { technicianId: technicianId }),
    status: (id, status, note) => request('POST', '/admin/bookings/' + encodeURIComponent(id) + '/status', { status: status, note: note }),
    reschedule: (id, date, timeSlot) => request('POST', '/admin/bookings/' + encodeURIComponent(id) + '/reschedule', { date: date, timeSlot: timeSlot }),
    technicians: (params) => request('GET', '/admin/technicians?' + new URLSearchParams(params || {})),
    createTechnician: (p) => request('POST', '/admin/technicians', p),
    updateTechnician: (id, p) => request('PUT', '/admin/technicians/' + id, p),
    deleteTechnician: (id) => request('DELETE', '/admin/technicians/' + id),
    payments: (params) => request('GET', '/admin/payments?' + new URLSearchParams(params || {})),
    updatePayment: (id, p) => request('PUT', '/admin/payments/' + id, p),
    reviews: () => request('GET', '/admin/reviews'),
    moderateReview: (id, moderated) => request('PUT', '/admin/reviews/' + id, { moderated: moderated }),
    reports: (params) => request('GET', '/admin/reports?' + new URLSearchParams(params || {})),
    saveSettings: (p) => request('PUT', '/admin/settings', p),
    createCategory: (p) => request('POST', '/admin/categories', p),
    updateCategory: (id, p) => request('PUT', '/admin/categories/' + id, p),
    deleteCategory: (id) => request('DELETE', '/admin/categories/' + id),
    createService: (p) => request('POST', '/admin/services', p),
    updateService: (id, p) => request('PUT', '/admin/services/' + id, p),
    deleteService: (id) => request('DELETE', '/admin/services/' + id)
  };

  /* Technician (scoped server-side to the token's technicianId) */
  const tech = {
    dashboard: () => request('GET', '/tech/dashboard'),
    jobs: (params) => request('GET', '/tech/jobs?' + new URLSearchParams(params || {})),
    job: (id) => request('GET', '/tech/jobs/' + encodeURIComponent(id)),
    jobStatus: (id, status, note) => request('POST', '/tech/jobs/' + encodeURIComponent(id) + '/status', { status: status, note: note }),
    quote: (id, amount) => request('POST', '/tech/jobs/' + encodeURIComponent(id) + '/quote', { amount: amount }),
    note: (id, note) => request('POST', '/tech/jobs/' + encodeURIComponent(id) + '/note', { note: note }),
    history: (params) => request('GET', '/tech/history?' + new URLSearchParams(params || {})),
    earnings: (params) => request('GET', '/tech/earnings?' + new URLSearchParams(params || {})),
    availability: () => request('GET', '/tech/availability'),
    saveAvailability: (p) => request('PUT', '/tech/availability', p),
    profile: () => request('GET', '/tech/profile'),
    saveProfile: (p) => request('PUT', '/tech/profile', p)
  };

  window.HSPApi = { request, auth, catalog, customer, admin, tech, saveSession, clearSession };
})(window);
