// controllers/clientAuthController.js
const jwt = require('jsonwebtoken');
const { Client } = require('../models');
const pwd = require('../utils/passwordHashing');
const { jwtSecret } = require('../config/config');

exports.register = async (req, res) => {
  try {
    const { company_name, contact_person, email, password, phone, address } = req.body;

    if (!company_name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Company name, email and password are required' 
      });
    }

    const existing = await Client.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ 
        success: false,
        message: 'Email already registered' 
      });
    }

    const newClient = await Client.create({
      company_name,
      contact_person,
      email,
      password_hash: password,
      phone,
      address,
      is_active: true,
      registration_date: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: 'Client registration successful',
      client: {
        client_id: newClient.client_id,
        company_name: newClient.company_name,
        contact_person: newClient.contact_person,
        email: newClient.email,
      },
    });
  } catch (err) {
    console.error('Client registration error', err);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

exports.login = async (req, res) => {
  const { 
    tt_email,
    tt_id,
    user_id,
    email,
    role,
    first_name,
    username 
  } = req.body;

  try {
    const client = await Client.findOne({ 
      where: { 
        email: tt_email, 
        client_id: tt_id, 
        is_active: true 
      } 
    });
    
    if (!client) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid client credentials' 
      });
    }

    // Update last login
    await client.update({ last_login_date: new Date() });

    // Enhanced token with client user information
    const tokenPayload = {
      // Client identification
      tt_email: tt_email,
      client_id: tt_id,
      type: 'client',
      
      // Client user information from external system
      user_id: user_id,
      email: email,
      role: role,
      first_name: first_name,
      username: username,
      
      // Timestamp for security
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
    };

    const token = jwt.sign(tokenPayload, jwtSecret);

    // Set cookie
    res.cookie('client_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    return res.json({
      success: true, 
      token,
      client_user: {
        id: user_id,
        name: first_name || username,
        email: email,
        role: role
      }
    });
  } catch (err) {
    console.error('Client login error', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};




exports.logout = (req, res) => {
  res.clearCookie('client_token', { 
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ 
    success: true,
    message: 'Logged out successfully' 
  });
};