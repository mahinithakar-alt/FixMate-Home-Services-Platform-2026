// Safe initial Super Admin creation — credentials come from env, password is
// bcrypt-hashed at runtime. Never hardcoded in SQL or source.
// Usage: npm run create-admin
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

(async () => {
  const name = process.env.ADMIN_NAME || 'Site Administrator';
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env before creating the admin.');
    process.exit(1);
  }
  if (password.length < 8) { console.error('ADMIN_PASSWORD must be at least 8 characters.'); process.exit(1); }
  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) { console.log('Admin already exists:', email); process.exit(0); }
  const hash = await bcrypt.hash(password, 10);
  const [r] = await db.query(
    "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, '—', ?, 'admin')",
    [name, email, hash]
  );
  console.log('Super Admin created: id=' + r.insertId + ' ' + email);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
