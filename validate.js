// Runs express-validator chains and returns a clean 422 with messages.
const { validationResult } = require('express-validator');
module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: { message: errors.array()[0].msg, details: errors.array() } });
  }
  next();
};
