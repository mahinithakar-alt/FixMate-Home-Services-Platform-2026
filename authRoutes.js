// Auth routes
const router = require('express').Router();
const { check } = require('express-validator');
const auth = require('../controllers/authController');
const v = require('../validators');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.post('/register', v.register, validate, auth.register);
router.post('/login', v.login, validate, auth.login);
router.get('/me', authenticate, auth.me);
router.post('/logout', auth.logout);

module.exports = router;
