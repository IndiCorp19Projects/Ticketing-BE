const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/config');

// Middleware to verify token
const authClientMiddleware = (req, res, next) => {
  try {
    // 1️⃣ Get token from headers or cookies
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // 2️⃣ Verify the token
    const decoded = jwt.verify(token, jwtSecret);

    // 3️⃣ Attach user info to request object
    req.user = decoded; // contains email, client_id, user_id, role, etc.

    // 4️⃣ Continue to the next middleware/route
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

module.exports = authClientMiddleware;
