

// middleware/clientAuth.js - UPDATED
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/config');
const { Client } = require('../models');

module.exports = async (req, res, next) => {
  try {
    // Get token from various sources
    const token = req.cookies?.client_token ||
      req.headers.authorization?.replace('Bearer ', '') ||
      req.headers['x-access-token'];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Client authentication required'
      });
    }

    const decoded = jwt.verify(token, jwtSecret);

    console.log('Decoded Token:', decoded);

    // Verify client exists and is active
    const client = await Client.findOne({
      where: { client_id: decoded.client_id, email: decoded.tt_email },
      attributes: ['client_id', 'company_name', 'contact_person', 'email', 'is_active']
    });

    if (!client || !client.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Client not found or inactive'
      });
    }

    // Set client information
    req.client = {
      id: client.client_id,
      client_id: client.client_id,
      company_name: client.company_name,
      email: client.email,
      type: 'client'
    };

    // ✅ FIXED: Ensure client_user_role is either 'admin' or 'user'
    let clientUserRole = 'user'; // Default to 'user'

    if (decoded.role) {
      // Normalize the role value
      const normalizedRole = String(decoded.role).toLowerCase().trim();

      if (normalizedRole === 'admin' || normalizedRole === 'administrator' || normalizedRole === 'superadmin') {
        clientUserRole = 'admin';
      } else {
        clientUserRole = 'user';
      }
    }

    // Extract client user information from token
    if (decoded.user_id && decoded.email) {
      req.client_user = {
        id: decoded.user_id.toString(),
        client_id: client.client_id,
        name: decoded.first_name || decoded.username || client.company_name,
        email: decoded.email,
        role: clientUserRole // Use the normalized role
      };

      console.log(`Client user authenticated: ${req.client_user.name} (${req.client_user.role})`);
    } else {
      // Fallback: if no user info in token, treat as client admin
      req.client_user = {
        client_id: client.client_id,
        id: client.client_id.toString(),
        name: client.company_name,
        email: client.email,
        role: 'admin'
      };
    }

    next();
  } catch (err) {
    console.error('Client auth middleware error:', err);
    return res.status(401).json({
      success: false,
      message: 'Invalid client token'
    });
  }
};