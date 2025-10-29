// controllers/escalationController.js
const { Escalation, EscalationLevel, EscalationHistory, Ticket, User, Client, sequelize } = require('../models');
const { sendMail } = require('../utils/mailer');
const { escalationEmailTemplate, escalationReminderTemplate } = require('../utils/escalationEmailTemplates');

/**
 * Get escalation levels
 */
exports.getEscalationLevels = async (req, res) => {
  try {
    const levels = await EscalationLevel.findAll({
      where: { is_active: true },
      include: [
        {
          model: User,
          as: 'default_assignee',
          attributes: ['user_id', 'username', 'email', 'first_name', 'last_name']
        }
      ],
      order: [['level_number', 'ASC']]
    });

    return res.json({
      success: true,
      escalation_levels: levels
    });
  } catch (error) {
    console.error('Get escalation levels error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Escalate ticket with base64 image support and CC/BCC
 */
exports.escalateTicket = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const {
      escalation_level,
      subject,
      message,
      escalated_to_email,
      escalated_to_user_id,
      escalated_to_user,
      image_base64,
      cc, // New CC field
      bcc  // New BCC field
    } = req.body;

    // Check if user is Client Admin
    if (req.client_user.role !== 'admin') {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Only Client Admin can escalate tickets'
      });
    }

    const ticket = await Ticket.findByPk(ticketId, { transaction });
    if (!ticket) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Verify ticket belongs to client
    if (ticket.client_id !== req.client.id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied to this ticket'
      });
    }

    // Check if escalation level is valid
    const escalationLevel = await EscalationLevel.findOne({
      where: { level_number: escalation_level, is_active: true },
      transaction
    });

    if (!escalationLevel) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid escalation level'
      });
    }

    // Check if ticket is already at this escalation level or higher
    if (ticket.escalation_level && ticket.escalation_level >= escalation_level) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Ticket is already escalated to level ${ticket.escalation_level} or higher`
      });
    }

    // Process base64 image if provided
    let processedImageBase64 = null;
    if (image_base64) {
      const dataUrl = String(image_base64);
      const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
      
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        
        // Validate it's an image
        if (!mimeType.startsWith('image/')) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'Only image files are allowed'
          });
        }

        // Check base64 size (approx 5MB limit)
        const base64Size = (base64Data.length * 3) / 4;
        // if (base64Size > 50 * 1024 * 1024) {
        //   await transaction.rollback();
        //   return res.status(400).json({
        //     success: false,
        //     message: 'Image size should be less than 5MB'
        //   });
        // }

        processedImageBase64 = image_base64; // Store the complete data URL
      } else {
        // If it's already just base64 without data URL prefix, validate and use it
        try {
          // Simple base64 validation
          Buffer.from(image_base64, 'base64');
          processedImageBase64 = `data:image/png;base64,${image_base64}`;
        } catch (error) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'Invalid image format'
          });
        }
      }
    }

    // Create escalation record with base64 image and CC/BCC
    const escalation = await Escalation.create({
      ticket_id: ticketId,
      escalated_by: req.client_user.id,
      escalated_to_level: escalation_level,
      escalated_to_user_id: escalated_to_user_id,
      escalated_to_user_name: escalated_to_user,
      escalated_to_email: escalated_to_email,
      subject: subject,
      message: message,
      image_base64: processedImageBase64, // Store base64 directly in the escalation table
      cc_emails: cc, // Store CC emails
      bcc_emails: bcc, // Store BCC emails
      status: 'pending'
    }, { transaction });

    // Update ticket escalation info
    await ticket.update({
      escalation_level: escalation_level,
      escalation_status: `level_${escalation_level}`,
      current_escalation_id: escalation.escalation_id,
      last_updated_by: req.client_user.name,
      updated_at: new Date()
    }, { transaction });

    // Create escalation history record
    await EscalationHistory.create({
      escalation_id: escalation.escalation_id,
      action: 'escalated',
      performed_by: req.client_user.id,
      performed_name: req.client_user.name,
      notes: `Escalated to level ${escalation_level}`
    }, { transaction });

    await transaction.commit();

    // Send escalation email (async) - include image and CC/BCC if exists
    this.sendEscalationEmail(escalation, ticket, req.client_user, cc, bcc).catch(err => {
      console.error('Escalation email error:', err);
    });

    return res.json({
      success: true,
      message: `Ticket escalated to level ${escalation_level} successfully`,
      escalation: {
        escalation_id: escalation.escalation_id,
        level: escalation_level,
        status: escalation.status,
        image_base64: escalation.image_base64,
        cc_emails: escalation.cc_emails,
        bcc_emails: escalation.bcc_emails
      }
    });

  } catch (error) {
    console.error('Escalate ticket error:', error);
    try { await transaction.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Send reminder for escalation with CC/BCC support
 */
exports.sendEscalationReminder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { escalationId } = req.params;
    const { reminder_message, cc, bcc } = req.body; // Include CC/BCC in reminder

    // Check if user is Client Admin
    if (req.client_user.role !== 'admin') {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Only Client Admin can send escalation reminders'
      });
    }

    const escalation = await Escalation.findByPk(escalationId, {
      include: [
        {
          model: Ticket,
          as: 'ticket',
          attributes: ['ticket_id', 'module', 'category', 'comment']
        }
      ],
      transaction
    });

    if (!escalation) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Escalation not found'
      });
    }

    // Verify escalation belongs to client's ticket
    const ticket = await Ticket.findByPk(escalation.ticket_id, { transaction });
    if (ticket.client_id !== req.client.id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied to this escalation'
      });
    }

    // Update escalation reminder count
    await escalation.update({
      reminder_sent: true,
      reminder_count: escalation.reminder_count + 1,
      updated_on: new Date()
    }, { transaction });

    // Create history record
    await EscalationHistory.create({
      escalation_id: escalationId,
      action: 'reminder_sent',
      performed_by: req.client_user.id,
      performed_reminder_name: req.client_user.name,
      notes: reminder_message || 'Reminder sent'
    }, { transaction });

    await transaction.commit();

    // Send reminder email (async) with CC/BCC support
    this.sendEscalationReminderEmail(escalation, req.client_user, reminder_message, cc, bcc).catch(err => {
      console.error('Escalation reminder email error:', err);
    });

    return res.json({
      success: true,
      message: 'Escalation reminder sent successfully',
      reminder_count: escalation.reminder_count + 1
    });

  } catch (error) {
    console.error('Send escalation reminder error:', error);
    try { await transaction.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get escalation history for a ticket
 */
exports.getEscalationHistory = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Verify ticket belongs to client
    if (ticket.client_id !== req.client.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this ticket'
      });
    }

    const escalations = await Escalation.findAll({
      where: { ticket_id: ticketId },
      include: [
        {
          model: User,
          as: 'escalator',
          attributes: ['user_id', 'username', 'email', 'first_name', 'last_name']
        },
        {
          model: User,
          as: 'escalated_to_user',
          attributes: ['user_id', 'username', 'email', 'first_name', 'last_name']
        },
        {
          model: EscalationHistory,
          as: 'history',
          include: [
            {
              model: User,
              as: 'performer',
              attributes: ['user_id', 'username', 'first_name', 'last_name']
            }
          ],
          order: [['created_on', 'DESC']]
        }
      ],
      order: [['created_on', 'DESC']]
    });

    return res.json({
      success: true,
      escalations: escalations
    });

  } catch (error) {
    console.error('Get escalation history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get current escalation status
 */
exports.getCurrentEscalationStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: Escalation,
          as: 'current_escalation',
          include: [
            {
              model: User,
              as: 'escalated_to_user',
              attributes: ['user_id', 'username', 'email', 'first_name', 'last_name']
            },
            {
              model: EscalationHistory,
              as: 'history',
              order: [['created_on', 'DESC']],
              limit: 5
            }
          ]
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Verify ticket belongs to client
    if (ticket.client_id !== req.client.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this ticket'
      });
    }

    return res.json({
      success: true,
      escalation_status: ticket.escalation_status,
      escalation_level: ticket.escalation_level,
      current_escalation: ticket.current_escalation
    });

  } catch (error) {
    console.error('Get current escalation status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Helper function to send escalation email with CC/BCC support
 */
exports.sendEscalationEmail = async (escalation, ticket, clientUser, cc = null, bcc = null) => {
  try {
    const emailData = escalationEmailTemplate({
      escalation: escalation,
      ticket: ticket,
      client: clientUser
    });

    const mailOptions = {
      to: escalation.escalated_to_email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text
    };

    // Add CC if provided
    if (cc && cc.trim()) {
      mailOptions.cc = this.parseEmailList(cc);
    }

    // Add BCC if provided
    if (bcc && bcc.trim()) {
      mailOptions.bcc = this.parseEmailList(bcc);
    }

    await sendMail(mailOptions);

    console.log(`Escalation email sent to: ${escalation.escalated_to_email}`);
    if (mailOptions.cc) console.log(`CC: ${mailOptions.cc.join(', ')}`);
    if (mailOptions.bcc) console.log(`BCC: ${mailOptions.bcc.join(', ')}`);
  } catch (error) {
    console.error('Failed to send escalation email:', error);
    throw error;
  }
};

/**
 * Helper function to send escalation reminder email with CC/BCC support
 */
exports.sendEscalationReminderEmail = async (escalation, clientUser, reminderMessage, cc = null, bcc = null) => {
  try {
    const ticket = await Ticket.findByPk(escalation.ticket_id);
    
    const emailData = escalationReminderTemplate({
      escalation: escalation,
      ticket: ticket,
      client: clientUser,
      reminder_message: reminderMessage
    });

    const mailOptions = {
      to: escalation.escalated_to_email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text
    };

    // Add CC if provided
    if (cc && cc.trim()) {
      mailOptions.cc = this.parseEmailList(cc);
    } else if (escalation.cc_emails) {
      // Use stored CC from original escalation if available
      mailOptions.cc = this.parseEmailList(escalation.cc_emails);
    }

    // Add BCC if provided
    if (bcc && bcc.trim()) {
      mailOptions.bcc = this.parseEmailList(bcc);
    } else if (escalation.bcc_emails) {
      // Use stored BCC from original escalation if available
      mailOptions.bcc = this.parseEmailList(escalation.bcc_emails);
    }

    await sendMail(mailOptions);

    console.log(`Escalation reminder sent to: ${escalation.escalated_to_email}`);
    if (mailOptions.cc) console.log(`CC: ${mailOptions.cc.join(', ')}`);
    if (mailOptions.bcc) console.log(`BCC: ${mailOptions.bcc.join(', ')}`);
  } catch (error) {
    console.error('Failed to send escalation reminder email:', error);
    throw error;
  }
};

/**
 * Helper function to parse comma-separated email string into array
 */
exports.parseEmailList = (emailString) => {
  if (!emailString || !emailString.trim()) return [];
  
  return emailString
    .split(',')
    .map(email => email.trim())
    .filter(email => {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return email && emailRegex.test(email);
    });
};

/**
 * Get all escalation reports for admin
 */
exports.getAllEscalationReportsForAdmin = async (req, res) => {
  try {
    const escalations = await Escalation.findAll({
      include: [
        {
          model: Ticket,
          as: 'ticket',
          attributes: ['ticket_id', 'module', 'category', 'comment', 'status', 'created_at', 'client_id'],
          include: [
            {
              model: Client,
              as: 'client',
              attributes: ['client_id', 'company_name', 'email']
            }
          ]
        },
        {
          model: User,
          as: 'escalator',
          attributes: ['user_id', 'first_name', 'last_name', 'email']
        },
        {
          model: User,
          as: 'escalated_to_user',
          attributes: ['user_id', 'first_name', 'last_name', 'email']
        },
        {
          model: EscalationHistory,
          as: 'history',
          attributes: ['history_id', 'action', 'performed_by', 'notes', 'created_on'],
          order: [['created_on', 'DESC']],
          include: [
            {
              model: User,
              as: 'performer',
              attributes: ['first_name', 'last_name']
            }
          ]
        }
      ],
      order: [['created_on', 'DESC']]
    });

    return res.json({
      success: true,
      data: escalations
    });

  } catch (error) {
    console.error('Get all escalation reports for admin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};