// FixMate backend entry point — serves the API and the existing static frontend.
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(helmet({ contentSecurityPolicy: false })); // frontend uses CDN assets + inline page scripts
app.use(cors({
  origin: (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(s => s.trim()),
}));
app.use(express.json({ limit: '5mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true }));

// Existing frontend is served by the same origin (no CORS needed in default setup)
app.use(express.static(path.join(__dirname, '..')));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api', require('./routes/catalogRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/tech', require('./routes/techRoutes'));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'fixmate-api' }));

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => console.log(`FixMate API + frontend running at http://localhost:${port}`));
}
module.exports = app;
