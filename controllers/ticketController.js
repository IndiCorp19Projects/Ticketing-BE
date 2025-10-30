// controllers/ticketController.js
const { Ticket, TicketReply, Document, sequelize, User, SLA, Category, SubCategory, IssueType, Priority, WorkingHours, Client, ClientSLA } = require('../models');
const { sendMail } = require('../utils/mailer');
const { ticketCreatedTemplate, ticketReplyTemplate, ticketStatusChangedTemplate } = require('../utils/emailTemplates');
const SLACalculator = require('../utils/slaCalculator');
const calculateWorkingHours = require('../utils/calculateWorkingHours');

// Helper functions
function secondsBetween(a, b) {
  if (!a || !b) return null;
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 1000);
}

// Compute SLA compliance for both user and client tickets
async function computeSLACompliance(ticket) {
  if (!ticket) return { response_sla_met: null, resolve_sla_met: null, sla: null };
  
  let sla = ticket.sla ?? ticket.client_sla ?? null;
  
  if (!sla) {
    if (ticket.sla_id) {
      sla = await SLA.findByPk(ticket.sla_id, {
        include: [
          {
            model: WorkingHours,
            as: 'working_hours',
            attributes: ['working_hours_id', 'working_days', 'start_time', 'end_time', 'timezone']
          }
        ]
      });
    } else if (ticket.client_sla_id) {
      sla = await ClientSLA.findByPk(ticket.client_sla_id, {
        include: [
          {
            model: WorkingHours,
            as: 'working_hours',
            attributes: ['working_hours_id', 'working_days', 'start_time', 'end_time', 'timezone']
          }
        ]
      });
    }
  }

  let response_sla_met = null;
  let resolve_sla_met = null;

  if (sla) {
    if (ticket.response_at && sla.response_target_minutes) {
      if (sla.working_hours) {
        const actualWorkingMinutes = SLACalculator.getWorkingMinutesBetween(
          new Date(ticket.created_at),
          new Date(ticket.response_at),
          sla.working_hours
        );
        response_sla_met = actualWorkingMinutes <= sla.response_target_minutes;
      } else {
        response_sla_met = ticket.response_time_seconds <= (sla.response_target_minutes * 60);
      }
    }

    if (ticket.resolved_at && sla.resolve_target_minutes) {
      if (sla.working_hours) {
        const actualWorkingMinutes = SLACalculator.getWorkingMinutesBetween(
          new Date(ticket.created_at),
          new Date(ticket.resolved_at),
          sla.working_hours
        );
        resolve_sla_met = actualWorkingMinutes <= sla.resolve_target_minutes;
      } else {
        resolve_sla_met = ticket.resolve_time_seconds <= (sla.resolve_target_minutes * 60);
      }
    }
  }

  return { response_sla_met, resolve_sla_met, sla };
}

// Permission checking functions
const ensureOwnerOrAdmin = async (req, ticket) => {
  if (!ticket) return false;
  
  // Admin and executives can access all tickets
  if (req.user && (req.user.role_name === 'admin' || req.user.role_name === 'executive')) {
    return true;
  }
  
  // Systems can access their own tickets
  if (req.user && req.user.role_name === 'system') {
    return ticket.user_id === req.user.id;
  }
  
  // Users can access their own tickets
  if (req.user && req.user.role_name === 'user') {
    return ticket.user_id === req.user.id;
  }
  
  // Clients can access their own tickets
  if (req.client) {
    return ticket.client_id === req.client.id;
  }
  
  return false;
};

const ensureCanReply = async (req, ticket) => {
  if (!ticket) return false;
  
  // Admin can reply to any ticket
  if (req.user && req.user.role_name === 'admin') {
    return true;
  }
  
  // Systems can reply to tickets they created
  if (req.user && req.user.role_name === 'system') {
    return ticket.user_id === req.user.id;
  }
  
  // Executives can reply to assigned tickets
  if (req.user && req.user.role_name === 'executive') {
    return Number(ticket.assigned_to) === Number(req.user.id);
  }
  
  // Users can reply to their own tickets
  if (req.user && req.user.role_name === 'user') {
    return ticket.user_id === req.user.id;
  }
  
  // Clients can reply to their own tickets
  if (req.client) {
    return ticket.client_id === req.client.id;
  }
  
  return false;
};




exports.adminGetAllTickets = async (req, res) => {
  try {
    const tickets = await Ticket.findAll({
      include: [
        {
          model: TicketReply,
          as: 'replies',
          include: [
            { 
              model: User, 
              as: 'sender', 
              attributes: ['user_id', 'username', 'email'] 
            },
            { 
              model: Document, 
              as: 'documents', 
              attributes: ['document_id', 'doc_name', 'doc_base64', 'mime_type', 'created_on'] 
            }
          ]
        },
        { 
          model: User, 
          as: 'creator', 
          attributes: ['user_id', 'username', 'email'] 
        },
        { 
          model: Client, 
          as: 'client', 
          attributes: ['client_id', 'company_name', 'contact_person', 'email'] 
        },
        { 
          model: Document, 
          as: 'documents', 
          attributes: ['document_id', 'doc_name', 'doc_base64', 'mime_type', 'created_on'] 
        },
        { 
          model: SLA, 
          as: 'sla' 
        },
        { 
          model: ClientSLA, 
          as: 'client_sla' 
        }
      ],
      order: [
        ['created_at', 'DESC']
      ]
    });

    // Process tickets and handle client senders separately
    const ticketsWithSLA = await Promise.all(
      tickets.map(async (t) => {
        const plain = t.toJSON ? t.toJSON() : t;
        
        // Process replies to handle client senders
        if (Array.isArray(plain.replies)) {
          for (let reply of plain.replies) {
            // If sender_type is 'client', we need to replace the user sender with client data
            if (reply.sender_type === 'client') {
              const client = await Client.findByPk(reply.sender_id, {
                attributes: ['client_id', 'company_name', 'email']
              });
              if (client) {
                // Replace the user sender with client data
                reply.sender = {
                  user_id: client.client_id, // For compatibility
                  username: client.company_name,
                  email: client.email,
                  is_client: true
                };
              } else {
                // If client not found, clear the sender
                reply.sender = null;
              }
            }
            // For user/admin/system replies, the sender is already populated with user data
          }
          
          // Sort replies by created_at
          plain.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }
        
        // Compute SLA compliance
        const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
        plain.sla = sla;
        plain.response_sla_met = response_sla_met;
        plain.resolve_sla_met = resolve_sla_met;
        
        // Ensure is_other_issue is included
        plain.is_other_issue = plain.is_other_issue ?? false;


        // console.log(plain, 'this is just to test')
        
        return plain;
      })
    );

    return res.json({ tickets: ticketsWithSLA });
  } catch (err) {
    console.error('adminGetAllTickets Error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get user's tickets
exports.getUserTickets = async (req, res) => {
  try {
    const uid = req.user.id ?? req.user.user_id;
    const tickets = await Ticket.findAll({
      where: { user_id: uid },
      include: [
        { model: User, as: 'creator', attributes: ['user_id', 'username', 'email', 'first_name', 'last_name'] },
        {
          model: TicketReply,
          as: 'replies',
          include: [
            { model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] },
            { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on'] }
          ],
        },
        { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on'] },
        { model: SLA, as: 'sla' }
      ],
      order: [
        [{ model: TicketReply, as: 'replies' }, 'created_at', 'ASC'],
        ['created_at', 'DESC']
      ]
    });

    const ticketsWithSLA = await Promise.all(
      tickets.map(async (t) => {
        const plain = t.toJSON ? t.toJSON() : t;
        
        // Process replies to handle client senders (if any)
        if (Array.isArray(plain.replies)) {
          for (let reply of plain.replies) {
            // If sender_type is 'client', replace with client data
            if (reply.sender_type === 'client') {
              const client = await Client.findByPk(reply.sender_id, {
                attributes: ['client_id', 'company_name', 'email']
              });
              if (client) {
                reply.sender = {
                  user_id: client.client_id,
                  username: client.company_name,
                  email: client.email,
                  is_client: true
                };
              } else {
                reply.sender = null;
              }
            }
          }
          
          plain.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }
        
        const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
        plain.sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.sla ?? null;
        plain.response_sla_met = response_sla_met;
        plain.resolve_sla_met = resolve_sla_met;
        return plain;
      })
    );

    return res.json({ tickets: ticketsWithSLA });
  } catch (err) {
    console.error('getUserTickets Error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
// Get executive's assigned tickets
exports.execGetAssignedTickets = async (req, res) => {
  try {
    const uid = req.user.id ?? req.user.user_id;
    if (!req.user || req.user.role_name !== 'executive') return res.status(403).json({ message: 'Forbidden' });

    const tickets = await Ticket.findAll({
      where: { assigned_to: uid },
      include: [
        { 
          model: TicketReply, 
          as: 'replies', 
          include: [
            { model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] }, 
            { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on'] }
          ] 
        },
        { 
          model: User, 
          as: 'creator', 
          attributes: ['user_id','username','email'] 
        },
        { 
          model: Client, 
          as: 'client', 
          attributes: ['client_id', 'company_name', 'contact_person', 'email'] 
        },
        { 
          model: Document, 
          as: 'documents',
          attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on']
        },
        { 
          model: SLA, 
          as: 'sla' 
        },
        { 
          model: ClientSLA, 
          as: 'client_sla' 
        }
      ],
      order: [
        [{ model: TicketReply, as: 'replies'}, 'created_at', 'ASC'],
        ['created_at','DESC']
      ]
    });

    const resp = await Promise.all(
      tickets.map(async (t) => {
        const plain = t.toJSON ? t.toJSON() : t;
        
        // Process replies to handle client senders
        if (Array.isArray(plain.replies)) {
          for (let reply of plain.replies) {
            if (reply.sender_type === 'client') {
              const client = await Client.findByPk(reply.sender_id, {
                attributes: ['client_id', 'company_name', 'email']
              });
              if (client) {
                reply.sender = {
                  user_id: client.client_id,
                  username: client.company_name,
                  email: client.email,
                  is_client: true
                };
              } else {
                reply.sender = null;
              }
            }
          }
          
          plain.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }
        
        const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
        plain.sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.sla ?? null;
        plain.response_sla_met = response_sla_met;
        plain.resolve_sla_met = resolve_sla_met;
        plain.is_other_issue = plain.is_other_issue ?? false;
        return plain;
      })
    );

    return res.json({ tickets: resp });
  } catch (err) {
    console.error('execGetAssignedTickets', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};




exports.getTicketById = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: TicketReply,
          as: 'replies',
          include: [
            { model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] },
            { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on'] }
          ],
        },
        
        { model: User, as: 'creator', attributes: ['user_id', 'username', 'email', 'first_name', 'last_name'] },
        { model: Client, as: 'client', attributes: ['client_id', 'company_name', 'contact_person', 'email'] },
        { model: SLA, as: 'sla' },
        { model: ClientSLA, as: 'client_sla' },
        { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'doc_base64', 'mime_type', 'created_on'] }
      ],
      order: [
        [{ model: TicketReply, as: 'replies' }, 'created_at', 'ASC']
      ]
    });

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (!(await ensureOwnerOrAdmin(req, ticket))) return res.status(403).json({ message: 'Forbidden' });

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;

    // Process replies to handle client senders
    if (Array.isArray(plain.replies)) {
      for (let reply of plain.replies) {
        // If sender_type is 'client', replace with client data
        if (reply.sender_type === 'client') {
          const client = await Client.findByPk(reply.sender_id, {
            attributes: ['client_id', 'company_name', 'email']
          });
          if (client) {
            reply.sender = {
              user_id: client.client_id,
              username: client.company_name,
              email: client.email,
              is_client: true
            };
          } else {
            reply.sender = null;
          }
        }
      }
      
      // JS fallback sort to guarantee order
      plain.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
    plain.sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.sla ?? null;
    plain.response_sla_met = response_sla_met;
    plain.resolve_sla_met = resolve_sla_met;
    
    // Set creator username based on whether it's user or client
    if (plain.user_id) {
      plain.created_by_username = plain.creator?.username || 'Unknown';
    } else if (plain.client_id) {
      plain.created_by_username = plain.client?.company_name || 'Unknown Client';
    }

    return res.json({ ticket: plain });
  } catch (err) {
    console.error('getTicketById', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// User raises ticket
exports.raiseTicket = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    console.log('raiseTicket - req.body keys:', Object.keys(req.body));
    console.log('raiseTicket - req.body:', req.body);
    console.log('raiseTicket - req.files count:', (req.files && req.files.length) || 0);

    // Map frontend field names to backend expected names
    const moduleVal = req.body.category;
    const sub_module = req.body.subCategory;

    // Store whether this is an "Other" issue type
    const isOtherIssueType = req.body.issueType === 'Other';
    
    // Handle issue type - if it's "Other", use issueName, otherwise use issueType
    let category = req.body.issueType;
    let issue_name = null;
    
    if (isOtherIssueType && req.body.issueName) {
      issue_name = req.body.issueName;
      category = req.body.issueName;
    }

    const comment = req.body.comments || req.body.comment || '';
    const priority = req.body.priority || 'Medium';
    const priority_id = req.body.priority_id || null;

    console.log('Mapped values:', { 
      moduleVal, 
      sub_module, 
      category, 
      issue_name, 
      comment, 
      priority, 
      priority_id,
      isOtherIssueType 
    });

    if (!moduleVal || !category || !comment) {
      await t.rollback();
      return res.status(400).json({
        message: 'Module, category and comments are required',
        received: { moduleVal, category, comment }
      });
    }

    const userId = req.user && (req.user.id ?? req.user.user_id);
    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Use issueType_id for regular issues, not issueType name
    const issue_type_id = isOtherIssueType ? null : (req.body.issueType_id ? parseInt(req.body.issueType_id) : null);

    // Determine SLA ID based on user_id and issue_type_id
    let slaId = null;
    
    if (req.body.sla_id && req.body.sla_id !== "00") {
      // If SLA ID is explicitly provided in request, use it
      const parsed = parseInt(req.body.sla_id, 10);
      if (!Number.isNaN(parsed)) slaId = parsed;
    } else if (issue_type_id && !isOtherIssueType) {
      // For regular issue types, find SLA for this user + issue type combination
      try {
        const slaRec = await SLA.findOne({
          where: {
            user_id: userId,
            issue_type_id: issue_type_id,
            is_active: true
          },
          order: [
            ['response_target_minutes', 'ASC'],
            ['resolve_target_minutes', 'ASC']
          ],
          transaction: t
        });

        if (slaRec) {
          slaId = slaRec.sla_id;
          console.log(`Found SLA for user ${userId} and issue type ${issue_type_id}: SLA ID ${slaId}`);
        } else {
          console.log(`No active SLA found for user ${userId} and issue type ${issue_type_id}`);
          slaId = 1;
          console.log(`Using default SLA ID: ${slaId}`);
        }
      } catch (slaError) {
        console.error('Error finding SLA:', slaError);
        slaId = 1;
        console.log(`Error occurred, using default SLA ID: ${slaId}`);
      }
    } else if (isOtherIssueType) {
      // For "Other" issue types, use default SLA ID = 1
      slaId = 1;
      console.log(`Using default SLA ID for "Other" issue type: ${slaId}`);
    } else {
      // No issue_type_id and not "Other" type - use default
      slaId = 1;
      console.log(`Using default SLA ID as fallback: ${slaId}`);
    }

    // Create ticket with mapped fields
    const ticketData = {
      user_id: userId,
      module: moduleVal,
      sub_module: sub_module,
      category: category,
      issue_type_id: issue_type_id,
      issue_name: issue_name,
      comment: comment,
      status: 'Open',
      sla_id: slaId,
      priority: priority,
      priority_id: priority_id,
      is_other_issue: isOtherIssueType
    };

    const ticket = await Ticket.create(ticketData, { transaction: t });

    // Handle file uploads
    const ticketDocsMeta = [];
    const files = req.files && Array.isArray(req.files) ? req.files : [];
    if (files.length > 0) {
      const docsToCreate = files.map((file) => {
        return {
          linked_id: ticket.ticket_id ?? ticket.id,
          table_name: 'ticket',
          type: (file.mimetype || '').startsWith('image/') ? 'image' : 'attachment',
          doc_name: file.originalname || file.filename || 'upload',
          mime_type: file.mimetype || 'application/octet-stream',
          doc_base64: file.buffer ? file.buffer.toString('base64') : null,
          created_by: req.user.username ?? String(userId),
          status: 'active'
        };
      });
      const created = await Document.bulkCreate(docsToCreate, { transaction: t });
      created.forEach((d) => {
        ticketDocsMeta.push({
          document_id: d.document_id ?? d.id ?? null,
          doc_name: d.doc_name,
          mime_type: d.mime_type,
          created_on: d.created_on
        });
      });
    }

    await t.commit();

    const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;

    let slaRecord = null;
    if (ticketPlain.sla_id) {
      slaRecord = await SLA.findByPk(ticketPlain.sla_id, {
        include: [
          {
            model: IssueType,
            as: 'issue_type',
            attributes: ['issue_type_id', 'name']
          }
        ]
      });
    }

    const { response_sla_met, resolve_sla_met } = await computeSLACompliance(ticketPlain);
    const responseTicket = {
      ...ticketPlain,
      ticket_documents: ticketDocsMeta,
      sla: slaRecord ? (slaRecord.toJSON ? slaRecord.toJSON() : slaRecord) : null,
      response_sla_met,
      resolve_sla_met,
      is_other_issue: isOtherIssueType
    };

    // Log SLA assignment details
    console.log('Ticket created with SLA details:', {
      ticket_id: responseTicket.ticket_id,
      user_id: userId,
      issue_type_id: issue_type_id,
      sla_id: slaId,
      is_other_issue: isOtherIssueType
    });

    // Notify admins
    (async () => {
      try {
        const admins = await User.findAll({ where: { role_name: 'admin', is_active: true }, attributes: ['email', 'username'] });
        const adminEmails = admins.map(a => a.email).filter(Boolean);
        if (adminEmails.length > 0) {
          const creator = { username: req.user.username || req.user.email, email: req.user.email };
          const { subject, html, text } = ticketCreatedTemplate({ ticket: responseTicket, creator });
          await sendMail({ to: adminEmails.join(','), subject, html, text });
        }
      } catch (mailErr) {
        console.error('Mail error (ticket created):', mailErr && mailErr.message ? mailErr.message : mailErr);
      }
    })();

    return res.status(201).json({ 
      message: 'Ticket raised successfully', 
      ticket: responseTicket,
      sla_assignment: {
        method: req.body.sla_id ? 'manual' : (isOtherIssueType ? 'default_other' : 'auto_user_issue_type'),
        sla_id: slaId
      }
    });
  } catch (err) {
    console.error('raiseTicket error:', err);
    try { await t.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({ message: 'Internal server error: ' + err.message });
  }
};



exports.replyToTicket = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const { 
      message: rawMessage, 
      status: requestedStatus, 
      screenshot_url, 
      assigned_to,
      priority: requestedPriority
    } = req.body;
    
    const files = req.files && Array.isArray(req.files) ? req.files : [];

    // ========== FIXED: PROPER AUTHENTICATION HANDLING ==========
    let sender_type = 'user';
    let senderId = null;
    let senderName = null;
    let senderEmail = null;

    console.log('Authentication debug:', {
      hasUser: !!req.user,
      hasClient: !!req.client,
      user: req.user ? { id: req.user.id, username: req.user.username } : null,
      client: req.client ? { id: req.client.id, company_name: req.client.company_name } : null
    });

    // Check client first, but only if it has valid data
    if (req.client && req.client.id && req.client.company_name) {
      sender_type = 'client';
      senderId = req.client.id;
      senderName = req.client.company_name;
      senderEmail = req.client.email;
      console.log(`Client reply - Client ID: ${senderId}, Name: ${senderName}`);
    } 
    // Then check user
    else if (req.user && req.user.id && req.user.username) {
      const role = req.user.role_name;
      if (role === 'admin' || role === 'executive') {
        sender_type = 'admin';
      } else {
        sender_type = 'user';
      }
      senderId = req.user.id || req.user.user_id;
      senderName = req.user.username;
      senderEmail = req.user.email;
      console.log(`User reply - User ID: ${senderId}, Role: ${role}, Name: ${senderName}`);
    } else {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized - No valid authentication found' });
    }

    // Validate senderId exists
    if (!senderId || !senderName) {
      await t.rollback();
      console.error('Invalid sender data:', { senderId, senderName, reqUser: req.user, reqClient: req.client });
      return res.status(400).json({ message: 'Unable to determine sender identity' });
    }
    // ========== END FIX ==========

    const isAdminSender = req.user && req.user.role_name === 'admin';
    const hasAssignAction = (assigned_to !== undefined && assigned_to !== null && String(assigned_to).trim() !== '');
    const hasPriorityAction = (requestedPriority !== undefined && requestedPriority !== null && String(requestedPriority).trim() !== '');

    if (
      (!rawMessage || String(rawMessage).trim() === '') &&
      files.length === 0 &&
      !requestedStatus &&
      !screenshot_url &&
      !(isAdminSender && hasAssignAction) &&
      !(isAdminSender && hasPriorityAction)
    ) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'At least one of message / files / status / screenshot_url / assigned_to (admin) / priority (admin) is required' 
      });
    }

    const ticket = await Ticket.findByPk(ticketId, { transaction: t });
    if (!ticket) {
      await t.rollback();
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Permission check
    if (!(await ensureCanReply(req, ticket))) {
      await t.rollback();
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Only these statuses are allowed
    const allowedStatuses = ['Open', 'Pending', 'Resolved', 'Closed'];
    let statusChanged = false;
    let newStatus = undefined;
    if (requestedStatus) {
      newStatus = String(requestedStatus).trim();
      if (!allowedStatuses.includes(newStatus)) {
        await t.rollback();
        return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
      }
      if (ticket.status !== newStatus) statusChanged = true;
    }

    // Priority update logic (admin only)
    let priorityChanged = false;
    let newPriority = undefined;
    if (isAdminSender && hasPriorityAction) {
      newPriority = String(requestedPriority).trim();
      
      const validPriorities = ['low', 'medium', 'high', 'critical', 'urgent'];
      if (!validPriorities.includes(newPriority)) {
        await t.rollback();
        return res.status(400).json({ message: `Invalid priority. Allowed: ${validPriorities.join(', ')}` });
      }
      
      if (ticket.priority !== newPriority) priorityChanged = true;
    }

    const now = new Date();

    // If admin replies for the first time -> set response_at & response_time_seconds
    if (req.user && req.user.role_name === 'admin' && !ticket.response_at) {
      ticket.response_at = now;
      const responseTime = await calculateWorkingHours(ticket.created_at, now);
      console.log("responseTime", responseTime, ticket.created_at, now);
      ticket.response_time_seconds = responseTime?.totalWorkingHours;
      ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
    }

    // If admin provided assigned_to, handle assignment (only admin allowed)
    if (isAdminSender && hasAssignAction) {
      const assignedId = parseInt(assigned_to, 10);
      if (Number.isNaN(assignedId)) {
        await t.rollback();
        return res.status(400).json({ message: 'Invalid assigned_to value' });
      }
      const execUser = await User.findByPk(assignedId, { transaction: t });
      if (!execUser) {
        await t.rollback();
        return res.status(400).json({ message: 'Assignee user not found' });
      }
      if (execUser.role_name !== 'executive') {
        await t.rollback();
        return res.status(400).json({ message: 'Assignee must be an executive' });
      }

      ticket.assigned_to = assignedId;
      ticket.last_updated_by = req.user.username ?? String(senderId);
      ticket.updated_at = now;
    }

    // Apply priority change (admin only)
    if (priorityChanged && newPriority) {
      ticket.priority = newPriority;
      ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
      ticket.updated_at = now;
    }

    // Apply status change
    if (statusChanged && newStatus) {
      ticket.prev_status = ticket.status;
      ticket.status = newStatus;
      ticket.last_updated_by = senderName ?? String(senderId);
      ticket.updated_at = now;

      if ((newStatus === 'Resolved' || newStatus === 'Closed') && !ticket.resolved_at) {
        ticket.resolved_at = now;
        
          const responseTime = await calculateWorkingHours(ticket.created_at, now);
          //ticket.resolve_time_seconds = secondsBetween(ticket.created_at, now);


          console.log(responseTime , ticket.created_at, now, "for responce")
           ticket.resolve_time_seconds  = responseTime?.totalWorkingHours
      }
    } else {
      // Update last_updated_by and updated_at even if only priority changed
      if (req.user && req.user.role_name === 'admin') {
        ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
      }
      ticket.updated_at = now;
    }

    // Persist ticket changes
    await ticket.save({ transaction: t });

    // ========== FIXED: CREATE REPLY WITH PROPER SENDER_ID ==========
    let reply = null;
    if (rawMessage && String(rawMessage).trim() !== '') {
      reply = await TicketReply.create({
        ticket_id: ticket.ticket_id ?? ticket.id,
        sender_id: senderId,
        sender_type: sender_type,
        message: rawMessage ?? ''
      }, { transaction: t });
      console.log(`Created reply with sender_id: ${senderId}, sender_type: ${sender_type}`);
    }

    // Handle file uploads
    const createdDocsMeta = [];
    if (files.length > 0) {
      let replyToAttach = reply;
      if (!replyToAttach) {
        replyToAttach = await TicketReply.create({
          ticket_id: ticket.ticket_id ?? ticket.id,
          sender_id: senderId,
          sender_type: sender_type,
          message: ''
        }, { transaction: t });
      }

      const docsToCreate = files.map((file) => {
        const b64 = file.buffer ? file.buffer.toString('base64') : null;
        const mime = file.mimetype || 'application/octet-stream';
        const isImage = mime.startsWith('image/');
        return {
          linked_id: replyToAttach.reply_id,
          table_name: 'ticket_reply',
          type: isImage ? 'image' : 'attachment',
          doc_name: file.originalname || file.filename || 'upload',
          mime_type: mime,
          doc_base64: b64,
          created_by: senderName ?? String(senderId),
          status: 'active'
        };
      });
      const created = await Document.bulkCreate(docsToCreate, { transaction: t });
      created.forEach((d) => {
        createdDocsMeta.push({
          document_id: d.document_id ?? d.id ?? null,
          doc_name: d.doc_name,
          mime_type: d.mime_type,
          created_on: d.created_on
        });
      });
    } else if (screenshot_url) {
      const dataUrl = String(screenshot_url);
      const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (m) {
        const mimetype = m[1];
        const b64 = m[2];
        let replyToAttach = reply;
        if (!replyToAttach) {
          replyToAttach = await TicketReply.create({
            ticket_id: ticket.ticket_id ?? ticket.id,
            sender_id: senderId,
            sender_type: sender_type,
            message: ''
          }, { transaction: t });
        }

        const doc = await Document.create({
          linked_id: replyToAttach.reply_id,
          table_name: 'ticket_reply',
          type: mimetype.startsWith('image/') ? 'image' : 'attachment',
          doc_name: req.body.screenshot_name ?? `upload.${(mimetype.split('/')[1] || 'bin')}`,
          mime_type: mimetype,
          doc_base64: b64,
          created_by: senderName ?? String(senderId),
          status: 'active'
        }, { transaction: t });

        createdDocsMeta.push({
          document_id: doc.document_id ?? doc.id ?? null,
          doc_name: doc.doc_name,
          mime_type: doc.mime_type,
          created_on: doc.created_on
        });
      }
    }

    await t.commit();

    // Notifications (simplified for now)
    (async () => {
      try {
        const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;
        const replyPlain = reply ? (reply.toJSON ? reply.toJSON() : reply) : null;
        
        // Your notification logic here...
        
      } catch (mailErr) {
        console.error('Mail error:', mailErr);
      }
    })();

    // Prepare response
    const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;
    
    // Fetch ticket-level documents if any
    const ticketDocs = await Document.findAll({
      where: { linked_id: ticket.ticket_id, table_name: 'ticket' },
      attributes: ['document_id', 'doc_name', 'mime_type', 'created_on']
    });

    // Attach assignee object if assigned
    let assigneeObj = null;
    if (ticketPlain.assigned_to) {
      const assigneeUser = await User.findByPk(ticketPlain.assigned_to);
      if (assigneeUser) {
        assigneeObj = {
          user_id: assigneeUser.user_id,
          username: assigneeUser.username,
          email: assigneeUser.email
        };
      }
    }

    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(ticketPlain);

    return res.status(201).json({
      message: 'Reply added successfully',
      reply: reply,
      documents: createdDocsMeta,
      ticket: {
        ...ticketPlain,
        ticket_documents: ticketDocs.map(d => (d.toJSON ? d.toJSON() : d)),
        assignee: assigneeObj,
        sla,
        response_sla_met,
        resolve_sla_met
      }
    });
  } catch (err) {
    console.error('replyToTicket error:', err);
    try { await t.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({ message: 'Internal server error: ' + err.message });
  }
};
// Admin request close
exports.adminRequestClose = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (ticket.status === 'Closed' || ticket.status === 'Pending') {
      return res.status(400).json({ message: 'Ticket already closed or pending' });
    }

    ticket.prev_status = ticket.status;
    ticket.status = 'Pending';
    ticket.updated_at = new Date();
    ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
    await ticket.save();

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id ?? req.user.user_id,
      sender_type: 'admin',
      message: 'Admin has requested to close this ticket. Please approve or decline.'
    });

    // Notify owner
    (async () => {
      try {
        let ownerEmail = null;
        if (ticket.user_id) {
          const owner = await User.findByPk(ticket.user_id, { attributes: ['email', 'username'] });
          ownerEmail = owner?.email;
        } else if (ticket.client_id) {
          const owner = await Client.findByPk(ticket.client_id, { attributes: ['email', 'company_name'] });
          ownerEmail = owner?.email;
        }
        
        const admin = { username: req.user.username, email: req.user.email };
        if (ownerEmail) {
          const { subject, html, text } = ticketStatusChangedTemplate({ 
            ticket: ticket.toJSON ? ticket.toJSON() : ticket, 
            oldStatus: ticket.prev_status, 
            newStatus: ticket.status, 
            admin 
          });
          await sendMail({ to: ownerEmail, subject, html, text });
        }
      } catch (e) {
        console.error('Mail error (adminRequestClose):', e && e.message ? e.message : e);
      }
    })();

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);

    return res.json({ message: 'Ticket marked Pending', ticket: { ...plain, sla, response_sla_met, resolve_sla_met } });
  } catch (err) {
    console.error('adminRequestClose', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Admin update status
exports.adminUpdateStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const { status } = req.body;
    const allowed = ['Open', 'Pending', 'Resolved', 'Closed'];
    if (!allowed.includes(status)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid status' });
    }

    const ticket = await Ticket.findByPk(ticketId, { transaction: t });
    if (!ticket) {
      await t.rollback();
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const oldStatus = ticket.status;
    ticket.prev_status = ticket.status;
    ticket.status = status;
    ticket.updated_at = new Date();
    ticket.last_updated_by = req.user.username ?? req.user.id ?? null;

    if ((status === 'Resolved' || status === 'Closed') && !ticket.resolved_at) {
      const now = new Date();
      ticket.resolved_at = now;
      ticket.resolve_time_seconds = secondsBetween(ticket.created_at, now);
    }

    await ticket.save({ transaction: t });

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id ?? req.user.user_id,
      sender_type: 'admin',
      message: `Admin updated status to ${status}`
    }, { transaction: t });

    await t.commit();

    // Notify owner
    (async () => {
      try {
        let ownerEmail = null;
        if (ticket.user_id) {
          const owner = await User.findByPk(ticket.user_id, { attributes: ['email', 'username'] });
          ownerEmail = owner?.email;
        } else if (ticket.client_id) {
          const owner = await Client.findByPk(ticket.client_id, { attributes: ['email', 'company_name'] });
          ownerEmail = owner?.email;
        }
        
        const admin = { username: req.user.username, email: req.user.email };
        if (ownerEmail) {
          const { subject, html, text } = ticketStatusChangedTemplate({ 
            ticket: ticket.toJSON ? ticket.toJSON() : ticket, 
            oldStatus, 
            newStatus: status, 
            admin 
          });
          await sendMail({ to: ownerEmail, subject, html, text });
        }
      } catch (e) {
        console.error('Mail error (adminUpdateStatus):', e && e.message ? e.message : e);
      }
    })();

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);

    return res.json({ message: 'Status updated', ticket: { ...plain, sla, response_sla_met, resolve_sla_met } });
  } catch (err) {
    console.error('adminUpdateStatus', err);
    await t.rollback();
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// User approve closure
exports.userApproveClosure = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId, { transaction: t });
    if (!ticket) { await t.rollback(); return res.status(404).json({ message: 'Ticket not found' }); }
    
    const uid = req.user.id ?? req.user.user_id;
    if (ticket.user_id !== uid) { await t.rollback(); return res.status(403).json({ message: 'Only owner can approve' }); }
    if (ticket.status !== 'Pending') { await t.rollback(); return res.status(400).json({ message: 'Ticket not pending' }); }

    ticket.prev_status = ticket.status;
    ticket.status = 'Closed';
    ticket.updated_at = new Date();

    if (!ticket.resolved_at) {
      const now = new Date();
      ticket.resolved_at = now;
      ticket.resolve_time_seconds = secondsBetween(ticket.created_at, now);
    }

    await ticket.save({ transaction: t });

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: uid,
      sender_type: 'user',
      message: 'User approved closure.'
    }, { transaction: t });

    await t.commit();

    // Notify admins optionally
    (async () => {
      try {
        const admins = await User.findAll({ where: { role_name: 'admin', is_active: true }, attributes: ['email', 'username'] });
        const adminEmails = admins.map(a => a.email).filter(Boolean);
        if (adminEmails.length > 0) {
          const adminActor = { username: req.user.username, email: req.user.email };
          const { subject, html, text } = ticketStatusChangedTemplate({ 
            ticket: ticket.toJSON ? ticket.toJSON() : ticket, 
            oldStatus: ticket.prev_status, 
            newStatus: ticket.status, 
            admin: adminActor 
          });
          await sendMail({ to: adminEmails.join(','), subject, html, text });
        }
      } catch (e) {
        console.error('Mail error (userApproveClosure):', e && e.message ? e.message : e);
      }
    })();

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);

    return res.json({ message: 'Ticket closed', ticket: { ...plain, sla, response_sla_met, resolve_sla_met } });
  } catch (err) {
    console.error('userApproveClosure', err);
    await t.rollback();
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// User decline closure
exports.userDeclineClosure = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    const uid = req.user.id ?? req.user.user_id;
    if (ticket.user_id !== uid) return res.status(403).json({ message: 'Only owner can decline' });
    if (ticket.status !== 'Pending') return res.status(400).json({ message: 'Ticket not pending' });

    const previous = ticket.prev_status || 'Open';
    ticket.status = previous;
    ticket.prev_status = null;
    ticket.updated_at = new Date();
    await ticket.save();

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: uid,
      sender_type: 'user',
      message: 'User declined closure. Reopened for work.'
    });

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);

    return res.json({ message: 'Ticket reverted to previous status', ticket: { ...plain, sla, response_sla_met, resolve_sla_met } });
  } catch (err) {
    console.error('userDeclineClosure', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// User reopen ticket
exports.userReopenTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    const uid = req.user.id ?? req.user.user_id;
    if (ticket.user_id !== uid) return res.status(403).json({ message: 'Only owner can reopen' });
    if (ticket.status !== 'Closed') return res.status(400).json({ message: 'Only closed tickets can be reopened' });

    ticket.prev_status = ticket.status;
    ticket.status = 'Pending';
    ticket.updated_at = new Date();
    await ticket.save();

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: uid,
      sender_type: 'user',
      message: 'User reopened the ticket.'
    });

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);

    return res.json({ message: 'Ticket reopened', ticket: { ...plain, sla, response_sla_met, resolve_sla_met } });
  } catch (err) {
    console.error('userReopenTicket', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Assign ticket to executive
exports.assignTicket = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const { assigned_to } = req.body;
    if (!assigned_to) { await t.rollback(); return res.status(400).json({ message: 'assigned_to required' }); }

    // Check admin
    if (!req.user || req.user.role_name !== 'admin') {
      await t.rollback();
      return res.status(403).json({ message: 'Only admins can assign tickets' });
    }

    const ticket = await Ticket.findByPk(ticketId, { transaction: t });
    if (!ticket) { await t.rollback(); return res.status(404).json({ message: 'Ticket not found' }); }

    // Verify assignee exists and is executive
    const assignee = await User.findByPk(assigned_to);
    if (!assignee || assignee.role_name !== 'executive') {
      await t.rollback();
      return res.status(400).json({ message: 'Assignee must be an executive user' });
    }

    ticket.assigned_to = assigned_to;
    ticket.updated_at = new Date();
    ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
    await ticket.save({ transaction: t });

    // Create an admin reply log
    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id ?? req.user.user_id,
      sender_type: 'admin',
      message: `Assigned to ${assignee.username}`
    }, { transaction: t });

    await t.commit();

    // Notify the executive
    (async () => {
      try {
        if (assignee.email) {
          const subject = `Ticket #${ticket.ticket_id} assigned to you`;
          const text = `Ticket ${ticket.ticket_id} has been assigned to you.`;
          await sendMail({ to: assignee.email, subject, text });
        }
      } catch (e) { console.error('mail error', e); }
    })();

    return res.json({ message: 'Ticket assigned', ticket: ticket.toJSON ? ticket.toJSON() : ticket });
  } catch (err) {
    console.error('assignTicket', err);
    try { await t.rollback(); } catch (e) {}
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Update ticket priority
exports.updateTicketPriority = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const { priority, priority_id } = req.body;
    const userId = req.user && (req.user.id ?? req.user.user_id);

    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Find the ticket
    const ticket = await Ticket.findByPk(ticketId, { transaction: t });
    if (!ticket) {
      await t.rollback();
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check if user is admin
    const user = await User.findByPk(userId);
    if (!user || user.role_name !== 'admin') {
      await t.rollback();
      return res.status(403).json({ message: 'Only admins can update ticket priority' });
    }

    // Validate that priority is provided
    if (!priority) {
      await t.rollback();
      return res.status(400).json({ message: 'Priority is required' });
    }

    // Update priority
    await ticket.update({
      priority: priority,
      priority_id: priority_id,
      last_updated_by: user.username,
      updated_at: new Date()
    }, { transaction: t });

    await t.commit();

    // Get the updated ticket with all relations
    const updatedTicket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: TicketReply,
          as: 'replies',
          include: [
            { model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] },
            { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on'] }
          ],
        },
        { model: User, as: 'creator', attributes: ['user_id', 'username', 'email', 'first_name', 'last_name'] },
        { model: Client, as: 'client', attributes: ['client_id', 'company_name', 'contact_person', 'email'] },
        { model: SLA, as: 'sla' },
        { model: ClientSLA, as: 'client_sla' },
        { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'doc_base64', 'mime_type', 'created_on'] }
      ],
      order: [
        [{ model: TicketReply, as: 'replies' }, 'created_at', 'ASC']
      ]
    });

    const plainTicket = updatedTicket.toJSON ? updatedTicket.toJSON() : updatedTicket;

    // Compute SLA compliance
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plainTicket);
    
    // Prepare response
    const responseTicket = {
      ...plainTicket,
      sla: sla ? (sla.toJSON ? sla.toJSON() : sla) : plainTicket.sla ?? null,
      response_sla_met,
      resolve_sla_met,
      created_by_username: plainTicket.creator?.username || plainTicket.client?.company_name || 'Unknown'
    };

    return res.status(200).json({ 
      message: 'Ticket priority updated successfully', 
      ticket: responseTicket 
    });
  } catch (err) {
    console.error('updateTicketPriority error:', err);
    try { await t.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({ message: 'Internal server error: ' + err.message });
  }
};

// Get document
exports.getDocument = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const doc = await Document.findByPk(id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    if (doc.doc_base64) {
      const buffer = Buffer.from(doc.doc_base64, 'base64');
      res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.doc_name || 'file'}"`);
      return res.send(buffer);
    } else {
      return res.status(404).json({ message: 'No binary content' });
    }
  } catch (err) {
    console.error('getDocument', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};