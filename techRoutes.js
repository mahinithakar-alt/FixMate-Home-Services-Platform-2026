// Technician routes — scoped to the token's own technicianId.
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const t = require('../controllers/techController');

router.use(authenticate, authorize('technician'));
router.get('/profile', t.getProfile);
router.get('/dashboard', t.dashboard);
router.get('/jobs', t.assignedJobs);
router.get('/jobs/:id', t.jobDetails);
router.post('/jobs/:id/status', t.updateJobStatus);
router.post('/jobs/:id/quote', t.submitQuote);
router.post('/jobs/:id/note', t.addJobNote);
router.get('/history', t.history);
router.get('/earnings', t.earnings);
router.get('/availability', t.getAvailability);
router.put('/availability', t.updateAvailability);
router.put('/profile', t.updateProfile);

module.exports = router;
