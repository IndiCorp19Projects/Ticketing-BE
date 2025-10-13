// middleware/apiKeyAuth.js - UPDATED
const { SystemRegistration, User } = require('../models');
const { hashApiKey } = require('../utils/apiKeyGenerator');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/config');

const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    // If no API key, check for existing session (cookie)
    if (!apiKey) {
      return next(); // Continue to cookie authentication
    }

    const hashedApiKey = hashApiKey(apiKey);
    
    // Find active system with this API key
    const system = await SystemRegistration.findOne({
      where: { 
        api_key: hashedApiKey,
        is_active: true
      },
      include: [
        {
          model: User,
          as: 'system_user',
          attributes: ['user_id', 'username', 'email', 'role_name', 'first_name', 'last_name']
        }
      ]
    });

    if (!system) {
      return res.status(401).json({ message: 'Invalid API key' });
    }

    // Set user in request (using the SYSTEM USER account)
    req.user = {
      id: system.system_user.user_id,
      user_id: system.system_user.user_id,
      username: system.system_user.username,
      email: system.system_user.email,
      role_name: system.system_user.role_name,
      system_id: system.system_id,
      is_system: true
    };

    next();
  } catch (err) {
    console.error('API key auth error:', err);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

// Combined middleware: first try API key, then try cookie
const authenticateUserOrSystem = async (req, res, next) => {
  // First try API key authentication
  await authenticateApiKey(req, res, () => {
    // If API key didn't set req.user, try cookie authentication
    if (!req.user) {
      const token = req.cookies?.token;
      if (token) {
        try {
          const decoded = jwt.verify(token, jwtSecret);
          req.user = decoded;
        } catch (err) {
          // Invalid token, continue without user
        }
      }
    }
    next();
  });
};

module.exports = {
  authenticateApiKey,
  authenticateUserOrSystem
};