module.exports = function adminAuth(req, res, next) {
  const key = process.env.ADMIN_KEY;
  if (!key) return next();
  if (req.header('x-admin-key') === key) return next();
  return res.status(401).json({ error: 'Admin key required or incorrect.' });
};