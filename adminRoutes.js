// Super Admin routes — all protected by role authorization.
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const a = require('../controllers/adminController');

router.use(authenticate, authorize('admin'));
router.get('/dashboard', a.dashboard);
router.get('/bookings', a.listBookings);
router.post('/bookings/:id/assign', a.assignTechnician);
router.post('/bookings/:id/status', a.updateStatus);
router.post('/bookings/:id/reschedule', a.reschedule);
router.get('/technicians', a.listTechnicians);
router.post('/technicians', a.createTechnician);
router.put('/technicians/:id', a.updateTechnician);
router.delete('/technicians/:id', a.deleteTechnician);
router.get('/payments', a.payments);
router.put('/payments/:id', a.updatePayment);
router.get('/reviews', a.reviews);
router.put('/reviews/:id', a.moderateReview);
router.get('/reports', a.reports);

module.exports = router;
