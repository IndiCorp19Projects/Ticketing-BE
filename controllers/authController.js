const jwt = require('jsonwebtoken');
const { User } = require('../models');
const generateUniqueUsername = require('../utils/usernameGenerator');
const pwd = require('../utils/passwordHashing');
const { jwtSecret } = require('../config/config');
const { Op } = require('sequelize');

exports.signup = async (req, res) => {
  try {
    const { first_name, last_name, email, password, role_name = 'user', usertype } = req.body;

    if (!first_name || !email || !password) {
      return res.status(400).json({ message: 'first_name, email and password are required' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const username = await generateUniqueUsername(first_name, last_name);

    const newUser = await User.create({
      username,
      first_name,
      last_name,
      email,
      password_hash: password, // hashed by model hooks
      role_name,
      usertype,
      registration_date: new Date(),
      is_active: true,
    });

    return res.status(201).json({
      message: 'Signup successful',
      user: {
        id: newUser.user_id,
        username: newUser.username,
        email: newUser.email,
        role_name: newUser.role_name,
      },
    });
  } catch (err) {
    console.error('Signup error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await pwd.verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.user_id, role_name: user.role_name, username: user.username },
    jwtSecret,
    { expiresIn: '8h' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true in prod (HTTPS), false in dev
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });

  // return user info (no token)
  return res.json({ user: { id: user.user_id, email: user.email, username: user.username, role_name: user.role_name }});
};


exports.logout = (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'Logged out' });
};


exports.me = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });
    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findByPk(payload.id, { attributes: ['user_id','username','email','role_name']});
    if (!user) return res.status(401).json({ message: 'Not authenticated' });
    return res.json({ user: { id: user.user_id, username: user.username, email: user.email, role: user.role_name }});
  } catch (err) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
};


exports.getExecutives = async (req, res) => {
  try {
    const executives = await User.findAll({
      // where: { role_name: 'executive' },
        where:{role_name: {
          [Op.or]: ['executive', 'admin'],
        }},
      attributes: ['user_id', 'username', 'email', 'role_name'],
    });

    if (!executives.length) {
      return res.status(404).json({ message: 'No executives found' });
    }

    return res.json(executives);
  } catch (err) {
    console.error('Error fetching executives', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


