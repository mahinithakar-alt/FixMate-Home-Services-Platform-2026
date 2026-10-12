// Technician APIs — strictly scoped to req.user.technicianId from the JWT.
// A technician can never see or modify another technician's jobs.
const db = require('../config/db');
const { HttpError } = require('../middleware/errorHandler');
const B = require('../services/bookingService');

function myTechId(req) {
  if (!req.user.technicianId) throw new HttpError(403, 'No technician profile is linked to this account.');
  return req.user.technicianId;
}

async function dashboard(req, res) {
  const tid = myTechId(req);
  const [cards] = await db.query(
    `SELECT
       SUM(status='Assigned') AS assigned,
       SUM(status IN ('Accepted','On the Way','In Progress')) AS active,
       SUM(status='Completed') AS completed,
       SUM(date = CURDATE() AND status IN ('Assigned','Accepted','On the Way','In Progress')) AS today
     FROM bookings WHERE technician_id = ?`, [tid]);
  const [earn] = await db.query(
    `SELECT COALESCE(SUM(final_price),0) AS gross FROM bookings WHERE technician_id=? AND status='Completed'`, [tid]);
  const [upcoming] = await db.query(
    `SELECT b.id, b.date, b.time_slot, b.status, u.name AS customer_name, s.name AS service_name, b.city
     FROM bookings b JOIN users u ON u.id=b.user_id JOIN services s ON s.id=b.service_id
     WHERE b.technician_id=? AND b.status IN ('Assigned','Accepted','On the Way','In Progress')
     ORDER BY b.date, b.time_slot LIMIT 20`, [tid]);
  const [alerts] = await db.query(
    `SELECT h.booking_id, h.note, h.created_at FROM booking_status_history h
     JOIN bookings b ON b.id=h.booking_id
     WHERE b.technician_id=? AND h.to_status='Assigned' ORDER BY h.created_at DESC LIMIT 5`, [tid]);
  res.json({
    cards: cards[0],
    earnings: { gross: earn[0].gross, payable: +(earn[0].gross * 0.85).toFixed(2), note: 'sample 15% platform fee' },
    upcoming, alerts
  });
}

async function assignedJobs(req, res) {
  const tid = myTechId(req);
  const where = ['b.technician_id = ?'], params = [tid];
  if (req.query.status) { where.push('b.status = ?'); params.push(req.query.status); }
  if (req.query.search) { where.push('(b.id LIKE ? OR u.name LIKE ? OR s.name LIKE ?)'); params.push('%' + req.query.search + '%', '%' + req.query.search + '%', '%' + req.query.search + '%'); }
  const [rows] = await db.query(
    `SELECT b.id, b.date, b.time_slot, b.city, b.address, b.status, u.name AS customer_name, s.name AS service_name
     FROM bookings b JOIN users u ON u.id=b.user_id JOIN services s ON s.id=b.service_id
     WHERE ${where.join(' AND ')} ORDER BY b.date, b.time_slot`, params);
  res.json({ jobs: rows });
}

async function jobDetails(req, res) {
  const tid = myTechId(req);
  const [rows] = await db.query(
    `SELECT b.*, u.name AS customer_name, u.phone AS customer_phone, u.email AS customer_email,
            s.name AS service_name, s.pricing_type
     FROM bookings b JOIN users u ON u.id=b.user_id JOIN services s ON s.id=b.service_id
     WHERE b.id = ? AND b.technician_id = ?`, [req.params.id, tid]); // scope: only MY jobs
  if (!rows.length) throw new HttpError(404, 'Job not found or not assigned to you.');
  const [history] = await db.query(
    'SELECT from_status, to_status, actor_label, note, created_at FROM booking_status_history WHERE booking_id=? ORDER BY id',
    [req.params.id]);
  res.json({ job: rows[0], history });
}

async function updateJobStatus(req, res) {
  const tid = myTechId(req);
  const b = await B.getBookingOr404(req.params.id);
  if (b.technician_id !== tid) throw new HttpError(403, 'This job is not assigned to you.');
  const to = req.body.status;
  const note = (req.body.note || '').trim();
  B.assertTransition(b.status, to);
  if (to === 'Completed') {
    const [svc] = await db.query(
      'SELECT s.pricing_type FROM services s JOIN bookings b ON b.service_id=s.id WHERE b.id=?', [b.id]);
    if (svc[0].pricing_type === 'quote' && !b.quoted_price) {
      throw new HttpError(422, 'Submit a quote amount before completing this quote-based job.');
    }
    const finalPrice = b.quoted_price || b.estimated_price || 0;
    await db.query('UPDATE bookings SET final_price=? WHERE id=?', [finalPrice, b.id]);
    // Create the payment record (pending until verified; demo-labelled by default)
    await db.query('INSERT INTO payments (booking_id, amount) VALUES (?,?) ON DUPLICATE KEY UPDATE amount=VALUES(amount)', [b.id, finalPrice]);
  }
  await db.query('UPDATE bookings SET status=?, cancel_reason=? WHERE id=?',
    [to, to === 'Cancelled' ? (note || 'Cancelled by technician') : b.cancel_reason, b.id]);
  await B.logHistory(db, b.id, b.status, to, req.user.id, req.user.name, note);
  res.json({ message: 'Job status updated to "' + to + '".' });
}

async function submitQuote(req, res) {
  const tid = myTechId(req);
  const b = await B.getBookingOr404(req.params.id);
  if (b.technician_id !== tid) throw new HttpError(403, 'This job is not assigned to you.');
  const amount = Number(req.body.amount);
  if (!(amount >= 0)) throw new HttpError(422, 'Enter a valid non-negative amount.');
  await db.query('UPDATE bookings SET quoted_price=? WHERE id=?', [amount, b.id]);
  await B.logHistory(db, b.id, b.status, b.status, req.user.id, req.user.name, 'Quote of $' + amount.toFixed(2) + ' submitted for admin review');
  res.json({ message: 'Quote submitted for admin review.' });
}

async function addJobNote(req, res) {
  const tid = myTechId(req);
  const b = await B.getBookingOr404(req.params.id);
  if (b.technician_id !== tid) throw new HttpError(403, 'This job is not assigned to you.');
  if (!(req.body.note || '').trim()) throw new HttpError(422, 'Note cannot be empty.');
  await B.logHistory(db, b.id, b.status, b.status, req.user.id, req.user.name, req.body.note.trim());
  res.json({ message: 'Note added.' });
}

async function history(req, res) {
  const tid = myTechId(req);
  const where = ["b.technician_id = ?", "b.status IN ('Completed','Cancelled','Unable to Complete')"], params = [tid];
  if (req.query.from) { where.push('b.date >= ?'); params.push(req.query.from); }
  if (req.query.to) { where.push('b.date <= ?'); params.push(req.query.to); }
  if (req.query.status) { where.push('b.status = ?'); params.push(req.query.status); }
  const [rows] = await db.query(
    `SELECT b.id, b.date, b.status, b.final_price, s.name AS service_name, u.name AS customer_name,
            (SELECT COUNT(*) FROM booking_status_history h WHERE h.booking_id=b.id) + 1 AS history_entries
     FROM bookings b JOIN users u ON u.id=b.user_id JOIN services s ON s.id=b.service_id
     WHERE ${where.join(' AND ')} ORDER BY b.date DESC`, params);
  res.json({ jobs: rows });
}

async function earnings(req, res) {
  const tid = myTechId(req);
  const from = req.query.from || '1970-01-01', to = req.query.to || '2999-12-31';
  const [rows] = await db.query(
    `SELECT b.id, b.date, s.name AS service_name, b.final_price,
            ROUND(b.final_price*0.15,2) AS platform_fee, ROUND(b.final_price*0.85,2) AS net_payable,
            b.payment_status
     FROM bookings b JOIN services s ON s.id=b.service_id
     WHERE b.technician_id=? AND b.status='Completed' AND b.date BETWEEN ? AND ?
     ORDER BY b.date DESC`, [tid, from, to]);
  const gross = rows.reduce((a, r) => a + Number(r.final_price || 0), 0);
  res.json({
    jobs: rows,
    summary: { completedJobs: rows.length, gross, fee: +(gross * 0.15).toFixed(2), payable: +(gross * 0.85).toFixed(2),
               payout: 'weekly (sample)', note: 'read-only records' }
  });
}

async function updateAvailability(req, res) {
  const tid = myTechId(req);
  const a = req.body;
  if (a.breakStart && a.breakEnd && a.breakStart >= a.breakEnd) {
    throw new HttpError(422, 'Break start must be before break end.');
  }
  await db.query(
    `UPDATE technician_availability SET working_days=?, time_slots=?, break_start=?, break_end=?, unavailable_dates=?, is_available=?
     WHERE technician_id=?`,
    [a.workingDays, a.timeSlots, a.breakStart || null, a.breakEnd || null, a.unavailableDates || '',
     a.isAvailable === false ? 0 : 1, tid]);
  res.json({ message: 'Availability saved.' });
}

async function getAvailability(req, res) {
  const tid = myTechId(req);
  const [rows] = await db.query('SELECT * FROM technician_availability WHERE technician_id=?', [tid]);
  res.json({ availability: rows[0] || null });
}

async function getProfile(req, res) {
  const tid = myTechId(req);
  const [rows] = await db.query(
    `SELECT t.id, u.name, u.phone, u.email, c.name AS category_name, t.category_id,
            t.skills, t.experience, t.areas, t.hours, t.status, t.verification, t.rating, t.completed_jobs
     FROM technicians t JOIN users u ON u.id=t.user_id JOIN categories c ON c.id=t.category_id
     WHERE t.id = ?`, [tid]);
  if (!rows.length) throw new HttpError(404, 'Technician profile not found.');
  res.json({ profile: rows[0], readOnly: 'verification, rating, completed jobs and account status are managed by the Super Admin' });
}

async function updateProfile(req, res) {
  const tid = myTechId(req);
  const t = req.body;
  await db.query(
    `UPDATE technicians t JOIN users u ON u.id=t.user_id
     SET u.name=?, u.phone=?, t.skills=?, t.experience=?, t.areas=?
     WHERE t.id=?`,
    [t.name, t.phone, t.skills, t.experience, t.areas, tid]);
  // verification/rating/completed_jobs are NOT editable here (read-only by design)
  res.json({ message: 'Profile saved. Changes requiring verification are reviewed by the admin.' });
}

module.exports = { dashboard, assignedJobs, jobDetails, updateJobStatus, submitQuote, addJobNote, history, earnings, updateAvailability, getAvailability, getProfile, updateProfile };
