const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/config');
const { User, Client } = require('../models');

// This middleware will try to authenticate either user or client
module.exports = async (req, res, next) => {
  try {
    // Try user token first
    const userToken = req.cookies?.token;
    if (userToken) {
      const decoded = jwt.verify(userToken, jwtSecret);
      const user = await User.findByPk(decoded.id, {
        attributes: ['user_id', 'username', 'email', 'role_name', 'is_active']
      });

      if (user && user.is_active) {
        req.user = {
          id: user.user_id,
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          role_name: user.role_name,
          type: 'user'
        };
        return next();
      }
    }

    // Try client token
    const clientToken = req.cookies?.client_token;
    if (clientToken) {
      const decoded = jwt.verify(clientToken, jwtSecret);
      if (decoded.type === 'client') {
        const client = await Client.findByPk(decoded.id, {
          attributes: ['client_id', 'company_name', 'contact_person', 'email', 'is_active']
        });

        if (client && client.is_active) {
          req.client = {
            id: client.client_id,
            client_id: client.client_id,
            company_name: client.company_name,
            email: client.email,
            type: 'client'
          };
          return next();
        }
      }
    }

    // If neither token is valid
    return res.status(401).json({ message: 'Authentication required' });
    
  } catch (err) {
    return res.status(401).json({ message: 'Authentication required' });
  }
};