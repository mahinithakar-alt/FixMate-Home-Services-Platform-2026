// Core booking domain rules — single source of truth for status transitions,
// booking IDs, history logging, overlap checks and server-side pricing.
const db = require('../config/db');
const { HttpError } = require('../middleware/errorHandler');

const TRANSITIONS = {
  'New / Pending': ['Assigned', 'Cancelled'],
  'Assigned': ['Accepted', 'Cancelled', 'Unable to Complete'],
  'Accepted': ['On the Way', 'Cancelled', 'Unable to Complete'],
  'On the Way': ['In Progress', 'Unable to Complete'],
  'In Progress': ['Completed', 'Unable to Complete'],
  'Completed': [],
  'Cancelled': [],
  'Unable to Complete': ['Assigned', 'Cancelled']
};

const ACTIVE_JOB_STATUSES = ['Assigned', 'Accepted', 'On the Way', 'In Progress'];

function assertTransition(from, to) {
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new HttpError(422, `Invalid status transition: "${from}" → "${to}". Allowed: ${allowed.length ? allowed.join(', ') : 'none'}.`);
  }
}

// Unique booking ID: HSP-YYMMDD-NNNN (server-generated).
async function genBookingId() {
  const d = new Date();
  const prefix = 'HSP-' + String(d.getFullYear()).slice(2) +
    String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const [rows] = await db.query(
    'SELECT id FROM bookings WHERE id LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE'.replace(' FOR UPDATE', ''),
    [prefix + '-%']);
  const last = rows.length ? parseInt(rows[0].id.slice(-4), 10) : 0;
  return prefix + '-' + String(last + 1).padStart(4, '0');
}

async function logHistory(conn, bookingId, from, to, actorUserId, actorLabel, note) {
  await conn.query(
    'INSERT INTO booking_status_history (booking_id, from_status, to_status, actor_user_id, actor_label, note) VALUES (?,?,?,?,?,?)',
    [bookingId, from, to, actorUserId || null, actorLabel, note || null]);
}

// Prevent overlapping assignments: same technician, same date+slot, active job.
async function technicianHasConflict(conn, technicianId, date, timeSlot, excludeBookingId) {
  const [rows] = await (conn || db).query(
    `SELECT id FROM bookings WHERE technician_id = ? AND date = ? AND time_slot = ?
     AND status IN ('Assigned','Accepted','On the Way','In Progress')` +
    (excludeBookingId ? ' AND id <> ?' : ''),
    excludeBookingId ? [technicianId, date, timeSlot, excludeBookingId] : [technicianId, date, timeSlot]);
  return rows.length > 0;
}

// Price is ALWAYS computed from the DB service record, never from the client.
function priceFromService(service) {
  return service.pricing_type === 'fixed' ? Number(service.base_price) : 0;
}

async function getBookingOr404(id) {
  const [rows] = await db.query('SELECT * FROM bookings WHERE id = ?', [id]);
  if (!rows.length) throw new HttpError(404, 'Booking not found.');
  return rows[0];
}

module.exports = { TRANSITIONS, ACTIVE_JOB_STATUSES, assertTransition, genBookingId, logHistory, technicianHasConflict, priceFromService, getBookingOr404 };
