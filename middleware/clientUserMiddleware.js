// middleware/clientUserMiddleware.js
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/config');

module.exports = (req, res, next) => {
  try {
    // Extract client user info from headers (sent by client application)
    const clientUserId = req.headers['x-client-user-id'];
    const clientUserName = req.headers['x-client-user-name'];
    const clientUserEmail = req.headers['x-client-user-email'];
    const clientUserRole = req.headers['x-client-user-role'] || 'user';

    // If client user info is provided, validate and add to request
    if (clientUserId && clientUserName && clientUserEmail) {
      
      // Validate role
      if (!['admin', 'user'].includes(clientUserRole)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid client user role. Must be "admin" or "user"'
        });
      }

      req.client_user = {
        id: clientUserId,
        name: clientUserName,
        email: clientUserEmail,
        role: clientUserRole
      };
      
      console.log(`Client user authenticated: ${clientUserName} (${clientUserRole})`);
    } else {
      // If no client user info, set default based on client
      req.client_user = {
        id: req.client.id,
        name: req.client.company_name,
        email: req.client.email,
        role: 'admin' // Default to admin for backward compatibility
      };
    }

    next();
  } catch (err) {
    console.error('Client user middleware error:', err);
    next();
  }
};