// Catalog routes: public category/service reads + admin CRUD + public settings.
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const cat = require('../controllers/catalogController');
const admin = require('../controllers/adminController');
const v = require('../validators');
const validate = require('../middleware/validate');

// Public
router.get('/categories', cat.listCategories);
router.get('/services', cat.listServices);
router.get('/settings', admin.getSettings);
router.get('/reviews', cat.publicReviews);

// Admin CRUD
router.post('/admin/categories', authenticate, authorize('admin'), v.categoryBody, validate, cat.createCategory);
router.put('/admin/categories/:id', authenticate, authorize('admin'), v.categoryBody, validate, cat.updateCategory);
router.delete('/admin/categories/:id', authenticate, authorize('admin'), cat.deleteCategory);
router.post('/admin/services', authenticate, authorize('admin'), v.serviceBody, validate, cat.createService);
router.put('/admin/services/:id', authenticate, authorize('admin'), v.serviceBody, validate, cat.updateService);
router.delete('/admin/services/:id', authenticate, authorize('admin'), cat.deleteService);
router.put('/admin/settings', authenticate, authorize('admin'), admin.updateSettings);

module.exports = router;
