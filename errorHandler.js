// Centralized error handler — hides internals, returns meaningful JSON.
function notFound(req, res) {
  res.status(404).json({ error: { message: 'Endpoint not found.' } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.code === 'EBADCSRFTOKEN') { /* not used */ }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'Payload too large (max 5 MB).' } });
  }
  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: { message: 'A record with the same unique value already exists.' } });
  }
  if (err && err.code && err.code.startsWith('ER_')) {
    console.error('[DB]', err.code, err.sqlMessage);
    return res.status(500).json({ error: { message: 'A database error occurred. Please try again.' } });
  }
  if (err) console.error('[ERROR]', err);
  res.status(err && err.status ? err.status : 500)
    .json({ error: { message: (err && err.message) || 'Internal server error.' } });
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

module.exports = { notFound, errorHandler, HttpError };
