// Authentication: register (customer), login (all roles), me, logout.
// Roles come from the users table — never from the request body on login.
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { signToken } = require('../middleware/auth');
const { HttpError } = require('../middleware/errorHandler');

async function register(req, res) {
  const { name, email, phone, password } = req.body;
  const [dup] = await db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (dup.length) throw new HttpError(409, 'An account with this email already exists.');
  const hash = await bcrypt.hash(password, 10);
  const [r] = await db.query(
    "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'customer')",
    [name, email.toLowerCase(), phone, hash]);
  const token = signToken({ id: r.insertId, role: 'customer', name });
  res.status(201).json({ token, user: { id: r.insertId, name, email: email.toLowerCase(), role: 'customer' } });
}

async function login(req, res) {
  const { email, password } = req.body;
  const [rows] = await db.query(
    `SELECT u.*, t.id AS technician_id, t.status AS tech_status
     FROM users u LEFT JOIN technicians t ON t.user_id = u.id
     WHERE u.email = ?`, [email.toLowerCase()]);
  const user = rows[0];
  // Constant-ish response to avoid user enumeration
  const ok = user && await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new HttpError(401, 'Invalid email or password.');
  if (user.role === 'technician' && user.tech_status === 'suspended') {
    throw new HttpError(403, 'This technician account is suspended. Contact the administrator.');
  }
  const token = signToken({ id: user.id, role: user.role, name: user.name, technicianId: user.technician_id || null });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, technicianId: user.technician_id || null }
  });
}

async function me(req, res) {
  const [rows] = await db.query('SELECT id, name, email, phone, role FROM users WHERE id = ?', [req.user.id]);
  if (!rows.length) throw new HttpError(404, 'User not found.');
  res.json({ user: rows[0] });
}

// Stateless JWT logout — the client discards the token. Server-side revocation
// (blacklist/short expiry + refresh) is out of scope for this demo.
async function logout(req, res) {
  res.json({ message: 'Logged out. Discard the token on the client.' });
}

module.exports = { register, login, me, logout };
