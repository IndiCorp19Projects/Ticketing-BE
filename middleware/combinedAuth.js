// middleware/combinedAuth.js
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/config');
const { User, Client } = require('../models');

module.exports = async (req, res, next) => {
  try {
    // Clear any previous authentication
    req.user = null;
    req.client = null;

    // Try user token first
    const userToken = req.cookies?.token;
    if (userToken) {
      try {
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
          console.log(`User authenticated: ${user.username} (ID: ${user.user_id})`);
          return next();
        }
      } catch (userErr) {
        console.log('User token invalid, trying client token...');
      }
    }

    // Try client token
    const clientToken = req.cookies?.client_token;
    if (clientToken) {
      try {
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
              contact_person: client.contact_person,
              email: client.email,
              type: 'client'
            };
            console.log(`Client authenticated: ${client.company_name} (ID: ${client.client_id})`);
            return next();
          }
        }
      } catch (clientErr) {
        console.log('Client token invalid');
      }
    }

    return res.status(401).json({ message: 'Authentication required' });
    
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(401).json({ message: 'Authentication failed' });
  }
};