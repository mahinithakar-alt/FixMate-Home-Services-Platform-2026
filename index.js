// Centralized express-validator chains.
const { body } = require('express-validator');

const register = [
  body('name').trim().notEmpty().withMessage('Name is required.').isLength({ max: 120 }),
  body('email').trim().isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('phone').matches(/^\+?[0-9][0-9\s\-()]{6,17}$/).withMessage('Enter a valid phone number.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
];

const login = [
  body('email').trim().isEmail().withMessage('Enter a valid email address.'),
  body('password').notEmpty().withMessage('Password is required.')
];

const dateFuture = (value) => {
  const d = new Date(value + 'T00:00:00'); const t = new Date(); t.setHours(0, 0, 0, 0);
  if (isNaN(d) || d < t) throw new Error('Choose a date not in the past.');
  return true;
};

const SLOT_RE = /^\d{2}:\d{2}-\d{2}:\d{2}$/;

const createBooking = [
  body('serviceId').isInt({ min: 1 }).withMessage('Choose a service.'),
  body('address').trim().notEmpty().withMessage('Service address is required.').isLength({ max: 255 }),
  body('city').trim().notEmpty().withMessage('City/area is required.').isLength({ max: 80 }),
  body('date').custom(dateFuture),
  body('timeSlot').matches(SLOT_RE).withMessage('Choose a valid time slot (HH:MM-HH:MM).'),
  body('notes').trim().notEmpty().withMessage('Problem description is required.').isLength({ max: 1000 }),
  body('image').optional({ values: 'null' }).isLength({ max: 3000000 }).withMessage('Image payload too large.')
];

const statusUpdate = [
  body('status').trim().notEmpty().withMessage('New status is required.'),
  body('note').optional().trim().isLength({ max: 500 })
];

const categoryBody = [
  body('name').trim().notEmpty().withMessage('Category name is required.').isLength({ max: 80 }),
  body('description').trim().notEmpty().withMessage('Description is required.').isLength({ max: 255 }),
  body('icon').optional().trim().isLength({ max: 60 })
];

const serviceBody = [
  body('categoryId').isInt({ min: 1 }).withMessage('Choose a category.'),
  body('name').trim().notEmpty().withMessage('Service name is required.').isLength({ max: 120 }),
  body('description').trim().notEmpty().withMessage('Description is required.').isLength({ max: 500 }),
  body('pricingType').isIn(['fixed', 'quote']).withMessage('Pricing type must be fixed or quote.'),
  body('basePrice').custom((v, { req }) => {
    if (req.body.pricingType === 'quote') return true;
    if (isNaN(Number(v)) || Number(v) < 0) throw new Error('Base price must be a non-negative number.');
    return true;
  }),
  body('duration').optional().trim().isLength({ max: 40 })
];

const reviewBody = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5.'),
  body('comment').trim().notEmpty().withMessage('Comment is required.').isLength({ max: 1000 })
];

module.exports = { register, login, createBooking, statusUpdate, categoryBody, serviceBody, reviewBody };
