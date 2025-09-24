const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/config');

module.exports = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded; // id, role_name, username
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
