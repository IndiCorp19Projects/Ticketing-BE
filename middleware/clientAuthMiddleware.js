const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/config');
const { Client } = require('../models');

module.exports = async (req, res, next) => {
  try {
    const token = req.cookies?.client_token;
    
    if (!token) {
      return res.status(401).json({ message: 'Client authentication required' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    
    if (decoded.type !== 'client') {
      return res.status(401).json({ message: 'Invalid client token' });
    }

    const client = await Client.findByPk(decoded.id, {
      attributes: ['client_id', 'company_name', 'contact_person', 'email', 'is_active']
    });

    if (!client || !client.is_active) {
      return res.status(401).json({ message: 'Client not found or inactive' });
    }

    req.client = {
      id: client.client_id,
      client_id: client.client_id,
      company_name: client.company_name,
      email: client.email,
      type: 'client'
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid client token' });
  }
};