const crypto = require('crypto');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Protects write actions (upload, delete, retrain).
module.exports = function adminAuth(req, res, next) {
  const key = process.env.ADMIN_KEY;

  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Admin actions are disabled: ADMIN_KEY is not configured.' });
    }
    return next(); // local development: no key needed
  }

  if (safeEqual(req.header('x-admin-key') || '', key)) return next();
  return res.status(401).json({ error: 'Admin key required or incorrect.' });
};
