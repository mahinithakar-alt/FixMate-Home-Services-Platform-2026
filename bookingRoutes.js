// Customer booking routes (JWT required; ownership enforced in controller).
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/bookingController');
const v = require('../validators');
const validate = require('../middleware/validate');

router.use(authenticate);
router.get('/', authorize('customer'), c.myBookings);
router.post('/', authorize('customer'), v.createBooking, validate, c.create);
router.get('/:id', c.getById);
router.post('/:id/cancel', authorize('customer'), c.cancel);
router.post('/:id/review', authorize('customer'), v.reviewBody, validate, c.submitReview);

module.exports = router;
