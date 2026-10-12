// Super Admin APIs — every route is protected by authenticate + authorize('admin').
const db = require('../config/db');
const { HttpError } = require('../middleware/errorHandler');
const B = require('../services/bookingService');

/* ---------- Dashboard ---------- */
async function dashboard(req, res) {
  const [counts] = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(status='New / Pending') AS new_requests,
       SUM(status IN ('Assigned','Accepted','On the Way')) AS confirmed,
       SUM(status='In Progress') AS in_progress,
       SUM(status='Completed') AS completed,
       SUM(status='Cancelled') AS cancelled
     FROM bookings`);
  const [revenue] = await db.query(
    `SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE status='paid'`);
  const [trend] = await db.query(
    `SELECT DATE_FORMAT(date,'%Y-%m-%d') AS d, COUNT(*) AS n FROM bookings
     WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY d ORDER BY d`);
  const [popular] = await db.query(
    `SELECT c.name, COUNT(b.id) AS n FROM bookings b
     JOIN services s ON s.id=b.service_id JOIN categories c ON c.id=s.category_id
     GROUP BY c.id ORDER BY n DESC LIMIT 6`);
  res.json({ stats: counts[0], revenue: revenue[0].revenue, trend, popular });
}

/* ---------- Bookings ---------- */
async function listBookings(req, res) {
  const where = [], params = [];
  const q = req.query;
  if (q.search) { where.push('(b.id LIKE ? OR u.name LIKE ?)'); params.push('%' + q.search + '%', '%' + q.search + '%'); }
  if (q.from) { where.push('b.date >= ?'); params.push(q.from); }
  if (q.to) { where.push('b.date <= ?'); params.push(q.to); }
  if (q.category) { where.push('s.category_id = ?'); params.push(q.category); }
  if (q.technician) { where.push('b.technician_id = ?'); params.push(q.technician); }
  if (q.area) { where.push('b.city = ?'); params.push(q.area); }
  if (q.status) { where.push('b.status = ?'); params.push(q.status); }
  const [rows] = await db.query(
    `SELECT b.id, b.date, b.time_slot, b.city, b.status, b.estimated_price, b.final_price, b.payment_status,
            b.created_at, u.name AS customer_name, s.name AS service_name, t.user_id AS tech_user_id,
            tu.name AS technician_name
     FROM bookings b
     JOIN users u ON u.id=b.user_id
     JOIN services s ON s.id=b.service_id
     LEFT JOIN technicians t ON t.id=b.technician_id
     LEFT JOIN users tu ON tu.id=t.user_id
     ${where.length ? 'WHERE ' + where.map(w => w.replace('b.id', 'b.id')).join(' AND ') : ''}
     ORDER BY b.created_at DESC LIMIT 200`, params);
  res.json({ bookings: rows });
}

async function assignTechnician(req, res) {
  const b = await B.getBookingOr404(req.params.id);
  if (!['New / Pending', 'Assigned', 'Accepted', 'On the Way', 'In Progress', 'Unable to Complete'].includes(b.status)) {
    throw new HttpError(422, 'This booking cannot be (re)assigned in its current status.');
  }
  const techId = req.body.technicianId;
  const [tech] = await db.query(
    "SELECT t.*, u.name FROM technicians t JOIN users u ON u.id=t.user_id WHERE t.id=? AND t.status='active'", [techId]);
  if (!tech.length) throw new HttpError(422, 'Technician not found or not active.');
  if (await B.technicianHasConflict(db, techId, b.date, b.time_slot, b.id)) {
    throw new HttpError(409, 'Slot conflict: this technician already has a confirmed booking in that slot.');
  }
  const from = b.status;
  await db.query('UPDATE bookings SET technician_id=? WHERE id=?', [techId, b.id]);
  if (b.status === 'New / Pending') {
    await db.query("UPDATE bookings SET status='Assigned' WHERE id=?", [b.id]);
    await B.logHistory(db, b.id, from, 'Assigned', req.user.id, req.user.name, 'Assigned ' + tech[0].name);
  } else {
    await B.logHistory(db, b.id, from, from, req.user.id, req.user.name, 'Reassigned to ' + tech[0].name);
  }
  res.json({ message: 'Technician assigned.' });
}

async function updateStatus(req, res) {
  const b = await B.getBookingOr404(req.params.id);
  const to = req.body.status;
  B.assertTransition(b.status, to);
  const note = (req.body.note || '').trim();
  if (to === 'Cancelled' && !note) throw new HttpError(422, 'A cancellation reason is required.');
  if (to === 'Assigned' && !b.technician_id) throw new HttpError(422, 'Assign a technician first.');
  await db.query('UPDATE bookings SET status=?, cancel_reason=? WHERE id=?',
    [to, to === 'Cancelled' ? note : b.cancel_reason, b.id]);
  if (to === 'Completed' && !b.final_price) {
    const finalPrice = b.quoted_price || b.estimated_price || 0;
    await db.query('UPDATE bookings SET final_price=? WHERE id=?', [finalPrice, b.id]);
    // Create the payment record (pending until a gateway/verified action marks it paid)
    await db.query('INSERT INTO payments (booking_id, amount) VALUES (?,?) ON DUPLICATE KEY UPDATE amount=VALUES(amount)', [b.id, finalPrice]);
  }
  await B.logHistory(db, b.id, b.status, to, req.user.id, req.user.name, note);
  res.json({ message: 'Status updated to "' + to + '".' });
}

async function reschedule(req, res) {
  const b = await B.getBookingOr404(req.params.id);
  if (['Completed', 'Cancelled'].includes(b.status)) throw new HttpError(422, 'Closed bookings cannot be rescheduled.');
  const { date, timeSlot } = req.body;
  if (b.technician_id && await B.technicianHasConflict(db, b.technician_id, date, timeSlot, b.id)) {
    throw new HttpError(409, 'Slot conflict for the assigned technician. Pick another slot.');
  }
  await db.query('UPDATE bookings SET date=?, time_slot=? WHERE id=?', [date, timeSlot, b.id]);
  await B.logHistory(db, b.id, b.status, b.status, req.user.id, req.user.name, 'Rescheduled to ' + date + ' ' + timeSlot);
  res.json({ message: 'Booking rescheduled.' });
}

/* ---------- Technicians ---------- */
async function listTechnicians(req, res) {
  const where = [], params = [];
  const q = req.query;
  if (q.search) { where.push('(u.name LIKE ? OR u.email LIKE ?)'); params.push('%' + q.search + '%', '%' + q.search + '%'); }
  if (q.category) { where.push('t.category_id = ?'); params.push(q.category); }
  if (q.area) { where.push('t.areas LIKE ?'); params.push('%' + q.area + '%'); }
  if (q.status) { where.push('t.status = ?'); params.push(q.status); }
  if (q.verification) { where.push('t.verification = ?'); params.push(q.verification); }
  const [rows] = await db.query(
    `SELECT t.id, u.name, u.email, u.phone, c.name AS category_name, t.category_id,
            t.skills, t.experience, t.areas, t.hours, t.status, t.verification, t.rating, t.completed_jobs
     FROM technicians t JOIN users u ON u.id=t.user_id JOIN categories c ON c.id=t.category_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.name`, params);
  res.json({ technicians: rows });
}

async function createTechnician(req, res) {
  const t = req.body;
  const [dup] = await db.query('SELECT id FROM users WHERE email=?', [t.email.toLowerCase()]);
  if (dup.length) throw new HttpError(409, 'A user with this email already exists.');
  const hash = await bcryptHash(t.password || 'Welcome123!');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [u] = await conn.query("INSERT INTO users (name,email,phone,password_hash,role) VALUES (?,?,?,?,'technician')",
      [t.name, t.email.toLowerCase(), t.phone, hash]);
    const [r] = await conn.query(
      "INSERT INTO technicians (user_id, category_id, skills, experience, areas, hours, status, verification) VALUES (?,?,?,?,?,?,?,?)",
      [u.insertId, t.categoryId, t.skills, t.experience, t.areas, t.hours || '09:00 - 18:00',
       t.verification === 'verified' ? 'active' : 'pending', t.verification || 'pending']);
    await conn.query('INSERT INTO technician_availability (technician_id, time_slots) VALUES (?,?)',
      [r.insertId, '09:00-11:00,11:00-13:00,13:00-15:00,15:00-17:00,17:00-19:00']);
    await conn.commit();
    res.status(201).json({ technician: { id: r.insertId } });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

async function updateTechnician(req, res) {
  const t = req.body;
  const [cur] = await db.query('SELECT * FROM technicians WHERE id=?', [req.params.id]);
  if (!cur.length) throw new HttpError(404, 'Technician not found.');
  await db.query(
    `UPDATE technicians t JOIN users u ON u.id=t.user_id
     SET u.name=?, u.phone=?, t.category_id=?, t.skills=?, t.experience=?, t.areas=?, t.hours=?, t.verification=?, t.status=?
     WHERE t.id=?`,
    [t.name, t.phone, t.categoryId, t.skills, t.experience, t.areas, t.hours, t.verification, t.status, req.params.id]);
  res.json({ message: 'Technician updated.' });
}

async function deleteTechnician(req, res) {
  const [cur] = await db.query('SELECT user_id FROM technicians WHERE id=?', [req.params.id]);
  if (!cur.length) throw new HttpError(404, 'Technician not found.');
  await db.query('DELETE FROM users WHERE id=?', [cur[0].user_id]); // cascades to technician + availability
  res.json({ message: 'Technician deleted. Their bookings now show as unassigned.' });
}

/* ---------- Pricing & payments ---------- */
async function payments(req, res) {
  const where = [], params = [];
  if (req.query.status) { where.push('p.status = ?'); params.push(req.query.status); }
  if (req.query.search) { where.push('(p.booking_id LIKE ? OR u.name LIKE ?)'); params.push('%' + req.query.search + '%', '%' + req.query.search + '%'); }
  const [rows] = await db.query(
    `SELECT p.*, u.name AS customer_name, s.name AS service_name,
            ROUND(p.amount * 0.15, 2) AS platform_commission, ROUND(p.amount * 0.85, 2) AS technician_amount
     FROM payments p JOIN bookings b ON b.id=p.booking_id JOIN users u ON u.id=b.user_id JOIN services s ON s.id=b.service_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.created_at DESC`, params);
  const [tot] = await db.query(
    `SELECT COALESCE(SUM(p.amount),0) AS gross,
            ROUND(COALESCE(SUM(p.amount),0)*0.15,2) AS commission,
            ROUND(COALESCE(SUM(p.amount),0)*0.85,2) AS payable
     FROM payments p WHERE p.status='paid'`);
  res.json({ payments: rows, summary: tot[0], note: 'All amounts are sample/demo data. Connect a payment gateway before treating any payment as verified.' });
}

async function updatePayment(req, res) {
  const p = req.body;
  if (p.status === 'paid' && !req.body.confirmedByGateway) {
    // Never fake a verified payment: demo flow stays explicit.
    const [r] = await db.query(
      `UPDATE payments SET status='paid', method=?, paid_at=NOW() WHERE id=? AND method LIKE '%demo%'`,
      [p.method || 'demo (manual)', req.params.id]);
    if (!r.affectedRows) throw new HttpError(422, 'Only explicitly demo-labelled payment records can be marked paid without a gateway.');
    await db.query('UPDATE bookings SET payment_status="paid" WHERE id=(SELECT booking_id FROM payments WHERE id=?)', [req.params.id]);
    return res.json({ message: 'DEMO payment marked paid (no real money moved).' });
  }
  const [r] = await db.query('UPDATE payments SET method=? WHERE id=?', [p.method || 'demo (manual)', req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Payment record not found.');
  res.json({ message: 'Payment record updated.' });
}

/* ---------- Reviews & reports ---------- */
async function reviews(req, res) {
  const [rows] = await db.query(
    `SELECT r.*, u.name AS author, b.technician_id
     FROM reviews r JOIN users u ON u.id=r.user_id JOIN bookings b ON b.id=r.booking_id
     ORDER BY r.created_at DESC`);
  res.json({ reviews: rows });
}

async function moderateReview(req, res) {
  if (!['visible', 'hidden', 'flagged'].includes(req.body.moderated)) throw new HttpError(422, 'Invalid moderation state.');
  const [r] = await db.query('UPDATE reviews SET moderated=? WHERE id=?', [req.body.moderated, req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Review not found.');
  res.json({ message: 'Review moderated.' });
}

async function reports(req, res) {
  const from = req.query.from || '1970-01-01', to = req.query.to || '2999-12-31';
  const [bookings] = await db.query(
    `SELECT b.id, u.name AS customer, s.name AS service, b.date, b.status, COALESCE(b.final_price,b.estimated_price,0) AS amount
     FROM bookings b JOIN users u ON u.id=b.user_id JOIN services s ON s.id=b.service_id
     WHERE b.date BETWEEN ? AND ? ORDER BY b.date DESC`, [from, to]);
  const [cats] = await db.query(
    `SELECT c.name, COUNT(b.id) AS bookings, COALESCE(SUM(b.final_price AND b.status='Completed' * b.final_price),0) AS revenue
     FROM bookings b JOIN services s ON s.id=b.service_id JOIN categories c ON c.id=s.category_id
     WHERE b.date BETWEEN ? AND ? GROUP BY c.id`, [from, to]);
  const [techs] = await db.query(
    `SELECT u.name, COUNT(b.id) AS assigned,
             SUM(b.status='Completed') AS completed,
             COALESCE(SUM(CASE WHEN b.status='Completed' THEN b.final_price ELSE 0 END),0) AS revenue,
             t.rating
     FROM technicians t JOIN users u ON u.id=t.user_id
     LEFT JOIN bookings b ON b.technician_id=t.id AND b.date BETWEEN ? AND ?
     GROUP BY t.id`, [from, to]);
  const revenue = bookings.filter(b => b.status === 'Completed').reduce((a, b) => a + Number(b.amount), 0);
  res.json({
    bookings, categories: cats, technicians: techs,
    revenue: { completedJobs: bookings.filter(b => b.status === 'Completed').length, gross: revenue,
               commission: +(revenue * 0.15).toFixed(2), payable: +(revenue * 0.85).toFixed(2),
               note: 'sample data' }
  });
}

/* ---------- Settings ---------- */
async function getSettings(req, res) {
  const [rows] = await db.query('SELECT * FROM settings WHERE id=1');
  res.json({ settings: rows[0] || {} });
}
async function updateSettings(req, res) {
  const s = req.body;
  await db.query(
    `UPDATE settings SET site_name=?, logo_text=?, phone=?, email=?, address=?, locations=?,
     business_hours=?, booking_rules=?, cancellation_rules=?, notif_template=?, admin_name=?, admin_email=?
     WHERE id=1`,
    [s.siteName, s.logoText, s.phone, s.email, s.address, s.locations, s.businessHours,
     s.bookingRules, s.cancellationRules, s.notifTemplate, s.adminName, s.adminEmail]);
  res.json({ message: 'Settings saved to the database.' });
}

// small local helper to avoid importing bcryptjs twice at top
const bcrypt = require('bcryptjs');
function bcryptHash(p) { return bcrypt.hash(p, 10); }

module.exports = {
  dashboard, listBookings, assignTechnician, updateStatus, reschedule,
  listTechnicians, createTechnician, updateTechnician, deleteTechnician,
  payments, updatePayment, reviews, moderateReview, reports, getSettings, updateSettings
};
