const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.role_name) return res.status(401).json({ message: 'Unauthorized' });
  if (req.user.role_name !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

module.exports = { requireAdmin };
