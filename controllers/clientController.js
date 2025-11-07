const { Client, Ticket, ClientSLA, sequelize } = require('../models');
const { sendMail } = require('../utils/mailer');

// Helper function to validate IDs
const validateId = (id) => {
  const parsed = parseInt(id, 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
};

// Define escapeHtml function here to avoid import issues
const escapeHtml = (s = '') => {
  return (s + '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
};

// Helper function to generate client credentials email template
const clientCredentialsTemplate = ({ client, password, adminName = 'Admin' }) => {
  const subject = `Client Registration Credentials - ${client.company_name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Client Registration Complete</h2>
      
      <p>Hello ${escapeHtml(client.contact_person || 'Valued Client')},</p>
      
      <p>Your client account for <strong>${escapeHtml(client.company_name)}</strong> has been created successfully in our Ticketing System.</p>
      <p>Here are your login credentials:</p>
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 120px;">Company Name:</td>
            <td style="padding: 8px 0;">${escapeHtml(client.company_name)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Contact Person:</td>
            <td style="padding: 8px 0;">${escapeHtml(client.contact_person || 'N/A')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Login Email:</td>
            <td style="padding: 8px 0;">${escapeHtml(client.email)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Password:</td>
            <td style="padding: 8px 0; font-family: monospace; font-size: 16px;">
              <strong>${escapeHtml(password)}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Max File Size:</td>
            <td style="padding: 8px 0;">${client.allowed_file_size || 10} MB</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Auto Close Timer:</td>
            <td style="padding: 8px 0;">${client.ticket_auto_close_timer || 7} days</td>
          </tr>
        </table>
      </div>
      
      <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #0066cc;">How to Use:</h4>
        <ol style="margin: 0; padding-left: 20px;">
          <li>Use the credentials above to login at: <strong>${process.env.CLIENT_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/client/login</strong></li>
          <li>After login, you can raise tickets and track their status</li>
          <li>View your ticket history and communicate with support team</li>
          <li>Maximum file upload size: <strong>${client.allowed_file_size || 10} MB</strong></li>
          <li>Resolved tickets auto-close after: <strong>${client.ticket_auto_close_timer || 7} days</strong></li>
        </ol>
      </div>
      
      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
        <p style="margin: 0; color: #856404;">
          <strong>Security Notice:</strong> For security reasons, please change your password after first login.
          Keep these credentials secure and do not share them.
        </p>
      </div>
      
      <h4>What You Can Do:</h4>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>Raise new support tickets</li>
        <li>Track existing ticket status</li>
        <li>Communicate with support team</li>
        <li>View ticket history and resolutions</li>
        <li>Update your company profile</li>
        <li>Upload files up to ${client.allowed_file_size || 10} MB</li>
      </ul>
      
      <p>
        <a href="${process.env.CLIENT_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/client/login" 
           style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
          Login to Client Portal
        </a>
      </p>
      
      <p>If you have any questions or need assistance, please contact our support team.</p>
      
      <p>Best regards,<br/>
      <strong>${escapeHtml(adminName)}</strong><br/>
      Ticketing System Team</p>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #666;">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;
  
  const text = `
    CLIENT REGISTRATION CREDENTIALS
    
    Your client account for "${client.company_name}" has been created successfully.
    
    Company Name: ${client.company_name}
    Contact Person: ${client.contact_person || 'N/A'}
    Login Email: ${client.email}
    Password: ${password}
    Max File Size: ${client.allowed_file_size || 10} MB
    Auto Close Timer: ${client.ticket_auto_close_timer || 7} days
    
    Login URL: ${process.env.CLIENT_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/client/login
    
    HOW TO USE:
    1. Use the credentials above to login
    2. After login, you can raise tickets and track their status
    3. View your ticket history and communicate with support team
    4. Maximum file upload size: ${client.allowed_file_size || 10} MB
    5. Resolved tickets auto-close after: ${client.ticket_auto_close_timer || 7} days
    
    WHAT YOU CAN DO:
    - Raise new support tickets
    - Track existing ticket status
    - Communicate with support team
    - View ticket history and resolutions
    - Update your company profile
    - Upload files up to ${client.allowed_file_size || 10} MB
    
    SECURITY NOTICE: 
    For security reasons, please change your password after first login.
    Keep these credentials secure and do not share them.
    
    Best regards,
    ${adminName}
    Ticketing System Team
    
    This is an automated message. Please do not reply to this email.
  `;
  
  return { subject, html, text };
};

// Helper function to generate client update email template
const clientUpdateTemplate = ({ client, updates, adminName = 'Admin' }) => {
  const subject = `Client Account Updated - ${client.company_name}`;
  
  let updateDetails = '';
  if (updates.email) {
    updateDetails += `<li><strong>Login Email:</strong> ${escapeHtml(updates.email)}</li>`;
  }
  if (updates.password) {
    updateDetails += `<li><strong>Password:</strong> Has been updated</li>`;
  }
  if (updates.allowed_file_size !== undefined) {
    updateDetails += `<li><strong>Max File Size:</strong> ${updates.allowed_file_size} MB</li>`;
  }
  if (updates.ticket_auto_close_timer !== undefined) {
    updateDetails += `<li><strong>Auto Close Timer:</strong> ${updates.ticket_auto_close_timer} days</li>`;
  }
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Client Account Updated</h2>
      
      <p>Hello ${escapeHtml(client.contact_person || 'Valued Client')},</p>
      
      <p>Your client account for <strong>${escapeHtml(client.company_name)}</strong> has been updated.</p>
      
      ${updateDetails ? `
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0;">Updated Information:</h4>
        <ul style="margin: 0; padding-left: 20px;">
          ${updateDetails}
        </ul>
      </div>
      ` : ''}
      
      <p>You can login to your account using the following link:</p>
      
      <p>
        <a href="${process.env.CLIENT_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/client/login" 
           style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
          Login to Client Portal
        </a>
      </p>
      
      <p>If you did not request these changes or have any concerns, please contact our support team immediately.</p>
      
      <p>Best regards,<br/>
      <strong>${escapeHtml(adminName)}</strong><br/>
      Ticketing System Team</p>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #666;">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;
  
  const text = `
    CLIENT ACCOUNT UPDATED
    
    Your client account for "${client.company_name}" has been updated.
    
    ${updates.email ? `Login Email: ${updates.email}` : ''}
    ${updates.password ? `Password: Has been updated` : ''}
    ${updates.allowed_file_size !== undefined ? `Max File Size: ${updates.allowed_file_size} MB` : ''}
    ${updates.ticket_auto_close_timer !== undefined ? `Auto Close Timer: ${updates.ticket_auto_close_timer} days` : ''}
    
    Login URL: ${process.env.CLIENT_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/client/login
    
    If you did not request these changes or have any concerns, please contact our support team immediately.
    
    Best regards,
    ${adminName}
    Ticketing System Team
    
    This is an automated message. Please do not reply to this email.
  `;
  
  return { subject, html, text };
};

// Helper function to send client credentials email
const sendClientCredentialsEmail = async (client, password) => {
  try {
    const emailTemplate = clientCredentialsTemplate({
      client,
      password,
      adminName: process.env.ADMIN_NAME || 'System Administrator'
    });

    const emailResult = await sendMail({
      to: client.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    });

    if (emailResult.error) {
      console.error('Failed to send client credentials email:', emailResult.message);
      return { success: false, error: emailResult.message };
    } else {
      console.log(`Client credentials email sent successfully to ${client.email}`);
      return { success: true };
    }
  } catch (emailError) {
    console.error('Error sending client credentials email:', emailError);
    return { success: false, error: emailError.message };
  }
};

// Helper function to send client update notification
const sendClientUpdateEmail = async (client, updates) => {
  try {
    const emailTemplate = clientUpdateTemplate({
      client,
      updates,
      adminName: process.env.ADMIN_NAME || 'System Administrator'
    });

    const emailResult = await sendMail({
      to: client.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    });

    if (emailResult.error) {
      console.error('Failed to send client update email:', emailResult.message);
      return { success: false, error: emailResult.message };
    } else {
      console.log(`Client update email sent successfully to ${client.email}`);
      return { success: true };
    }
  } catch (emailError) {
    console.error('Error sending client update email:', emailError);
    return { success: false, error: emailError.message };
  }
};

exports.listClients = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const where = includeInactive ? {} : { is_active: true };

    const clients = await Client.findAll({
      where,
      attributes: { 
        exclude: ['password_hash'] 
      },
      order: [['registration_date', 'DESC']]
    });

    return res.json({ clients });
  } catch (err) {
    console.error('listClients', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getClient = async (req, res) => {
  try {
    const id = validateId(req.params.id);
    
    if (!id) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }
    
    const client = await Client.findByPk(id, {
      attributes: { 
        exclude: ['password_hash'] 
      },
      include: [
        {
          model: Ticket,
          as: 'tickets',
          attributes: ['ticket_id', 'subject', 'status', 'created_at'],
          limit: 5,
          order: [['created_at', 'DESC']]
        },
        {
          model: ClientSLA,
          as: 'slas',
          attributes: ['client_sla_id', 'name', 'is_active'],
          where: { is_active: true },
          required: false
        }
      ]
    });
    
    if (!client) return res.status(404).json({ message: 'Client not found' });
    return res.json({ client });
  } catch (err) {
    console.error('getClient', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createClient = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      company_name,
      contact_person,
      email,
      password,
      phone,
      address,
      is_active,
      allowed_file_size = 10, // NEW FIELD with default
      ticket_auto_close_timer = 7, // NEW FIELD with default
      sendCredentials = true
    } = req.body;

    // Validation
    if (!company_name || company_name.trim() === '') {
      await t.rollback();
      return res.status(400).json({ message: 'Company name is required' });
    }

    if (!email || email.trim() === '') {
      await t.rollback();
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!password || password.trim() === '') {
      await t.rollback();
      return res.status(400).json({ message: 'Password is required' });
    }

    // Validate new fields
    if (allowed_file_size && (allowed_file_size < 1 || allowed_file_size > 100)) {
      await t.rollback();
      return res.status(400).json({ message: 'Allowed file size must be between 1 and 100 MB' });
    }

    if (ticket_auto_close_timer && (ticket_auto_close_timer < 1 || ticket_auto_close_timer > 365)) {
      await t.rollback();
      return res.status(400).json({ message: 'Ticket auto close timer must be between 1 and 365 days' });
    }

    // Check if email already exists
    const existingClient = await Client.findOne({
      where: { email: email.trim().toLowerCase() }
    });

    if (existingClient) {
      await t.rollback();
      return res.status(409).json({ 
        message: 'Client with this email already exists' 
      });
    }

    const client = await Client.create({
      company_name: company_name.trim(),
      contact_person: contact_person?.trim() || null,
      email: email.trim().toLowerCase(),
      password_hash: password, // Will be hashed by hook
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      is_active: is_active === undefined ? true : !!is_active,
      registration_date: new Date(),
      // NEW FIELDS
      allowed_file_size: allowed_file_size,
      ticket_auto_close_timer: ticket_auto_close_timer
    }, { transaction: t });

    await t.commit();
    
    // Fetch created client without password
    const createdClient = await Client.findByPk(client.client_id, {
      attributes: { exclude: ['password_hash'] }
    });

    // Send credentials email if requested
    let emailResult = null;
    if (sendCredentials) {
      emailResult = await sendClientCredentialsEmail(createdClient, password);
    }

    const response = { 
      message: 'Client created successfully', 
      client: createdClient 
    };

    if (emailResult) {
      response.emailSent = emailResult.success;
      if (!emailResult.success) {
        response.warning = 'Client created but failed to send credentials email';
      }
    }

    return res.status(201).json(response);
  } catch (err) {
    console.error('createClient', err);
    try { await t.rollback(); } catch (_) {}
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateClient = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = validateId(req.params.id);
    
    if (!id) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }

    const {
      company_name,
      contact_person,
      email,
      password,
      phone,
      address,
      is_active,
      allowed_file_size, // NEW FIELD
      ticket_auto_close_timer, // NEW FIELD
      notifyClient = false
    } = req.body;

    const client = await Client.findByPk(id, { transaction: t });
    if (!client) {
      await t.rollback();
      return res.status(404).json({ message: 'Client not found' });
    }

    const updates = {};
    let passwordChanged = false;
    let emailChanged = false;
    let fileSizeChanged = false;
    let autoCloseChanged = false;

    // Check email uniqueness if email is being updated
    if (email && email.trim().toLowerCase() !== client.email) {
      const existingClient = await Client.findOne({
        where: { email: email.trim().toLowerCase() },
        transaction: t
      });
      
      if (existingClient && existingClient.client_id !== client.client_id) {
        await t.rollback();
        return res.status(409).json({ 
          message: 'Another client with this email already exists' 
        });
      }
      client.email = email.trim().toLowerCase();
      updates.email = email.trim().toLowerCase();
      emailChanged = true;
    }

    if (company_name && company_name.trim() !== client.company_name) {
      client.company_name = company_name.trim();
    }

    if (contact_person !== undefined) {
      client.contact_person = contact_person?.trim() || null;
    }

    if (phone !== undefined) {
      client.phone = phone?.trim() || null;
    }

    if (address !== undefined) {
      client.address = address?.trim() || null;
    }

    if (password && password.trim() !== '') {
      client.password_hash = password.trim(); // Will be hashed by hook
      updates.password = true;
      passwordChanged = true;
    }

    if (is_active !== undefined) {
      client.is_active = !!is_active;
    }

    // NEW FIELDS UPDATE LOGIC
    if (allowed_file_size !== undefined) {
      if (allowed_file_size < 1 || allowed_file_size > 100) {
        await t.rollback();
        return res.status(400).json({ message: 'Allowed file size must be between 1 and 100 MB' });
      }
      client.allowed_file_size = allowed_file_size;
      updates.allowed_file_size = allowed_file_size;
      fileSizeChanged = true;
    }

    if (ticket_auto_close_timer !== undefined) {
      if (ticket_auto_close_timer < 1 || ticket_auto_close_timer > 365) {
        await t.rollback();
        return res.status(400).json({ message: 'Ticket auto close timer must be between 1 and 365 days' });
      }
      client.ticket_auto_close_timer = ticket_auto_close_timer;
      updates.ticket_auto_close_timer = ticket_auto_close_timer;
      autoCloseChanged = true;
    }

    client.last_login_date = client.last_login_date; // Keep existing value

    await client.save({ transaction: t });
    await t.commit();

    // Fetch updated client without password
    const updatedClient = await Client.findByPk(id, {
      attributes: { exclude: ['password_hash'] }
    });

    // Send update notification if requested and there are relevant changes
    let emailResult = null;
    if (notifyClient && (emailChanged || passwordChanged || fileSizeChanged || autoCloseChanged)) {
      emailResult = await sendClientUpdateEmail(updatedClient, updates);
    }

    const response = { 
      message: 'Client updated successfully', 
      client: updatedClient 
    };

    if (emailResult) {
      response.emailSent = emailResult.success;
      if (!emailResult.success) {
        response.warning = 'Client updated but failed to send notification email';
      }
    }

    return res.json(response);
  } catch (err) {
    console.error('updateClient', err);
    try { await t.rollback(); } catch (_) {}
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteClient = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = validateId(req.params.id);
    
    if (!id) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }

    const client = await Client.findByPk(id, { transaction: t });
    
    if (!client) {
      await t.rollback();
      return res.status(404).json({ message: 'Client not found' });
    }

    // Check if client has any active tickets
    const activeTicketCount = await Ticket.count({
      where: { 
        client_id: id,
        status: ['Open', 'Pending']
      },
      transaction: t
    });

    if (activeTicketCount > 0) {
      await t.rollback();
      return res.status(400).json({ 
        message: `Cannot deactivate client. There are ${activeTicketCount} active ticket(s) associated with this client.`
      });
    }

    // Check if client has any active SLAs
    const activeSLACount = await ClientSLA.count({
      where: { 
        client_id: id,
        is_active: true
      },
      transaction: t
    });

    if (activeSLACount > 0) {
      await t.rollback();
      return res.status(400).json({ 
        message: `Cannot deactivate client. There are ${activeSLACount} active SLA(s) associated with this client.`
      });
    }

    // Soft-delete: mark inactive
    client.is_active = false;
    await client.save({ transaction: t });

    await t.commit();
    return res.json({ message: 'Client deactivated successfully' });
  } catch (err) {
    console.error('deleteClient', err);
    try { await t.rollback(); } catch (_) {}
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getClientStats = async (req, res) => {
  try {
    const id = validateId(req.params.id);
    
    if (!id) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }

    const client = await Client.findByPk(id, {
      attributes: { exclude: ['password_hash'] }
    });
    
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Get ticket statistics
    const ticketStats = await Ticket.findAll({
      where: { client_id: id },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('ticket_id')), 'total_tickets'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'Open' THEN 1 ELSE 0 END")), 'open_tickets'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'Pending' THEN 1 ELSE 0 END")), 'pending_tickets'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END")), 'resolved_tickets'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'Closed' THEN 1 ELSE 0 END")), 'closed_tickets']
      ],
      raw: true
    });

    // Get SLA statistics
    const slaStats = await ClientSLA.findAll({
      where: { client_id: id },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('client_sla_id')), 'total_slas'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN is_active = true THEN 1 ELSE 0 END")), 'active_slas']
      ],
      raw: true
    });

    const stats = {
      client: {
        client_id: client.client_id,
        company_name: client.company_name,
        contact_person: client.contact_person,
        email: client.email,
        registration_date: client.registration_date,
        last_login_date: client.last_login_date,
        // NEW FIELDS IN STATS
        allowed_file_size: client.allowed_file_size,
        ticket_auto_close_timer: client.ticket_auto_close_timer
      },
      tickets: ticketStats[0] || {
        total_tickets: 0,
        open_tickets: 0,
        pending_tickets: 0,
        resolved_tickets: 0,
        closed_tickets: 0
      },
      slas: slaStats[0] || {
        total_slas: 0,
        active_slas: 0
      }
    };

    return res.json({ stats });
  } catch (err) {
    console.error('getClientStats', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// New endpoint to resend credentials
exports.resendCredentials = async (req, res) => {
  try {
    const id = validateId(req.params.id);
    
    if (!id) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }

    const client = await Client.findByPk(id, {
      attributes: { exclude: ['password_hash'] }
    });
    
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    
    // Update client with new password
    const updatedClient = await Client.findByPk(id);
    updatedClient.password_hash = tempPassword;
    await updatedClient.save();

    // Send credentials email
    const emailResult = await sendClientCredentialsEmail(client, tempPassword);

    if (emailResult.success) {
      return res.json({ 
        message: 'Login credentials sent successfully to client email',
        emailSent: true
      });
    } else {
      return res.status(500).json({ 
        message: 'Failed to send credentials email',
        emailSent: false,
        error: emailResult.error
      });
    }
  } catch (err) {
    console.error('resendCredentials', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// New endpoint to get client settings (for external use)
exports.getClientSettings = async (req, res) => {
  try {
    const id = validateId(req.params.id);
    
    if (!id) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }

    const client = await Client.findByPk(id, {
      attributes: [
        'client_id', 
        'company_name', 
        'allowed_file_size', 
        'ticket_auto_close_timer',
        'is_active'
      ]
    });
    
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (!client.is_active) {
      return res.status(400).json({ message: 'Client account is inactive' });
    }

    const settings = {
      client_id: client.client_id,
      company_name: client.company_name,
      allowed_file_size: client.allowed_file_size,
      ticket_auto_close_timer: client.ticket_auto_close_timer,
      max_file_size_bytes: (client.allowed_file_size || 10) * 1024 * 1024 // Convert MB to bytes
    };

    return res.json({ settings });
  } catch (err) {
    console.error('getClientSettings', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// New endpoint to update only client settings
exports.updateClientSettings = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = validateId(req.params.id);
    
    if (!id) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }

    const {
      allowed_file_size,
      ticket_auto_close_timer,
      notifyClient = false
    } = req.body;

    const client = await Client.findByPk(id, { transaction: t });
    if (!client) {
      await t.rollback();
      return res.status(404).json({ message: 'Client not found' });
    }

    const updates = {};
    let fileSizeChanged = false;
    let autoCloseChanged = false;

    // Validate and update allowed_file_size
    if (allowed_file_size !== undefined) {
      if (allowed_file_size < 1 || allowed_file_size > 100) {
        await t.rollback();
        return res.status(400).json({ message: 'Allowed file size must be between 1 and 100 MB' });
      }
      client.allowed_file_size = allowed_file_size;
      updates.allowed_file_size = allowed_file_size;
      fileSizeChanged = true;
    }

    // Validate and update ticket_auto_close_timer
    if (ticket_auto_close_timer !== undefined) {
      if (ticket_auto_close_timer < 1 || ticket_auto_close_timer > 365) {
        await t.rollback();
        return res.status(400).json({ message: 'Ticket auto close timer must be between 1 and 365 days' });
      }
      client.ticket_auto_close_timer = ticket_auto_close_timer;
      updates.ticket_auto_close_timer = ticket_auto_close_timer;
      autoCloseChanged = true;
    }

    await client.save({ transaction: t });
    await t.commit();

    // Send update notification if requested and there are changes
    let emailResult = null;
    if (notifyClient && (fileSizeChanged || autoCloseChanged)) {
      emailResult = await sendClientUpdateEmail(client, updates);
    }

    const response = { 
      message: 'Client settings updated successfully',
      settings: {
        allowed_file_size: client.allowed_file_size,
        ticket_auto_close_timer: client.ticket_auto_close_timer
      }
    };

    if (emailResult) {
      response.emailSent = emailResult.success;
      if (!emailResult.success) {
        response.warning = 'Settings updated but failed to send notification email';
      }
    }

    return res.json(response);
  } catch (err) {
    console.error('updateClientSettings', err);
    try { await t.rollback(); } catch (_) {}
    return res.status(500).json({ message: 'Internal server error' });
  }
};