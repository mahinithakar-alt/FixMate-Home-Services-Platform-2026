// Demo users with runtime-bcrypt hashed passwords (no plaintext in SQL).
// Usage: npm run seed-demo-users   (idempotent)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Password123!';

const TECHS = [
  { name: 'Ravi Kumar', email: 'ravi@fixmate.demo', phone: '+1-555-0101', cat: 'AC Technician', skills: 'HVAC, Electrical, Refrigerant handling', experience: '6 years', areas: 'Downtown, Riverside', hours: '09:00 - 18:00', days: 'Mon,Tue,Wed,Thu,Fri,Sat', slots: '09:00-11:00,11:00-13:00,13:00-15:00,15:00-17:00' },
  { name: 'Maya Lopez', email: 'maya@fixmate.demo', phone: '+1-555-0102', cat: 'Plumber', skills: 'Pipes, Fittings, Leak detection', experience: '4 years', areas: 'Downtown, North Park', hours: '08:00 - 16:00', days: 'Mon,Tue,Wed,Thu,Fri', slots: '09:00-11:00,11:00-13:00,13:00-15:00,15:00-17:00,17:00-19:00' },
  { name: 'Daniel Okafor', email: 'daniel@fixmate.demo', phone: '+1-555-0103', cat: 'Car Mechanic', skills: 'Engine diagnostics, Batteries, Breaks', experience: '8 years', areas: 'Riverside, Old Town', hours: '09:00 - 18:00', days: 'Mon,Tue,Wed,Thu,Fri,Sat', slots: '09:00-11:00,11:00-13:00,13:00-15:00,15:00-17:00,17:00-19:00' },
  { name: 'Sara Chen', email: 'sara@fixmate.demo', phone: '+1-555-0104', cat: 'Carpenter', skills: 'Woodwork, Furniture, Doors', experience: '3 years', areas: 'North Park, Old Town', hours: '10:00 - 19:00', days: 'Wed,Thu,Fri,Sat,Sun', slots: '11:00-13:00,13:00-15:00,15:00-17:00,17:00-19:00' }
];

(async () => {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Demo customer
  let [u] = await db.query("SELECT id FROM users WHERE email='customer@fixmate.demo'");
  if (!u.length) await db.query("INSERT INTO users (name,email,phone,password_hash,role) VALUES ('Demo Customer','customer@fixmate.demo','+1-555-3000',?,'customer')", [hash]);
  else console.log('customer exists');

  // Technicians (+ availability)
  for (const t of TECHS) {
    [u] = await db.query('SELECT id FROM users WHERE email=?', [t.email]);
    let userId;
    if (u.length) { userId = u[0].id; }
    else {
      const [ins] = await db.query(
        "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'technician')",
        [t.name, t.email, t.phone, hash]);
      userId = ins.insertId;
    }
    const [cat] = await db.query('SELECT id FROM categories WHERE name=?', [t.cat]);
    let [th] = await db.query('SELECT id FROM technicians WHERE user_id=?', [userId]);
    if (!th.length) {
      const [r] = await db.query(
        "INSERT INTO technicians (user_id, category_id, skills, experience, areas, hours, status, verification, rating, completed_jobs) VALUES (?,?,?,?,?,?, 'active','verified',4.7,12)",
        [userId, cat[0].id, t.skills, t.experience, t.areas, t.hours]);
      await db.query('INSERT INTO technician_availability (technician_id, working_days, time_slots, break_start, break_end) VALUES (?,?,?, "13:00:00", "14:00:00")', [r.insertId, t.days, t.slots]);
    } else console.log(t.email, 'technician exists');
  }
  // ---- Demo bookings so the workflow is testable end-to-end ----
  const [cu] = await db.query("SELECT id FROM users WHERE email='customer@fixmate.demo'");
  const custId = cu[0].id;
  const [svc] = await db.query("SELECT id, base_price FROM services WHERE name='AC Service & Cleaning'");
  const [svcW] = await db.query("SELECT id, base_price FROM services WHERE name='Leak Repair'");
  const [techR] = await db.query("SELECT t.id AS id FROM technicians t JOIN users u ON u.id=t.user_id WHERE u.email='ravi@fixmate.demo'");
  const [techM] = await db.query("SELECT t.id AS id FROM technicians t JOIN users u ON u.id=t.user_id WHERE u.email='maya@fixmate.demo'");
  const today = new Date();
  const iso = (off) => { const d = new Date(today); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
  const n = new Date(); n.setHours(n.getHours() - 24);

  if (!await bookingExists('HSP-DEMO-0001')) {
    await db.query(
      `INSERT INTO bookings (id,user_id,service_id,technician_id,address,city,date,time_slot,notes,estimated_price,final_price,payment_status,status,created_at)
       VALUES ('HSP-DEMO-0001',?,?,?,?,?,?,?,'AC cooling poorly for a week.',?,?,'paid','Completed',?)`,
      [custId, svc[0].id, techR[0].id, '18 Elm Street, Apt 4B', 'Downtown', iso(-1), '11:00-13:00', svc[0].base_price, svc[0].base_price, n]);
    await db.query("INSERT INTO booking_status_history (booking_id,from_status,to_status,actor_label,note,created_at) VALUES ('HSP-DEMO-0001',NULL,'New / Pending','Demo Customer','Booking created',?)", [n]);
    await db.query("INSERT INTO booking_status_history (booking_id,from_status,to_status,actor_label,note,created_at) VALUES ('HSP-DEMO-0001','New / Pending','Assigned','Site Administrator','Assigned Ravi Kumar',?)", [n]);
    await db.query("INSERT INTO booking_status_history (booking_id,from_status,to_status,actor_label,note,created_at) VALUES ('HSP-DEMO-0001','Assigned','Accepted','Ravi Kumar','',?)", [n]);
    await db.query("INSERT INTO booking_status_history (booking_id,from_status,to_status,actor_label,note,created_at) VALUES ('HSP-DEMO-0001','In Progress','Completed','Ravi Kumar','Service done, filters replaced',?)", [n]);
    await db.query("INSERT INTO payments (booking_id,amount,method,status,paid_at) VALUES ('HSP-DEMO-0001',?,'demo (manual)','paid',NOW())", [svc[0].base_price]);
    await db.query("INSERT INTO reviews (booking_id,user_id,rating,comment) VALUES ('HSP-DEMO-0001',?,5,'Ravi arrived on time and the AC works like new. Excellent service!')", [custId]);
  }
  if (!await bookingExists('HSP-DEMO-0002')) {
    await db.query(
      `INSERT INTO bookings (id,user_id,service_id,technician_id,address,city,date,time_slot,notes,estimated_price,status,created_at)
       VALUES ('HSP-DEMO-0002',?,?,?,?,?,?,?,'Kitchen tap dripping constantly.',?,'In Progress',NOW())`,
      [custId, svcW[0].id, techM[0].id, '7 Riverside Drive', 'Riverside', iso(0), '15:00-17:00', svcW[0].base_price]);
    await db.query("INSERT INTO booking_status_history (booking_id,from_status,to_status,actor_label,note,created_at) VALUES ('HSP-DEMO-0002',NULL,'New / Pending','Demo Customer','Booking created',NOW())");
    await db.query("INSERT INTO booking_status_history (booking_id,from_status,to_status,actor_label,note,created_at) VALUES ('HSP-DEMO-0002','New / Pending','Assigned','Site Administrator','Assigned Maya Lopez',NOW())");
    await db.query("INSERT INTO booking_status_history (booking_id,from_status,to_status,actor_label,note,created_at) VALUES ('HSP-DEMO-0002','Assigned','Accepted','Maya Lopez','',NOW())");
    await db.query("INSERT INTO booking_status_history (booking_id,from_status,to_status,actor_label,note,created_at) VALUES ('HSP-DEMO-0002','Accepted','On the Way','Maya Lopez','',NOW())");
    await db.query("INSERT INTO booking_status_history (booking_id,from_status,to_status,actor_label,note,created_at) VALUES ('HSP-DEMO-0002','On the Way','In Progress','Maya Lopez','',NOW())");
    await db.query("INSERT INTO payments (booking_id,amount,status) VALUES ('HSP-DEMO-0002',?,'pending')", [svcW[0].base_price]);
  }
  if (!await bookingExists('HSP-DEMO-0003')) {
    await db.query(
      `INSERT INTO bookings (id,user_id,service_id,technician_id,address,city,date,time_slot,notes,estimated_price,status,created_at)
       VALUES ('HSP-DEMO-0003',?,?,NULL,'220 North Park Ave','North Park',?,?,'Sedan, exterior + interior vacuum.',?,'New / Pending',NOW())`,
      [custId, (await db.query("SELECT id FROM services WHERE name='Doorstep Car Wash'"))[0][0].id, iso(1), '09:00-11:00', 20]);
    await db.query("INSERT INTO booking_status_history (booking_id,from_status,to_status,actor_label,note,created_at) VALUES ('HSP-DEMO-0003',NULL,'New / Pending','Demo Customer','Booking created',NOW())");
  }

  console.log('Demo users + demo bookings ready. Password for all demo users:', DEMO_PASSWORD);
  process.exit(0);

  async function bookingExists(id) {
    const [r] = await db.query('SELECT id FROM bookings WHERE id=?', [id]);
    return r.length > 0;
  }
})().catch(e => { console.error(e); process.exit(1); });
