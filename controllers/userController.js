const { User } = require('../models');
const generateUniqueUsername = require('../utils/usernameGenerator');
const pwd = require('../utils/passwordHashing');
const { sendMail } = require('../utils/mailer');
const { userCredentialsTemplate } = require('../utils/userEmailTemplates');

// Generate random password
const generateRandomPassword = (length = 12) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Create new user (Admin only)
exports.createUser = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone_no,
      dob,
      designation,
      department,
      role_name = 'user',
      usertype,
      address1,
      address2,
      country,
      state,
      city,
      pincode,
      permanent_address1,
      permanent_address2,
      permanent_country,
      permanent_state,
      permanent_city,
      permanent_pincode,
      is_active = true
    } = req.body;

    // Validation
    if (!first_name || !email) {
      return res.status(400).json({ message: 'First name and email are required' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Generate username and password
    const username = await generateUniqueUsername(first_name, last_name);
    const tempPassword = generateRandomPassword();

    // Create user
    const newUser = await User.create({
      username,
      first_name,
      last_name,
      email,
      phone_no,
      dob,
      designation,
      department,
      password_hash: tempPassword,
      role_name,
      usertype,
      address1,
      address2,
      country,
      state,
      city,
      pincode,
      permanent_address1,
      permanent_address2,
      permanent_country,
      permanent_state,
      permanent_city,
      permanent_pincode,
      is_active,
      registration_date: new Date(),
    });

    // Send email with credentials
    try {
      const emailData = userCredentialsTemplate({
        user: { ...newUser.toJSON(), is_new: true },
        password: tempPassword
      });

      await sendMail({
        to: email,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text
      });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Don't fail the request if email fails, just log it
    }

    return res.status(201).json({
      message: 'User created successfully. Credentials sent to email.',
      user: {
        user_id: newUser.user_id,
        username: newUser.username,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role_name: newUser.role_name,
        is_active: newUser.is_active
      },
    });
  } catch (err) {
    console.error('Create user error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Update user (Admin only)
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      email,
      phone_no,
      dob,
      designation,
      department,
      role_name,
      usertype,
      address1,
      address2,
      country,
      state,
      city,
      pincode,
      permanent_address1,
      permanent_address2,
      permanent_country,
      permanent_state,
      permanent_city,
      permanent_pincode,
      is_active,
      reset_password = false
    } = req.body;

    // Find user
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }
    }

    let newPassword = null;
    let updateData = {
      first_name,
      last_name,
      email,
      phone_no,
      dob,
      designation,
      department,
      role_name,
      usertype,
      address1,
      address2,
      country,
      state,
      city,
      pincode,
      permanent_address1,
      permanent_address2,
      permanent_country,
      permanent_state,
      permanent_city,
      permanent_pincode,
      is_active
    };

    // Reset password if requested
    if (reset_password) {
      newPassword = generateRandomPassword();
      updateData.password_hash = newPassword;
    }

    // Update user
    await user.update(updateData);

    // Send email if password was reset
    if (reset_password && newPassword) {
      try {
        const emailData = userCredentialsTemplate({
          user: { ...user.toJSON(), is_new: false },
          password: newPassword
        });

        await sendMail({
          to: user.email,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text
        });
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }
    }

    return res.json({
      message: reset_password && newPassword 
        ? 'User updated successfully. New credentials sent to email.' 
        : 'User updated successfully.',
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role_name: user.role_name,
        is_active: user.is_active
      },
    });
  } catch (err) {
    console.error('Update user error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        'user_id', 'username', 'email', 'first_name', 'last_name', 
        'phone_no', 'dob', 'designation', 'department', 'role_name',
        'is_active', 'registration_date', 'last_login_date'
      ],
      order: [['user_id', 'ASC']]
    });

    return res.json(users);
  } catch (err) {
    console.error('Get users error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      attributes: [
        'user_id', 'username', 'email', 'first_name', 'last_name', 
        'phone_no', 'dob', 'designation', 'department', 'role_name',
        'is_active', 'registration_date', 'last_login_date',
        'address1', 'address2', 'country', 'state', 'city', 'pincode',
        'permanent_address1', 'permanent_address2', 'permanent_country', 
        'permanent_state', 'permanent_city', 'permanent_pincode'
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user);
  } catch (err) {
    console.error('Get user error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete user (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.destroy();
    return res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};