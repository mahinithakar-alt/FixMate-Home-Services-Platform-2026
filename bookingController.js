// Customer booking APIs. Customers only ever access their own bookings
// (every query is scoped by req.user.id).
const db = require('../config/db');
const { HttpError } = require('../middleware/errorHandler');
const B = require('../services/bookingService');

async function create(req, res) {
  const { serviceId, address, city, date, timeSlot, notes, image } = req.body;
  const [svc] = await db.query(
    `SELECT s.*, c.active AS category_active FROM services s JOIN categories c ON c.id = s.category_id
     WHERE s.id = ?`, [serviceId]);
  if (!svc.length || !svc[0].active || !svc[0].category_active) {
    throw new HttpError(422, 'This service is not available for booking.');
  }
  const estimated = B.priceFromService(svc[0]); // server-side price, never client-supplied
  const id = await B.genBookingId();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO bookings (id, user_id, service_id, address, city, date, time_slot, notes, image, estimated_price, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,'New / Pending')`,
      [id, req.user.id, serviceId, address, city, date, timeSlot, notes, image || null, estimated]);
    await B.logHistory(conn, id, null, 'New / Pending', req.user.id, req.user.name, 'Booking created');
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  res.status(201).json({ booking: { id, status: 'New / Pending', estimated_price: estimated, date, timeSlot } });
}

async function myBookings(req, res) {
  const [rows] = await db.query(
    `SELECT b.*, s.name AS service_name, s.pricing_type, c.name AS category_name
     FROM bookings b JOIN services s ON s.id = b.service_id JOIN categories c ON c.id = s.category_id
     WHERE b.user_id = ? ORDER BY b.created_at DESC`, [req.user.id]);
  res.json({ bookings: rows });
}

async function getById(req, res) {
  // Ownership check: customers may only open their own booking; admin any.
  const scope = req.user.role === 'admin' ? '' : ' AND b.user_id = ?';
  const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
  const [rows] = await db.query(
    `SELECT b.*, s.name AS service_name, s.pricing_type, s.duration, c.name AS category_name,
            u.name AS customer_name, u.phone AS customer_phone, u.email AS customer_email
     FROM bookings b JOIN services s ON s.id = b.service_id JOIN categories c ON c.id = s.category_id
     JOIN users u ON u.id = b.user_id
     WHERE b.id = ?${scope}`, params);
  if (!rows.length) throw new HttpError(404, 'Booking not found.');
  const [history] = await db.query(
    'SELECT from_status, to_status, actor_label, note, created_at FROM booking_status_history WHERE booking_id = ? ORDER BY id',
    [req.params.id]);
  res.json({ booking: rows[0], history });
}

async function cancel(req, res) {
  const b = await B.getBookingOr404(req.params.id);
  if (b.user_id !== req.user.id) throw new HttpError(403, 'You can only cancel your own bookings.');
  if (!['New / Pending', 'Assigned'].includes(b.status)) {
    throw new HttpError(422, 'This booking can no longer be cancelled online. Contact support.');
  }
  const reason = (req.body.reason || '').trim();
  if (!reason) throw new HttpError(422, 'A cancellation reason is required.');
  await db.query("UPDATE bookings SET status='Cancelled', cancel_reason=? WHERE id=?", [reason, b.id]);
  await B.logHistory(db, b.id, b.status, 'Cancelled', req.user.id, req.user.name, reason);
  res.json({ message: 'Booking cancelled. History retained.' });
}

async function submitReview(req, res) {
  const b = await B.getBookingOr404(req.params.id);
  if (b.user_id !== req.user.id) throw new HttpError(403, 'You can only review your own bookings.');
  if (b.status !== 'Completed') throw new HttpError(422, 'Only completed bookings can be reviewed.');
  const [dup] = await db.query('SELECT id FROM reviews WHERE booking_id = ?', [b.id]);
  if (dup.length) throw new HttpError(409, 'You already reviewed this booking.');
  await db.query('INSERT INTO reviews (booking_id, user_id, rating, comment) VALUES (?,?,?,?)',
    [b.id, req.user.id, req.body.rating, req.body.comment]);
  // Refresh the technician's aggregate rating
  if (b.technician_id) {
    await db.query(
      `UPDATE technicians t SET rating = COALESCE((SELECT ROUND(AVG(r.rating),2) FROM reviews r
        JOIN bookings b2 ON b2.id = r.booking_id WHERE b2.technician_id = t.id AND r.moderated='visible'), t.rating)
       WHERE t.id = ?`, [b.technician_id]);
  }
  res.status(201).json({ message: 'Review submitted. Thank you!' });
}

module.exports = { create, myBookings, getById, cancel, submitReview };
