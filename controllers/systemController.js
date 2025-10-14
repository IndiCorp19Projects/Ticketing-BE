// controllers/systemController.js - UPDATED WITH EMAIL
// const { SystemRegistration, User } = require('../models');
// const generateUniqueUsername = require('../utils/usernameGenerator');
// const pwd = require('../utils/passwordHashing');
// const { sendMail } = require('../utils/mailer');
// const { systemCredentialsTemplate } = require('../utils/systemEmailTemplates');

// // Generate random password (same as user registration)
// const generateRandomPassword = (length = 12) => {
//   const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
//   let password = '';
//   for (let i = 0; i < length; i++) {
//     password += charset.charAt(Math.floor(Math.random() * charset.length));
//   }
//   return password;
// };

// Admin registers a new system
// exports.registerSystem = async (req, res) => {
//   try {
//     const { system_name, description, contact_email } = req.body;

//     if (!system_name || !contact_email) {
//       return res.status(400).json({ message: 'System name and contact email are required' });
//     }

//     // Validate email format
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(contact_email)) {
//       return res.status(400).json({ message: 'Invalid contact email format' });
//     }

//     // Check if user is admin
//     if (!req.user || req.user.role_name !== 'admin') {
//       return res.status(403).json({ message: 'Only admin can register systems' });
//     }

//     // Check if system name already exists
//     const existingSystem = await SystemRegistration.findOne({
//       where: { system_name }
//     });

//     if (existingSystem) {
//       return res.status(400).json({ message: 'System name already exists' });
//     }

//     // Generate unique username for the system user
//     const systemUsername = await generateUniqueUsername(system_name, 'system');
//     const tempPassword = generateRandomPassword();

//     // Create a dedicated user account for this system
//     const systemUser = await User.create({
//       username: systemUsername,
//       first_name: system_name,
//       last_name: 'System',
//       email: `${systemUsername}@system.local`, // Internal system email
//       password_hash: tempPassword, // Will be hashed by model hook
//       role_name: 'system',
//       usertype: 'system',
//       is_active: true,
//       registration_date: new Date(),
//     });

//     // Create system registration
//     const system = await SystemRegistration.create({
//       system_name,
//       description,
//       contact_email, // Store the external contact email
//       system_user_id: systemUser.user_id,
//       created_by: req.user.id,
//       is_active: true
//     });

//     // Send email with credentials to the contact email
//     let emailSent = false;
//     try {
//       const emailData = systemCredentialsTemplate({
//         system: {
//           system_id: system.system_id,
//           system_name: system.system_name,
//           description: system.description,
//           system_user: {
//             email: systemUser.email,
//             role_name: systemUser.role_name
//           }
//         },
//         password: tempPassword,
//         adminName: req.user.username || 'Admin'
//       });

//       const mailResult = await sendMail({
//         to: contact_email,
//         subject: emailData.subject,
//         html: emailData.html,
//         text: emailData.text
//       });

//       emailSent = !mailResult.error;

//     } catch (emailError) {
//       console.error('Failed to send system credentials email:', emailError);
//       // Don't fail the request if email fails
//     }

//     // Prepare response
//     const response = {
//       message: 'System registered successfully' + (emailSent ? ' and credentials sent to email.' : '.'),
//       system: {
//         system_id: system.system_id,
//         system_name: system.system_name,
//         description: system.description,
//         contact_email: system.contact_email,
//         system_user: {
//           user_id: systemUser.user_id,
//           username: systemUser.username,
//           email: systemUser.email, // This is the login email
//           role_name: systemUser.role_name
//         },
//         created_on: system.created_on
//       }
//     };

//     // Only include temp password in response if email failed
//     if (!emailSent) {
//       response.system.system_user.temp_password = tempPassword;
//       response.warning = 'Email delivery failed. Save these credentials securely.';
//     }

//     return res.status(201).json(response);

//   } catch (err) {
//     console.error('registerSystem error:', err);
//     return res.status(500).json({ message: 'Internal server error' });
//   }
// };



// controllers/systemController.js - UPDATED
const { SystemRegistration, User } = require('../models');
const generateUniqueUsername = require('../utils/usernameGenerator');
const pwd = require('../utils/passwordHashing');
const { sendMail } = require('../utils/mailer');
const { systemCredentialsTemplate } = require('../utils/systemEmailTemplates');

// Generate random password
const generateRandomPassword = (length = 12) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Admin registers a new system
exports.registerSystem = async (req, res) => {
  try {
    const { system_name, description, contact_email } = req.body;
    
    if (!system_name || !contact_email) {
      return res.status(400).json({ message: 'System name and contact email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      return res.status(400).json({ message: 'Invalid contact email format' });
    }

    // Check if user is admin
    if (!req.user || req.user.role_name !== 'admin') {
      return res.status(403).json({ message: 'Only admin can register systems' });
    }

    // Check if system name already exists
    const existingSystem = await SystemRegistration.findOne({ 
      where: { system_name } 
    });
    
    if (existingSystem) {
      return res.status(400).json({ message: 'System name already exists' });
    }

    // Check if email already exists in User table
    const existingUser = await User.findOne({ where: { email: contact_email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered as a user' });
    }

    // Generate unique username for the system user
    const systemUsername = await generateUniqueUsername(system_name, 'system');
    const tempPassword = generateRandomPassword();
    
    // Create a dedicated user account for this system USING THE ACTUAL CONTACT EMAIL
    const systemUser = await User.create({
      username: systemUsername,
      first_name: system_name,
      last_name: 'System',
      email: contact_email, // ✅ Use the actual contact email for login
      password_hash: tempPassword, // Will be hashed by model hook
      role_name: 'system',
      usertype: 'system',
      is_active: true,
      registration_date: new Date(),
    });

    // Create system registration
    const system = await SystemRegistration.create({
      system_name,
      description,
      contact_email,
      system_user_id: systemUser.user_id,
      created_by: req.user.id,
      is_active: true
    });

    // Send email with credentials to the contact email
    let emailSent = false;
    try {
      const emailData = systemCredentialsTemplate({
        system: {
          system_id: system.system_id,
          system_name: system.system_name,
          description: system.description,
          system_user: {
            email: systemUser.email, // This is now the actual contact email
            role_name: systemUser.role_name
          }
        },
        password: tempPassword,
        adminName: req.user.username || 'Admin'
      });

      const mailResult = await sendMail({
        to: contact_email,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text
      });

      emailSent = !mailResult.error;
      
    } catch (emailError) {
      console.error('Failed to send system credentials email:', emailError);
    }

    // Prepare response
    const response = {
      message: 'System registered successfully' + (emailSent ? ' and credentials sent to email.' : '.'),
      system: {
        system_id: system.system_id,
        system_name: system.system_name,
        description: system.description,
        contact_email: system.contact_email,
        system_user: {
          user_id: systemUser.user_id,
          username: systemUser.username,
          email: systemUser.email, // This is the actual email they'll use to login
          role_name: systemUser.role_name
        },
        created_on: system.created_on
      }
    };

    // Only include temp password in response if email failed
    if (!emailSent) {
      response.system.system_user.temp_password = tempPassword;
      response.warning = 'Email delivery failed. Save these credentials securely.';
    }

    return res.status(201).json(response);

  } catch (err) {
    console.error('registerSystem error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get all registered systems (admin only)
exports.getSystems = async (req, res) => {
  try {
    if (!req.user || req.user.role_name !== 'admin') {
      return res.status(403).json({ message: 'Only admin can view systems' });
    }

    const systems = await SystemRegistration.findAll({
      include: [
        {
          model: User,
          as: 'system_user',
          attributes: ['user_id', 'username', 'email', 'role_name', 'is_active']
        },
        {
          model: User,
          as: 'admin_creator',
          attributes: ['user_id', 'username', 'email']
        }
      ],
      order: [['created_on', 'DESC']]
    });

    return res.json({ systems });

  } catch (err) {
    console.error('getSystems error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Update system status (activate/deactivate)
exports.updateSystemStatus = async (req, res) => {
  try {
    const { systemId } = req.params;
    const { is_active } = req.body;

    if (!req.user || req.user.role_name !== 'admin') {
      return res.status(403).json({ message: 'Only admin can update systems' });
    }

    const system = await SystemRegistration.findByPk(systemId, {
      include: [{
        model: User,
        as: 'system_user'
      }]
    });

    if (!system) {
      return res.status(404).json({ message: 'System not found' });
    }

    // Update system status and also the associated user status
    await system.update({ is_active });
    await system.system_user.update({ is_active });

    return res.json({
      message: `System ${is_active ? 'activated' : 'deactivated'} successfully`,
      system: {
        system_id: system.system_id,
        system_name: system.system_name,
        is_active: system.is_active
      }
    });

  } catch (err) {
    console.error('updateSystemStatus error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Update system details
exports.updateSystem = async (req, res) => {
  try {
    const { systemId } = req.params;
    const { system_name, description, contact_email } = req.body;

    if (!req.user || req.user.role_name !== 'admin') {
      return res.status(403).json({ message: 'Only admin can update systems' });
    }

    const system = await SystemRegistration.findByPk(systemId);
    if (!system) {
      return res.status(404).json({ message: 'System not found' });
    }

    // Check if system name is being changed and if it's already taken
    if (system_name && system_name !== system.system_name) {
      const existingSystem = await SystemRegistration.findOne({
        where: { system_name }
      });
      if (existingSystem) {
        return res.status(400).json({ message: 'System name already exists' });
      }
    }

    await system.update({
      system_name,
      description,
      contact_email
    });

    return res.json({
      message: 'System updated successfully',
      system: {
        system_id: system.system_id,
        system_name: system.system_name,
        description: system.description,
        contact_email: system.contact_email
      }
    });

  } catch (err) {
    console.error('updateSystem error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};