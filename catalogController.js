// Categories & services: public reads + admin CRUD.
const db = require('../config/db');
const { HttpError } = require('../middleware/errorHandler');

async function listCategories(req, res) {
  const all = req.query.all === '1' && req.user && req.user.role === 'admin';
  const [rows] = await db.query(
    `SELECT c.*, (SELECT COUNT(*) FROM services s WHERE s.category_id = c.id) AS services_count
     FROM categories c` + (all ? '' : ' WHERE c.active = 1') + ' ORDER BY c.name');
  res.json({ categories: rows });
}

async function createCategory(req, res) {
  const { name, description, icon, active } = req.body;
  const [r] = await db.query('INSERT INTO categories (name, description, icon, active) VALUES (?,?,?,?)',
    [name, description, icon || 'bi-tools', active === false ? 0 : 1]);
  res.status(201).json({ category: { id: r.insertId, name, description, icon: icon || 'bi-tools' } });
}

async function updateCategory(req, res) {
  const c = req.body;
  const [r] = await db.query(
    'UPDATE categories SET name=?, description=?, icon=?, active=? WHERE id=?',
    [c.name, c.description, c.icon || 'bi-tools', c.active ? 1 : 0, req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Category not found.');
  res.json({ message: 'Category updated.' });
}

async function deleteCategory(req, res) {
  const [r] = await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Category not found.');
  res.json({ message: 'Category and its services deleted.' });
}

// Public, moderated-visible reviews for the customer website.
async function publicReviews(req, res) {
  const [rows] = await db.query(
    `SELECT r.rating, r.comment, u.name AS author, r.created_at
     FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.moderated = 'visible' ORDER BY r.created_at DESC LIMIT 12`);
  res.json({ reviews: rows, note: 'sample customer reviews' });
}

async function listServices(req, res) {
  const where = [], params = [];
  if (!(req.user && req.user.role === 'admin' && req.query.all === '1')) where.push('s.active = 1 AND c.active = 1');
  if (req.query.category) { where.push('s.category_id = ?'); params.push(req.query.category); }
  if (req.query.search) { where.push('(s.name LIKE ? OR s.description LIKE ?)'); params.push('%' + req.query.search + '%', '%' + req.query.search + '%'); }
  const [rows] = await db.query(
    `SELECT s.*, c.name AS category_name, c.icon AS category_icon
     FROM services s JOIN categories c ON c.id = s.category_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.name, s.name`, params);
  res.json({ services: rows });
}

async function createService(req, res) {
  const s = req.body;
  const [cat] = await db.query('SELECT id FROM categories WHERE id = ?', [s.category_id]);
  if (!cat.length) throw new HttpError(422, 'Category does not exist.');
  const [r] = await db.query(
    `INSERT INTO services (category_id, name, description, base_price, pricing_type, duration, skills, active)
     VALUES (?,?,?,?,?,?,?,?)`,
    [s.category_id, s.name, s.description, s.pricing_type === 'quote' ? 0 : s.base_price, s.pricing_type, s.duration || '1-2 hours', s.skills || '', s.active === false ? 0 : 1]);
  res.status(201).json({ service: { id: r.insertId, ...s } });
}

async function updateService(req, res) {
  const s = req.body;
  const [r] = await db.query(
    `UPDATE services SET category_id=?, name=?, description=?, base_price=?, pricing_type=?, duration=?, skills=?, active=?
     WHERE id=?`,
    [s.category_id, s.name, s.description, s.pricing_type === 'quote' ? 0 : s.base_price, s.pricing_type, s.duration, s.skills || '', s.active ? 1 : 0, req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Service not found.');
  res.json({ message: 'Service updated.' });
}

async function deleteService(req, res) {
  const [r] = await db.query('DELETE FROM services WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Service not found.');
  res.json({ message: 'Service deleted. Past bookings keep their records.' });
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory, listServices, createService, updateService, deleteService, publicReviews };
